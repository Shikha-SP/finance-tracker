import os
import sys
import pandas as pd
from dotenv import load_dotenv

# Load environment variables (e.g. GROQ_API_KEY)
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

# Local imports
from data_collector import (
    fetch_price_history_csv, get_company_fundamentals, get_news_sentiment,
    get_symbol_ohlcv, background_refresh, relative_time, get_market_bias, get_sector_momentum
)
from indicators import compute_all_indicators, compute_support_resistance, project_trend
from ml_model import classifier, investment_rating, master_score
from explainer import generate_explainable_reasons
from backtester import run_strategy_backtest
from rag_processor import rag_processor

app = FastAPI(
    title="NEPSE Intelligence AI Engine",
    description="Explainable AI Financial Decision Support System APIs for NEPSE",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import threading

def _startup_background_refresh():
    """Refreshes the full price CSV + fundamentals cache without blocking requests."""
    def worker():
        try:
            background_refresh()
        except Exception as e:
            print(f"[Startup] Background refresh error: {e}")
    threading.Thread(target=worker, daemon=True).start()

@app.on_event("startup")
def _on_startup():
    _startup_background_refresh()

class BacktestRequest(BaseModel):
    symbol: Optional[str] = "NABIL"
    initialCapital: Optional[float] = 100000.0
    minConfidence: Optional[float] = 60.0

class RAGQueryRequest(BaseModel):
    symbol: Optional[str] = None
    query: str
    groqApiKey: Optional[str] = None

@app.get("/")
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "NEPSE Intelligence Python AI Engine", "port": 8000}

@app.get("/api/v1/ai/analyze/{symbol}")
def analyze_company(symbol: str):
    clean_sym = symbol.upper().strip()
    
    # 1. Fetch the freshest price history for this symbol (live NEPSE API first,
    #    bundled CSV as fallback) & calculate indicators.
    sym_df = get_symbol_ohlcv(clean_sym)

    if len(sym_df) < 5:
        # Fallback to a default symbol with enough history.
        fallback = get_symbol_ohlcv('NABIL')
        if len(fallback) > len(sym_df):
            sym_df = fallback

    sym_df = sym_df.sort_values('date').reset_index(drop=True)
    df_indicators = compute_all_indicators(sym_df)
    latest_date = str(sym_df['date'].iloc[-1])[:10] if len(sym_df) else None
    
    # 1b. Support/Resistance levels, trend projection and market-wide bias
    sr_levels = compute_support_resistance(sym_df)
    trend_projection = project_trend(sym_df)
    market = get_market_bias()
    
    # 2. News & Sentiment (cache-first; fetches live only when no usable cache)
    sentiment_data = get_news_sentiment(clean_sym, use_cache_only=False)
    avg_sentiment = sentiment_data.get('score') or 0.0
    news_items = sentiment_data.get('articles') or []
    
    # 3. Machine Learning Movement Probability Prediction
    prediction = classifier.predict_movement_probabilities(df_indicators, sentiment_score=avg_sentiment)
    
    # 4. Fundamental Metrics
    fundamentals = get_company_fundamentals(clean_sym)
    
    # 5. SHAP Explainability Reasons
    feature_vals = prediction.get('featureValues', {})
    reasons = generate_explainable_reasons(feature_vals, fundamentals=fundamentals, sentiment_score=avg_sentiment)

    # 6. Single combined investment rating (technical + fundamental + sentiment + market)
    sector_momentum = get_sector_momentum()
    rating = master_score(prediction, fundamentals, sentiment_data,
                          market_bias=market, sector_momentum=sector_momentum)
    
    # Format OHLC history for chart rendering
    history_records = []
    recent_rows = df_indicators.tail(90)
    for _, row in recent_rows.iterrows():
        raw_vol = row.get('volume', 0)
        vol_val = int(float(raw_vol)) if pd.notnull(raw_vol) else 0
        history_records.append({
            "date": str(row['date'])[:10],
            "open": round(float(row['open']), 2),
            "high": round(float(row['high']), 2),
            "low": round(float(row['low']), 2),
            "close": round(float(row['close']), 2),
            "volume": vol_val,
            "rsi": round(float(row.get('rsi', 50.0)), 2),
            "macd": round(float(row.get('macd', 0.0)), 2),
            "macdSignal": round(float(row.get('macd_signal', 0.0)), 2),
            "sma20": round(float(row.get('sma_20', row['close'])), 2),
            "sma50": round(float(row.get('sma_50', row['close'])), 2)
        })

    latest_bar = recent_rows.iloc[-1]

    sector_mom = sector_momentum.get(fundamentals['sector']) or sector_momentum.get('Others')

    return {
        "symbol": clean_sym,
        "companyName": fundamentals['name'],
        "sector": fundamentals['sector'],
        "currentPrice": round(float(latest_bar['close']), 2),
        "asOf": latest_date,
        "prediction": {
            "bullishProb": prediction['bullishProb'],
            "neutralProb": prediction['neutralProb'],
            "bearishProb": prediction['bearishProb'],
            "signal": prediction['signal'],
            "confidenceScore": prediction['confidenceScore']
        },
        "investmentRating": rating,
        "safetyScore": rating.get('safetyScore'),
        "upsideScore": rating.get('upsideScore'),
        "sectorMomentum": sector_mom,
        "explainableAI": reasons,
        "fundamentals": fundamentals,
        "sentiment": {
            "score": round(avg_sentiment, 2),
            "label": "BULLISH" if avg_sentiment > 0.1 else ("BEARISH" if avg_sentiment < -0.1 else "NEUTRAL"),
            "newsCount": sentiment_data.get('newsCount'),
            "lastNewsDate": sentiment_data.get('lastNewsDate'),
            "lastNewsAgo": sentiment_data.get('lastNewsAgo'),
            "recent": sentiment_data.get('recent'),
            "sentimentModel": sentiment_data.get('sentimentModel'),
            "topKeywords": sentiment_data.get('topKeywords'),
            "articles": [
                {**item, "publishedAgo": relative_time(item.get('pubDate'))}
                for item in news_items
            ]
        },
        "supportResistance": sr_levels,
        "trendProjection": trend_projection,
        "marketBias": market,
        "technicalIndicators": {
            "rsi": round(float(latest_bar.get('rsi', 50.0)), 2),
            "macd": round(float(latest_bar.get('macd', 0.0)), 2),
            "macdSignal": round(float(latest_bar.get('macd_signal', 0.0)), 2),
            "sma20": round(float(latest_bar.get('sma_20', latest_bar['close'])), 2),
            "sma50": round(float(latest_bar.get('sma_50', latest_bar['close'])), 2),
            "volatilityPct": round(float(latest_bar.get('volatility_pct', 1.5)), 2)
        },
        "chartData": history_records
    }

@app.get("/api/v1/screener")
def stock_screener(
    sector: Optional[str] = "ALL",
    minRsi: Optional[float] = 0.0,
    maxRsi: Optional[float] = 100.0,
    maxPe: Optional[float] = 100.0,
    minDiv: Optional[float] = 0.0,
    minConfidence: Optional[float] = 0.0,
    minSentiment: Optional[float] = 0.0,
    strategy: Optional[str] = "both",     # fundamental | technical | both
    top: Optional[int] = 5
):
    """
    Two-round stock selection pipeline:
      Round 1 FUNDAMENTAL : positive P/E within the chosen cap, positive ROE & EPS,
                            dividend >= minDiv. (skipped entirely in technical mode)
      Round 2 TECHNICAL   : price above SMA20, RSI not overbought, not sitting at
                            resistance. (skipped entirely in fundamental mode)
    - strategy=both      -> must clear BOTH rounds, ranked by the combined rating.
    - strategy=fundamental -> only the fundamental round, ranked by fundamental score.
    - strategy=technical   -> only the technical round, ranked by technical score.
    Returns topPicks (best to buy right now) plus the full filtered screener table.
    """
    df_raw = fetch_price_history_csv()
    market = get_market_bias()
    sector_momentum = get_sector_momentum()
    results = []
    
    # Get list of all available symbols in dataset
    all_symbols = df_raw['symbol'].str.upper().unique() if 'symbol' in df_raw.columns else []
    
    for sym in all_symbols:
        # use_cache_only: real name/sector come from NEPSE company metadata; numeric
        # ratios come from the local DB/cache. No per-symbol network scraping (too slow).
        meta = get_company_fundamentals(sym, use_cache_only=True)
        if sector != "ALL" and meta.get('sector', '').lower() != sector.lower():
            continue
            
        pe = meta.get('peRatio')
        div = meta.get('dividendYield')
        roe = meta.get('roe')
        eps = meta.get('eps')
        if pe is not None and pe > maxPe:
            continue
        if div is not None and div < minDiv:
            continue

        # ── ROUND 1: FUNDAMENTAL screen ──
        fundamental_pass = True
        fundamental_reasons = []
        if strategy in ('fundamental', 'both'):
            if pe is None or pe <= 0:
                fundamental_pass = False
            elif roe is None or roe <= 0:
                fundamental_pass = False
            if eps is not None and float(eps) < 0:
                fundamental_pass = False
            if fundamental_pass:
                fundamental_reasons = [f"P/E {pe}x", f"ROE {roe}%", f"Div yield {div}%"]
            
        sym_df = df_raw[df_raw['symbol'].str.upper() == sym] if 'symbol' in df_raw.columns else pd.DataFrame()
        if len(sym_df) < 5:
            continue
            
        df_ind = compute_all_indicators(sym_df.sort_values('date'))
        latest = df_ind.iloc[-1]
        rsi = float(latest.get('rsi', 50.0))
        
        if rsi < minRsi or rsi > maxRsi:
            continue
            
        pred = classifier.predict_movement_probabilities(df_ind, cache_key=sym)
        if pred['confidenceScore'] < minConfidence:
            continue

        # News sentiment from on-disk cache (fast, no network per symbol)
        sent = get_news_sentiment(sym, use_cache_only=True)
        if minSentiment and sent.get('score') is not None and sent['score'] < minSentiment:
            continue

        sr = compute_support_resistance(sym_df)
        proj = project_trend(sym_df)

        # ── ROUND 2: TECHNICAL screen ──
        technical_pass = True
        technical_reasons = []
        close = float(latest.get('close', 0))
        sma20 = float(latest.get('sma_20', close)) or close
        if strategy in ('technical', 'both'):
            issues = []
            if close < sma20:
                issues.append("price below SMA20")
            if rsi > 70:
                issues.append("overbought")
            if sr and sr.get('nearResistance'):
                issues.append("at resistance")
            technical_pass = len(issues) == 0
            technical_reasons = issues or ["price> SMA20", "RSI not overbought", "below resistance"]

        # Strategy gating (only both requires every round)
        if strategy == 'both' and (not fundamental_pass or not technical_pass):
            continue
        if strategy == 'fundamental' and not fundamental_pass:
            continue
        if strategy == 'technical' and not technical_pass:
            continue

        # Scores: pure technical, pure fundamental and combined (for ranking)
        sector_mom = sector_momentum.get(meta.get('sector', 'Others')) or sector_momentum.get('Others')
        rating_fund = master_score(None, meta, sent, market_bias=market, sector_momentum=None)
        rating_tech = master_score(pred, None, None, market_bias=None, sector_momentum=None)
        rating = master_score(pred, meta, sent, market_bias=market, sector_momentum=sector_momentum)
        if strategy == 'fundamental':
            sort_score = rating_fund['score']
        elif strategy == 'technical':
            sort_score = rating_tech['score']
        else:
            sort_score = rating['score']

        passed = []
        if fundamental_pass:
            passed.append("Fundamental")
        if technical_pass:
            passed.append("Technical")
            
        results.append({
            "symbol": sym,
            "name": meta.get('name', sym),
            "sector": meta.get('sector', 'Equity'),
            "price": round(close, 2),
            "rsi": round(rsi, 1),
            "peRatio": meta.get('peRatio'),
            "dividendYield": meta.get('dividendYield'),
            "marketCap": meta.get('marketCap'),
            "aiSignal": pred['signal'],
            "bullishProb": pred['bullishProb'],
            "confidenceScore": pred['confidenceScore'],
            "sentimentScore": sent.get('score'),
            "sentimentLabel": sent.get('label'),
            "sentimentModel": sent.get('sentimentModel'),
            "topKeywords": sent.get('topKeywords'),
            "newsCount": sent.get('newsCount'),
            "lastNewsDate": sent.get('lastNewsDate'),
            "lastNewsAgo": sent.get('lastNewsAgo'),
            "rating": rating['score'],
            "ratingVerdict": rating['verdict'],
            "ratingParts": rating['parts'],
            "safetyScore": rating.get('safetyScore'),
            "upsideScore": rating.get('upsideScore'),
            "sectorMomentum": sector_mom,
            "sortScore": round(sort_score, 1),
            "passedRounds": passed,
            "fundamentalPass": fundamental_pass,
            "fundamentalReasons": fundamental_reasons,
            "technicalPass": technical_pass,
            "technicalReasons": technical_reasons,
            "support": (sr or {}).get('support'),
            "resistance": (sr or {}).get('resistance'),
            "pivot": (sr or {}).get('pivot'),
            "positionPct": (sr or {}).get('positionPct'),
            "rangePct": (sr or {}).get('rangePct'),
            "nearResistance": (sr or {}).get('nearResistance'),
            "nearSupport": (sr or {}).get('nearSupport'),
            "projection": proj
        })
    
    results.sort(key=lambda r: r['sortScore'], reverse=True)
    top_picks = results[:top]
        
    return {
        "count": len(results),
        "strategy": strategy,
        "marketBias": market,
        "sectorMomentum": sector_momentum,
        "topPicks": top_picks,
        "screenerResults": results
    }

@app.post("/api/v1/backtest")
def backtest_strategy(req: BacktestRequest):
    df_raw = fetch_price_history_csv()
    sym_df = df_raw[df_raw['symbol'].str.upper() == req.symbol.upper()] if 'symbol' in df_raw.columns else pd.DataFrame()
    if len(sym_df) < 20:
        sym_df = df_raw
    df_ind = compute_all_indicators(sym_df.sort_values('date'))
    result = run_strategy_backtest(df_ind, initial_capital=req.initialCapital, min_confidence=req.minConfidence)
    return result

@app.post("/api/v1/rag/query")
def query_rag_assistant(req: RAGQueryRequest):
    res = rag_processor.query_financial_document(
        req.query,
        groq_api_key=req.groqApiKey,
        symbol=req.symbol,
    )
    return res

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
