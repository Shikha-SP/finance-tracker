def generate_explainable_reasons(feature_values, fundamentals=None, sentiment_score=0.0):
    """
    Builds human-readable bullish (+) and bearish (-) reasons from the real
    technical scores and MeroLagani fundamentals.
    """
    positive_reasons = []
    negative_reasons = []

    rsi = feature_values.get('rsi', 50.0)
    macd_hist = feature_values.get('macd_hist', 0.0)
    sma_20_ratio = feature_values.get('sma_20_ratio', 1.0)
    sma_50_ratio = feature_values.get('sma_50_ratio', 1.0)
    volatility = feature_values.get('volatility_pct', 2.0)
    momentum = feature_values.get('momentum_5d', 0.0)
    vol_change = feature_values.get('vol_change', 0.0)

    # 1. Trend attribution (vs real moving averages)
    if sma_20_ratio > 1.01:
        positive_reasons.append(f"Trading above 20-day SMA (+{(sma_20_ratio - 1.0) * 100:.1f}%)")
    elif sma_20_ratio < 0.98:
        negative_reasons.append(f"Trading below 20-day SMA ({(1.0 - sma_20_ratio) * 100:.1f}% under)")

    if sma_50_ratio > 1.01:
        positive_reasons.append(f"Trading above 50-day SMA (+{(sma_50_ratio - 1.0) * 100:.1f}%)")
    elif sma_50_ratio < 0.98:
        negative_reasons.append(f"Trading below 50-day SMA ({(1.0 - sma_50_ratio) * 100:.1f}% under)")

    # 2. Momentum attribution
    if momentum > 2.0:
        positive_reasons.append(f"Positive 5-day price trend (+{momentum:.1f}%)")
    elif momentum < -2.0:
        negative_reasons.append(f"Negative 5-day price trend ({momentum:.1f}%)")

    # 3. MACD attribution
    if macd_hist > 0:
        positive_reasons.append("Bullish MACD histogram (momentum expanding upward)")
    elif macd_hist < 0:
        negative_reasons.append("Bearish MACD histogram (momentum expanding downward)")

    # 4. RSI attribution
    if 55.0 <= rsi <= 70.0:
        positive_reasons.append(f"Strong momentum building (RSI at {rsi:.1f})")
    elif rsi < 30.0:
        positive_reasons.append(f"Oversold zone (RSI at {rsi:.1f}) - potential mean-reversion bounce")
    elif rsi > 70.0:
        negative_reasons.append(f"Overbought zone (RSI at {rsi:.1f}) - pullback risk")

    # 5. Volume attribution
    if vol_change > 0.15:
        positive_reasons.append(f"Volume expanding (+{vol_change * 100:.1f}% vs 20-day average)")
    elif vol_change < -0.2:
        negative_reasons.append(f"Volume contracting ({vol_change * 100:.1f}% vs 20-day average)")

    # 6. Volatility risk
    if volatility > 3.0:
        negative_reasons.append(f"High volatility risk (ATR {volatility:.1f}%)")

    # 7. Fundamental valuation (real MeroLagani data)
    if fundamentals:
        pe = fundamentals.get('peRatio')
        roe = fundamentals.get('roe')
        div_yield = fundamentals.get('dividendYield')
        if pe is not None and 0 < pe < 18.0 and (roe is None or roe > 12.0):
            positive_reasons.append(f"Attractive valuation (P/E {pe:.1f}x with ROE {roe:.1f}%)")
        elif pe is not None and pe < 0:
            negative_reasons.append(f"Loss-making company (negative P/E of {pe:.1f}x)")
        elif pe is not None and pe > 40.0:
            negative_reasons.append(f"Elevated price-to-earnings valuation (P/E {pe:.1f}x)")
        if div_yield is not None and div_yield >= 3.0:
            positive_reasons.append(f"Healthy dividend yield support ({div_yield:.1f}%)")

    # 8. Sentiment attribution (only counts when real articles were found)
    if sentiment_score >= 0.2:
        positive_reasons.append(f"Positive news sentiment coverage (score: +{sentiment_score:.2f})")
    elif sentiment_score <= -0.2:
        negative_reasons.append(f"Adverse news sentiment detected (score: {sentiment_score:.2f})")

    if not positive_reasons:
        positive_reasons.append("No positive technical factors detected on current real data")
    if not negative_reasons:
        negative_reasons.append("No major negative technical signals on current real data")

    return {
        "positiveReasons": positive_reasons[:4],
        "negativeReasons": negative_reasons[:3]
    }
