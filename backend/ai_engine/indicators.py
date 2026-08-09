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

def indicator_signals(df):
    """
    Interpret the mathematical state of the indicators on the latest bar so the
    UI can label them in plain words (no guessing):
      - RSI state          : OVERSOLD (<30) / OVERBOUGHT (>70) / NEUTRAL
      - MACD               : value, signal, histogram + a recent BULLISH/BEARISH
                             crossover (hist sign flip within the last 6 bars) and
                             whether MACD sits above or below its signal line
      - Trend              : price vs SMA20/50 and the SMA20 vs SMA50 relationship
      - Bollinger position : where price sits inside the bands (lower..upper)
    Expects output of compute_all_indicators (sorted ascending by date).
    """
    if df is None or len(df) < 3:
        return None
    latest = df.iloc[-1]
    close = float(latest.get('close', 0))

    def _f(v):
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    rsi = _f(latest.get('rsi'))
    rsi_state = None
    if rsi is not None:
        if rsi >= 70:
            rsi_state = "OVERBOUGHT"
        elif rsi <= 30:
            rsi_state = "OVERSOLD"
        else:
            rsi_state = "NEUTRAL"

    macd = _f(latest.get('macd'))
    macd_signal = _f(latest.get('macd_signal'))
    macd_hist = _f(latest.get('macd_hist'))
    macd_cross = None
    macd_state = None
    if macd is not None and macd_signal is not None:
        macd_state = "ABOVE" if macd >= macd_signal else "BELOW"
        hist = df['macd_hist'].tail(6).to_numpy(dtype=float)
        for i in range(len(hist) - 1, 0, -1):
            if hist[i - 1] <= 0 < hist[i]:
                macd_cross = "BULLISH"
                break
            if hist[i - 1] >= 0 > hist[i]:
                macd_cross = "BEARISH"
                break

    sma20 = _f(latest.get('sma_20'))
    sma50 = _f(latest.get('sma_50'))
    ema20 = _f(latest.get('ema_20'))
    ema50 = _f(latest.get('ema_50'))
    vs_sma20 = None
    vs_sma50 = None
    if sma20:
        vs_sma20 = round(((close - sma20) / sma20) * 100.0, 2)
    if sma50:
        vs_sma50 = round(((close - sma50) / sma50) * 100.0, 2)
    if sma20 and sma50:
        sma_trend = "UPTREND" if sma20 > sma50 else ("DOWNTREND" if sma20 < sma50 else "SIDEWAYS")
    else:
        sma_trend = None

    bb_upper = _f(latest.get('bb_upper'))
    bb_lower = _f(latest.get('bb_lower'))
    bb_position = None
    bb_state = None
    if bb_upper is not None and bb_lower is not None and bb_upper > bb_lower:
        bb_position = round(((close - bb_lower) / (bb_upper - bb_lower)) * 100.0, 1)
        if bb_position >= 90:
            bb_state = "AT_UPPER"
        elif bb_position >= 60:
            bb_state = "UPPER_HALF"
        elif bb_position <= 10:
            bb_state = "AT_LOWER"
        else:
            bb_state = "LOWER_HALF"

    return {
        "rsi": round(rsi, 1) if rsi is not None else None,
        "rsiState": rsi_state,
        "macd": round(macd, 4) if macd is not None else None,
        "macdSignal": round(macd_signal, 4) if macd_signal is not None else None,
        "macdHist": round(macd_hist, 4) if macd_hist is not None else None,
        "macdCross": macd_cross,
        "macdState": macd_state,
        "priceVsSma20": vs_sma20,
        "priceVsSma50": vs_sma50,
        "ema20": round(ema20, 2) if ema20 is not None else None,
        "ema50": round(ema50, 2) if ema50 is not None else None,
        "smaTrend": sma_trend,
        "bbPosition": bb_position,
        "bbState": bb_state,
        "atr": round(_f(latest.get('atr')) or 0, 2),
        "volatilityPct": round(_f(latest.get('volatility_pct')) or 0, 2),
        "momentum5d": round(_f(latest.get('momentum_5d')) or 0, 2),
    }

def project_duration(sr, projection, price=None):
    """
    Answer "how many more sessions could this trend last" using real math:
    if the stock is trending, how many sessions does the observed daily trend
    rate need to travel from the current price to resistance (upside) or down
    to support (downside). Distance-to-level is the honest cap on a trend, and
    the regression R^2 tells us how much to trust the trend at all.
    """
    if not sr or not projection or price is None:
        return None
    daily_rate = projection.get('dailyRatePct')
    if daily_rate is None or abs(float(daily_rate)) < 1e-6:
        return None

    resistance = float(sr.get('resistance') or 0)
    support = float(sr.get('support') or 0)
    price = float(price)
    daily_log_g = float(daily_rate) / 100.0

    def sessions_to(target):
        if target <= 0 or price <= 0:
            return None
        # ln(target/price) / daily_log_g  (log-space sessions)
        s = np.log(target / price) / daily_log_g
        return int(round(s)) if s > 0 and np.isfinite(s) else None

    sessions_to_res = sessions_to(resistance)
    sessions_to_sup = sessions_to(support)

    return {
        "sessionsToResistance": sessions_to_res,
        "sessionsToSupport": sessions_to_sup,
        "resistanceDistancePct": round(((resistance - price) / price) * 100.0, 2),
        "supportDistancePct": round(((price - support) / price) * 100.0, 2),
        "trendQuality": projection.get('trendQuality'),
        "rSquared": projection.get('rSquared'),
        "direction": projection.get('direction'),
    }

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
