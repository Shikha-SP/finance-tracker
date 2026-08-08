import pandas as pd
import numpy as np

def calculate_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period, min_periods=1).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period, min_periods=1).mean()
    rs = gain / (loss.replace(0, 1e-9))
    return 100 - (100 / (1 + rs))

def calculate_macd(series, fast=12, slow=26, signal=9):
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd = ema_fast - ema_slow
    macd_signal = macd.ewm(span=signal, adjust=False).mean()
    macd_hist = macd - macd_signal
    return macd, macd_signal, macd_hist

def calculate_bollinger_bands(series, period=20, std_dev=2):
    sma = series.rolling(window=period, min_periods=1).mean()
    rolling_std = series.rolling(window=period, min_periods=1).std().fillna(0)
    upper_band = sma + (rolling_std * std_dev)
    lower_band = sma - (rolling_std * std_dev)
    return upper_band, sma, lower_band

def calculate_atr(df, period=14):
    high_low = df['high'] - df['low']
    high_close = (df['high'] - df['close'].shift()).abs()
    low_close = (df['low'] - df['close'].shift()).abs()
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    return tr.rolling(window=period, min_periods=1).mean()

def compute_all_indicators(df):
    """
    Expects a pandas DataFrame with columns: open, high, low, close, volume (sorted by date ascending)
    """
    data = df.copy()
    if 'close' not in data.columns:
        return data

    data['rsi'] = calculate_rsi(data['close'], 14)
    
    macd, macd_signal, macd_hist = calculate_macd(data['close'])
    data['macd'] = macd
    data['macd_signal'] = macd_signal
    data['macd_hist'] = macd_hist
    
    data['sma_20'] = data['close'].rolling(window=20, min_periods=1).mean()
    data['sma_50'] = data['close'].rolling(window=50, min_periods=1).mean()
    
    data['ema_20'] = data['close'].ewm(span=20, adjust=False).mean()
    data['ema_50'] = data['close'].ewm(span=50, adjust=False).mean()
    
    upper, mid, lower = calculate_bollinger_bands(data['close'], 20, 2)
    data['bb_upper'] = upper
    data['bb_middle'] = mid
    data['bb_lower'] = lower
    data['bb_width'] = (upper - lower) / (mid.replace(0, 1e-9))
    
    data['atr'] = calculate_atr(data, 14)
    data['volatility_pct'] = (data['atr'] / data['close']) * 100
    data['momentum_5d'] = ((data['close'] - data['close'].shift(5)) / data['close'].shift(5)) * 100
    
    # Fill any initial NaNs
    data = data.ffill().bfill().fillna(0)
    return data

def compute_support_resistance(df, lookback=50):
    """
    Support & resistance from the rolling high/low (excluding the very latest
    candle so the levels are meaningful) plus classic pivot points. Also reports
    where the price sits between support and resistance and how close it is to
    either level. Returns a dict for the latest bar.
    """
    if df is None or len(df) < 10 or 'high' not in df.columns or 'low' not in df.columns:
        return None
    data = df.reset_index(drop=True)
    last = int(len(data) - 1)
    win_start = max(0, last - lookback)
    window = data.iloc[win_start:last]
    if len(window) < 5:
        window = data.iloc[:last]

    resistance = float(window['high'].max())
    support = float(window['low'].min())

    prev_high = float(data.iloc[last - 1]['high'])
    prev_low = float(data.iloc[last - 1]['low'])
    prev_close = float(data.iloc[last - 1]['close'])
    pivot = (prev_high + prev_low + prev_close) / 3.0

    price = float(data.iloc[last]['close'])
    r1 = 2 * pivot - prev_low
    r2 = pivot + (prev_high - prev_low)
    s1 = 2 * pivot - prev_high
    s2 = pivot - (prev_high - prev_low)

    span = (resistance - support) if resistance > support else 1e-9
    position_pct = round(((price - support) / span) * 100.0, 1)
    break_range_pct = round((span / support) * 100.0 if support else 0.0, 2)

    return {
        "support": round(support, 2),
        "resistance": round(resistance, 2),
        "pivot": round(pivot, 2),
        "r1": round(r1, 2),
        "r2": round(r2, 2),
        "s1": round(s1, 2),
        "s2": round(s2, 2),
        "positionPct": position_pct,
        "rangePct": break_range_pct,
        "nearResistance": (resistance - price) <= 0.02 * price,
        "nearSupport": (price - support) <= 0.02 * price
    }

def project_trend(df, horizon_days=10, reg_lookback=30):
    """
    Project the expected move over the next `horizon_days` sessions using a log
    price linear-regression slope (trend) scaled by the regression R^2 (quality)
    and a volatility band from realised daily returns. Returns a dict with the
    direction, expected move %, a low/high band and a trend-quality label.
    """
    if df is None or len(df) < 20 or 'close' not in df.columns:
        return None
    closes = df['close'].dropna().astype(float)
    closes = closes[closes > 0].reset_index(drop=True)
    if len(closes) < 10:
        return None
    series = closes.iloc[-reg_lookback:]
    if len(series) < 10:
        series = closes

    log_p = np.log(series.to_numpy(dtype=float))
    x = np.arange(len(log_p), dtype=float)
    slope, intercept = np.polyfit(x, log_p, 1)
    y_hat = slope * x + intercept
    ss_res = float(np.sum((log_p - y_hat) ** 2))
    ss_tot = float(np.sum((log_p - np.mean(log_p)) ** 2)) or 1e-12
    r2 = float(np.clip(1.0 - ss_res / ss_tot, 0.0, 1.0))

    rets = np.diff(np.log(closes.to_numpy(dtype=float)))
    vol_daily = float(np.std(rets, ddof=1)) if len(rets) > 1 else 0.0
    z = 0.5

    daily_g = float(slope)
    drift = np.exp(daily_g * horizon_days) - 1.0
    band = vol_daily * np.sqrt(horizon_days) * z

    direction = "UP" if daily_g > 0 else ("DOWN" if daily_g < 0 else "FLAT")
    if r2 >= 0.5:
        quality = "strong"
    elif r2 >= 0.2:
        quality = "moderate"
    else:
        quality = "weak"

    return {
        "direction": direction,
        "horizonDays": horizon_days,
        "dailyRatePct": round(daily_g * 100.0, 4),
        "expectedMovePct": round(drift * 100.0, 2),
        "lowPct": round((drift - band) * 100.0, 2),
        "highPct": round((drift + band) * 100.0, 2),
        "rSquared": round(r2, 3),
        "trendQuality": quality,
        "volatilityDailyPct": round(vol_daily * 100.0, 3)
    }

if __name__ == "__main__":
    # Test calculation with dummy series
    dates = pd.date_range('2024-01-01', periods=60)
    sample_df = pd.DataFrame({
        'date': dates,
        'open': np.linspace(100, 150, 60),
        'high': np.linspace(102, 155, 60),
        'low': np.linspace(98, 148, 60),
        'close': np.linspace(101, 152, 60),
        'volume': np.random.randint(1000, 5000, 60)
    })
    res = compute_all_indicators(sample_df)
    print(f"Calculated indicators successfully. Result columns: {list(res.columns)}")
