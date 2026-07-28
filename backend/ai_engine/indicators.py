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
