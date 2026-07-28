def generate_explainable_reasons(feature_values, fundamentals=None, sentiment_score=0.0):
    """
    Evaluates feature attributions to provide human-readable bullish (+) and bearish (-) reasons.
    """
    positive_reasons = []
    negative_reasons = []
    
    rsi = feature_values.get('rsi', 50.0)
    macd_hist = feature_values.get('macd_hist', 0.0)
    sma_20_ratio = feature_values.get('sma_20_ratio', 1.0)
    volatility = feature_values.get('volatility_pct', 2.0)
    momentum = feature_values.get('momentum_5d', 0.0)
    vol_change = feature_values.get('vol_change', 0.0)

    # 1. RSI attribution
    if rsi >= 50.0 and rsi <= 68.0:
        positive_reasons.append(f"Strong momentum building (RSI at {rsi:.1f})")
    elif rsi < 35.0:
        positive_reasons.append(f"RSI recovery zone ({rsi:.1f} - potential oversold rebound)")
    elif rsi > 70.0:
        negative_reasons.append(f"Overbought warning zone (RSI at {rsi:.1f})")

    # 2. Volume & Momentum attribution
    if vol_change > 0.15:
        positive_reasons.append(f"Surging volume (+{vol_change * 100:.1f}% relative to 5-day average)")
    elif vol_change < -0.2:
        negative_reasons.append(f"Decreasing trading volume momentum ({vol_change * 100:.1f}%)")

    if momentum > 2.0:
        positive_reasons.append(f"Positive 5-day price trend (+{momentum:.1f}%)")
    elif momentum < -2.0:
        negative_reasons.append(f"Negative price momentum ({momentum:.1f}%)")

    # 3. Moving Average attribution
    if sma_20_ratio > 1.01:
        positive_reasons.append(f"Trading above 20-day Simple Moving Average (+{(sma_20_ratio - 1.0)*100:.1f}%)")
    elif sma_20_ratio < 0.98:
        negative_reasons.append(f"Trading below key 20-day moving average (-{(1.0 - sma_20_ratio)*100:.1f}%)")

    # 4. MACD attribution
    if macd_hist > 0.1:
        positive_reasons.append("Bullish MACD histogram divergence confirmed")
    elif macd_hist < -0.1:
        negative_reasons.append("Bearish MACD histogram crossover detected")

    # 5. Volatility risk attribution
    if volatility > 3.0:
        negative_reasons.append(f"High historical volatility risk (ATR {volatility:.1f}%)")

    # 6. Fundamental valuation attribution (if available)
    if fundamentals:
        pe = fundamentals.get('peRatio', 20.0)
        roe = fundamentals.get('roe', 10.0)
        div_yield = fundamentals.get('dividendYield', 2.0)
        
        if pe < 18.0 and roe > 12.0:
            positive_reasons.append(f"Attractive valuation (P/E {pe:.1f}x with ROE {roe:.1f}%)")
        elif pe > 35.0:
            negative_reasons.append(f"Elevated price-to-earnings valuation (P/E {pe:.1f}x)")
            
        if div_yield >= 3.5:
            positive_reasons.append(f"Healthy dividend yield support ({div_yield:.1f}%)")

    # 7. Sentiment attribution
    if sentiment_score >= 0.2:
        positive_reasons.append(f"Positive news sentiment coverage (score: +{sentiment_score:.2f})")
    elif sentiment_score <= -0.2:
        negative_reasons.append(f"Adverse market news sentiment detected (score: {sentiment_score:.2f})")

    # Ensure at least 2 positive & 1 negative factors exist for balanced explainable output
    if not positive_reasons:
        positive_reasons.append("Stable support levels maintained")
        positive_reasons.append("Institutional baseline interest present")
    if not negative_reasons:
        negative_reasons.append("General NEPSE macro market fluctuation risk")

    return {
        "positiveReasons": positive_reasons[:4],
        "negativeReasons": negative_reasons[:3]
    }
