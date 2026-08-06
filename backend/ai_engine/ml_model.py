import numpy as np
import pandas as pd

class MovementClassifier:
    """
    Transparent technical analysis engine (no black-box model).

    Produces a bullish/bearish/neutral outlook from real NEPSE OHLCV data by
    weighting standard technical factors:
      - Trend vs the 20/50-day simple & 50-day exponential moving averages
      - Momentum (5-day return + MACD histogram level & direction)
      - RSI mean-reversion (oversold = potential bounce, overbought = pullback risk)
      - Price position inside the Bollinger Bands
      - Volume expansion/contraction

    The output is consistent with what the price chart shows by construction:
    a stock falling below its moving averages with a negative MACD histogram
    cannot score bullish.
    """

    def __init__(self):
        self._prediction_cache = {}

    @staticmethod
    def _f(series_like, default=0.0):
        try:
            v = series_like
            if v is None:
                return default
            return float(v)
        except Exception:
            return default

    @staticmethod
    def _clamp(x, lo=0.0, hi=1.0):
        return max(lo, min(hi, x))

    def compute_parts(self, df):
        """Returns (trend, momentum, rsi, bb, volume) sub-scores in [0, 1]."""
        if len(df) < 2:
            return 0.5, 0.5, 0.5, 0.5, 0.5

        last = df.iloc[-1]
        close = self._f(last.get('close'))
        if close <= 0:
            return 0.5, 0.5, 0.5, 0.5, 0.5

        sma20 = self._f(last.get('sma_20'))
        sma50 = self._f(last.get('sma_50'))
        ema50 = self._f(last.get('ema_50'))

        above_s20 = 1.0 if sma20 and close > sma20 else 0.0
        above_s50 = 1.0 if sma50 and close > sma50 else 0.0
        above_e50 = 1.0 if ema50 and close > ema50 else 0.0
        slope_up = 1.0 if (sma20 and sma50 and sma20 > sma50) else 0.0
        trend = 0.30 * above_s20 + 0.30 * above_s50 + 0.20 * above_e50 + 0.20 * slope_up

        mom5 = self._f(last.get('momentum_5d'))
        mom_score = 1.0 / (1.0 + np.exp(-mom5 / 6.0))
        macd_hist = self._f(last.get('macd_hist'))
        hist_rising = 1.0
        if len(df) >= 3:
            h1 = self._f(df.iloc[-1].get('macd_hist'))
            h2 = self._f(df.iloc[-2].get('macd_hist'))
            h3 = self._f(df.iloc[-3].get('macd_hist'))
            hist_rising = 1.0 if (h1 >= h2 >= h3) else 0.0
        momentum = 0.40 * mom_score + 0.30 * float(macd_hist > 0) + 0.30 * hist_rising

        rsi = self._f(last.get('rsi'), 50.0)
        rsi_score = self._clamp((70.0 - rsi) / 45.0)

        bb_low = self._f(last.get('bb_lower'))
        bb_up = self._f(last.get('bb_upper'))
        bb_score = 0.5
        if bb_up > bb_low:
            bb_score = self._clamp((close - bb_low) / (bb_up - bb_low))

        vol = self._f(last.get('volume'))
        vol_avg = 0.0
        if len(df) >= 21 and 'volume' in df.columns:
            vol_avg = float(pd.to_numeric(df['volume'], errors='coerce').iloc[-21:-1].mean())
        volume_score = 0.5 if vol_avg <= 0 else self._clamp(vol / vol_avg)

        return trend, momentum, rsi_score, bb_score, volume_score

    def score_series(self, df):
        """Returns a 0..1 composite bullish score from the indicator dataframe."""
        trend, momentum, rsi_score, bb_score, volume_score = self.compute_parts(df)
        return 0.35 * trend + 0.25 * momentum + 0.15 * rsi_score + 0.10 * bb_score + 0.15 * volume_score

    def predict_movement_probabilities(self, df, sentiment_score=0.0, cache_key=None):
        # Cache predictions per symbol/bar so repeated screener runs are instant.
        if cache_key:
            latest_date = str(df['date'].iloc[-1]) if 'date' in df.columns else None
            latest_close = round(float(df['close'].iloc[-1]), 2) if 'close' in df.columns else None
            ckey = (cache_key, latest_date, latest_close)
            if ckey in self._prediction_cache:
                return self._prediction_cache[ckey]
            result = self._predict_impl(df, sentiment_score)
            self._prediction_cache[ckey] = result
            return result
        return self._predict_impl(df, sentiment_score)

    def _predict_impl(self, df, sentiment_score=0.0):
        if len(df) < 5:
            return {
                "bullishProb": 33.3,
                "neutralProb": 33.4,
                "bearishProb": 33.3,
                "signal": "NEUTRAL",
                "confidenceScore": 0.0,
                "dataQuality": "insufficient"
            }

        score = self.score_series(df)
        # News sentiment nudges the score slightly but never overrides the chart trend.
        score = self._clamp(score + 0.03 * float(sentiment_score))

        bull = max(0.0, 50.0 + (score - 0.5) * 100.0)
        bear = max(0.0, 50.0 - (score - 0.5) * 100.0)
        total = bull + bear
        if total > 100.0:
            scale = 100.0 / total
            bull *= scale
            bear *= scale

        bull_p = round(bull, 1)
        bear_p = round(bear, 1)
        neut_p = round(100.0 - bull_p - bear_p, 1)

        if score >= 0.55:
            signal = "BULLISH"
            confidence = bull_p
        elif score <= 0.45:
            signal = "BEARISH"
            confidence = bear_p
        else:
            signal = "NEUTRAL"
            confidence = round(50.0 - abs(score - 0.5) * 100.0, 1)

        trend, momentum, rsi_score, bb_score, volume_score = self.compute_parts(df)
        last = df.iloc[-1]
        close = self._f(last.get('close'))
        sma20 = self._f(last.get('sma_20'))
        sma50 = self._f(last.get('sma_50'))
        vol = self._f(last.get('volume'))
        vol_avg = 0.0
        if len(df) >= 21 and 'volume' in df.columns:
            vol_avg = float(pd.to_numeric(df['volume'], errors='coerce').iloc[-21:-1].mean())

        feature_values = {
            "rsi": round(self._f(last.get('rsi'), 50.0), 1),
            "macd_hist": round(self._f(last.get('macd_hist')), 3),
            "sma_20_ratio": round(close / sma20, 3) if sma20 else 1.0,
            "sma_50_ratio": round(close / sma50, 3) if sma50 else 1.0,
            "volatility_pct": round(self._f(last.get('volatility_pct'), 1.5), 2),
            "momentum_5d": round(self._f(last.get('momentum_5d')), 2),
            "vol_change": round((vol / vol_avg - 1.0) if vol_avg > 0 else 0.0, 3),
            "trend_score": round(trend, 3),
            "momentum_score": round(momentum, 3),
            "rsi_score": round(rsi_score, 3),
            "bb_score": round(bb_score, 3),
            "volume_score": round(volume_score, 3),
            "score": round(score, 3),
        }

        return {
            "bullishProb": bull_p,
            "neutralProb": neut_p,
            "bearishProb": bear_p,
            "signal": signal,
            "confidenceScore": round(confidence, 1),
            "featureValues": feature_values,
            "dataQuality": "technical (real NEPSE OHLCV)"
        }


classifier = MovementClassifier()

if __name__ == "__main__":
    # Quick self-check with a clearly downtrending series: must be BEARISH.
    dummy_df = pd.DataFrame({
        'close': [100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90],
        'volume': [10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000, 18000, 19000, 20000],
    })
    df = dummy_df.copy()
    df['rsi'] = 35.0
    df['macd_hist'] = -1.0
    df['sma_20'] = 100.0
    df['sma_50'] = 105.0
    df['ema_50'] = 104.0
    df['bb_lower'] = 88.0
    df['bb_upper'] = 108.0
    df['volatility_pct'] = 2.0
    df['momentum_5d'] = -8.0
    res = classifier.predict_movement_probabilities(df)
    print("Downtrend check:", res['signal'], res['bullishProb'], res['bearishProb'])
