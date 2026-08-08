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


def investment_rating(prediction=None, fundamentals=None, sentiment=None, market_bias=None):
    """
    Single transparent 0..100 investment score combining technicals (from the
    scorer), fundamentals (real MeroLagani) and news sentiment, plus a
    plain-language verdict. Every contribution is a labelled part so the UI can
    show *why* a stock is a BUY or SELL.
    """
    parts = []
    score = 50.0

    if prediction:
        sig = prediction.get('signal')
        conf = float(prediction.get('confidenceScore') or 0.0)
        if sig == 'BULLISH':
            t = 15.0 * (0.5 + conf / 200.0)
            score += t
            parts.append(("Technical trend", f"BULLISH with {conf}% confidence", f"+{t:.1f}"))
        elif sig == 'BEARISH':
            t = -15.0 * (0.5 + conf / 200.0)
            score += t
            parts.append(("Technical trend", f"BEARISH with {conf}% confidence", f"{t:.1f}"))
        else:
            parts.append(("Technical trend", "NEUTRAL", "0"))

    if fundamentals:
        pe = fundamentals.get('peRatio')
        roe = fundamentals.get('roe')
        dy = fundamentals.get('dividendYield')
        eps = fundamentals.get('eps')
        if eps is not None and float(eps) < 0:
            score -= 12.0
            parts.append(("Profitability", f"Loss-making (EPS {eps})", "-12"))
        else:
            if pe is not None and float(pe) > 0:
                if pe < 15:
                    score += 8.0; parts.append(("Valuation", f"P/E {pe}x (cheap)", "+8"))
                elif pe < 20:
                    score += 5.0; parts.append(("Valuation", f"P/E {pe}x (fair)", "+5"))
                elif pe < 30:
                    score += 1.0; parts.append(("Valuation", f"P/E {pe}x", "+1"))
                else:
                    score -= 6.0; parts.append(("Valuation", f"P/E {pe}x (expensive)", "-6"))
            if roe is not None and float(roe) != 0:
                if roe > 18:
                    score += 7.0; parts.append(("Returns", f"ROE {roe}% (excellent)", "+7"))
                elif roe > 12:
                    score += 5.0; parts.append(("Returns", f"ROE {roe}% (good)", "+5"))
                elif roe > 8:
                    score += 2.0; parts.append(("Returns", f"ROE {roe}%", "+2"))
                else:
                    score -= 2.0; parts.append(("Returns", f"ROE {roe}% (weak)", "-2"))
            if dy is not None and float(dy) > 0:
                if dy > 4:
                    score += 6.0; parts.append(("Income", f"Div yield {dy}%", "+6"))
                elif dy > 2.5:
                    score += 4.0; parts.append(("Income", f"Div yield {dy}%", "+4"))
                elif dy > 1.5:
                    score += 1.0; parts.append(("Income", f"Div yield {dy}%", "+1"))

    if sentiment:
        s_score = sentiment.get('score')
        if sentiment.get('available') and s_score is not None:
            effect = round(float(s_score) * 8.0, 1)
            score += effect
            parts.append(("News sentiment", f"{sentiment.get('label')} ({s_score:+})", f"{effect:+.1f}"))
        elif sentiment.get('newsCount'):
            parts.append(("News sentiment", "no recent news", "0"))

    if market_bias and market_bias.get('available'):
        effect = round(float(market_bias['bias']) * 2.0, 1)
        score += effect
        parts.append(("Market trend", f"NEPSE {market_bias['trend']} ({market_bias['changePct']:+}%)", f"{effect:+.1f}"))

    score = round(max(0.0, min(100.0, score)), 1)
    if score >= 70:
        verdict = "STRONG BUY"
    elif score >= 55:
        verdict = "BUY"
    elif score >= 45:
        verdict = "HOLD"
    elif score >= 30:
        verdict = "SELL"
    else:
        verdict = "STRONG SELL"

    return {"score": score, "verdict": verdict, "parts": parts}


def _f(v, default=0.0):
    try:
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default


def master_score(prediction=None, fundamentals=None, sentiment=None,
                 market_bias=None, sector_momentum=None):
    """
    Multi-factor Master Score on top of investment_rating():
      base rating (technical + valuation + quality + news + market bias)
      + sector rotation momentum, then explicit Safety and Upside sub-scores.

    Returns {score, verdict, parts, safetyScore, upsideScore, sector}.
    """
    base = investment_rating(prediction, fundamentals, sentiment, market_bias)
    score = float(base['score'])
    parts = list(base['parts'])

    sector = (fundamentals or {}).get('sector') or 'Others'
    sm = None
    if sector_momentum and isinstance(sector_momentum, dict):
        sm = sector_momentum.get(sector) or sector_momentum.get('Others')
    sector_effect = 0.0
    if sm:
        mom = _f(sm.get('momentumScore'))
        sector_effect = round(max(-10.0, min(10.0, mom * 0.6)), 1)
        score += sector_effect
        parts.append((
            "Sector trend",
            f"{sector}: {sm.get('trend', 'NEUTRAL')} (20d {sm.get('ret20', 0):+.1f}%)",
            f"{sector_effect:+.1f}"
        ))

    # ── Safety sub-score: how likely the pick avoids a drawdown ───────────────
    safety = 50.0
    if fundamentals:
        eps = fundamentals.get('eps')
        if eps is not None and _f(eps) < 0:
            safety -= 25.0
        roe = _f(fundamentals.get('roe'))
        if roe > 18:
            safety += 15.0
        elif roe > 12:
            safety += 10.0
        pe = _f(fundamentals.get('peRatio'))
        if 0 < pe < 15:
            safety += 8.0
        elif pe >= 30:
            safety -= 10.0
        if _f(fundamentals.get('dividendYield')) > 3:
            safety += 5.0
    if prediction:
        sig = prediction.get('signal')
        conf = _f(prediction.get('confidenceScore'))
        if sig == 'BEARISH':
            safety -= 8.0 + conf / 20.0
        elif sig == 'BULLISH':
            safety += 5.0
    if sentiment and sentiment.get('available'):
        safety += max(-10.0, min(10.0, _f(sentiment.get('score')) * 10.0))
    if market_bias and market_bias.get('available'):
        if market_bias.get('trend') == 'FALLING':
            safety -= 5.0
    if sm:
        if sm.get('trend') == 'WEAKENING':
            safety -= 8.0
        elif sm.get('trend') == 'STRENGTHENING':
            safety += 5.0
    safety = round(max(0.0, min(100.0, safety)), 1)

    # ── Upside sub-score: return potential from trend + valuation + rotation ──
    upside = 50.0
    if prediction:
        sig = prediction.get('signal')
        conf = _f(prediction.get('confidenceScore'))
        if sig == 'BULLISH':
            upside += 15.0 + conf / 10.0
        elif sig == 'BEARISH':
            upside -= 12.0
    pe = _f((fundamentals or {}).get('peRatio'))
    if 0 < pe < 15:
        upside += 10.0
    elif pe >= 30:
        upside -= 8.0
    if _f((fundamentals or {}).get('roe')) > 12:
        upside += 5.0
    if market_bias and market_bias.get('available'):
        upside += max(-6.0, min(6.0, _f(market_bias.get('bias')) * 2.0))
    if sm:
        upside += max(-10.0, min(10.0, _f(sm.get('momentumScore')) * 0.7))
    if sentiment and sentiment.get('available'):
        upside += max(-8.0, min(8.0, _f(sentiment.get('score')) * 8.0))
    upside = round(max(0.0, min(100.0, upside)), 1)

    score = round(max(0.0, min(100.0, score)), 1)
    verdict = ("STRONG BUY" if score >= 70 else
               "BUY" if score >= 55 else
               "HOLD" if score >= 45 else
               "SELL" if score >= 30 else "STRONG SELL")

    return {
        "score": score,
        "verdict": verdict,
        "parts": parts,
        "safetyScore": safety,
        "upsideScore": upside,
        "sector": sector,
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
