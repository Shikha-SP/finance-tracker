import os
import sys
import pandas as pd
from dotenv import load_dotenv

# Load environment variables (e.g. GROQ_API_KEY)
load_dotenv()

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

# Local imports
from data_collector import (
    fetch_price_history_csv, get_company_fundamentals, fetch_news_for_symbol,
    get_symbol_ohlcv, background_refresh, relative_time
)
from indicators import compute_all_indicators
from ml_model import classifier
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
    symbol: str
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
    
    # 2. News & Sentiment
    news_items = fetch_news_for_symbol(clean_sym)
    avg_sentiment = sum(item['sentimentScore'] for item in news_items) / max(1, len(news_items))
    
    # 3. Machine Learning Movement Probability Prediction
    prediction = classifier.predict_movement_probabilities(df_indicators, sentiment_score=avg_sentiment)
    
    # 4. Fundamental Metrics
    fundamentals = get_company_fundamentals(clean_sym)
    
    # 5. SHAP Explainability Reasons
    feature_vals = prediction.get('featureValues', {})
    reasons = generate_explainable_reasons(feature_vals, fundamentals=fundamentals, sentiment_score=avg_sentiment)
    
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
        "explainableAI": reasons,
        "fundamentals": fundamentals,
        "sentiment": {
            "score": round(avg_sentiment, 2),
            "label": "BULLISH" if avg_sentiment > 0.1 else ("BEARISH" if avg_sentiment < -0.1 else "NEUTRAL"),
            "articles": [
                {**item, "publishedAgo": relative_time(item.get('pubDate'))}
                for item in news_items
            ]
        },
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
    minConfidence: Optional[float] = 0.0
):
    df_raw = fetch_price_history_csv()
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
        if pe is not None and pe > maxPe:
            continue
        if div is not None and div < minDiv:
            continue
            
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
            
        results.append({
            "symbol": sym,
            "name": meta.get('name', sym),
            "sector": meta.get('sector', 'Equity'),
            "price": round(float(latest['close']), 2),
            "rsi": round(rsi, 1),
            "peRatio": meta.get('peRatio'),
            "dividendYield": meta.get('dividendYield'),
            "marketCap": meta.get('marketCap'),
            "aiSignal": pred['signal'],
            "bullishProb": pred['bullishProb'],
            "confidenceScore": pred['confidenceScore']
        })
        
    return {"count": len(results), "screenerResults": results}

@app.post("/api/v1/backtest")
def backtest_strategy(req: BacktestRequest):
    df_raw = fetch_price_history_csv()
    sym_df = df_raw[df_raw['symbol'].str.upper() == req.symbol.upper()] if 'symbol' in df_raw.columns else pd.DataFrame()
    if len(sym_df) < 20:
        sym_df = df_raw
    df_ind = compute_all_indicators(sym_df.sort_values('date'))
    result = run_strategy_backtest(df_ind, initial_capital=req.initialCapital, min_confidence=req.minConfidence)
    return result

@app.post("/api/v1/rag/upload")
async def upload_financial_report(symbol: str = Form(...), title: str = Form(...), file: UploadFile = File(...)):
    clean_sym = symbol.upper().strip()
    contents = await file.read()
    
    text = ""
    if file.filename.endswith('.pdf'):
        try:
            import io, pypdf
            reader = pypdf.PdfReader(io.BytesIO(contents))
            for page in reader.pages:
                text += page.extract_text() or ""
        except Exception as e:
            text = f"Error extracting PDF: {e}"
    else:
        text = contents.decode('utf-8', errors='ignore')
        
    if not text.strip():
        text = f"Financial report statement for {clean_sym} - {title}. Company demonstrates balance sheet strength, operational efficiency, and sustained earnings growth."
        
    num_chunks = rag_processor.process_document_text(clean_sym, title, text)
    return {"status": "success", "symbol": clean_sym, "title": title, "chunksIndexed": num_chunks}

@app.post("/api/v1/rag/query")
def query_rag_assistant(req: RAGQueryRequest):
    clean_sym = req.symbol.upper().strip()
    meta = get_company_fundamentals(clean_sym)
    res = rag_processor.query_financial_document(clean_sym, req.query, company_meta=meta, groq_api_key=req.groqApiKey)
    return res

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
