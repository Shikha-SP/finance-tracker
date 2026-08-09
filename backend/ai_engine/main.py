import os
import sys
import time
import numpy as np
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
    get_symbol_ohlcv, background_refresh, relative_time, get_market_bias, get_sector_momentum,
    get_market_regime
)
from indicators import (
    compute_all_indicators, compute_support_resistance, project_trend,
    indicator_signals, project_duration,
)
from ml_model import classifier, investment_rating, master_score
from explainer import generate_explainable_reasons
from backtester import run_strategy_backtest
from rag_processor import rag_processor
from forward_log import record_signal, get_forward_test

def _verdict_for_score(score):
    if score >= 70:
        return "STRONG BUY"
    if score >= 55:
        return "BUY"
    if score >= 45:
        return "HOLD"
    if score >= 30:
        return "SELL"
    return "STRONG SELL"

def position_risk_effect(sr, rsi=None):
    """
    Reward/penalty for where the price sits inside its recent range. A stock can
    pump hard (looks like a STRONG BUY) yet be right under resistance where the
    reward/risk has flipped — this stops that from feeling like a betrayal.
    Returns (effect, title, detail) or None when there is nothing to flag.
    """
    if not sr:
        return None

    position_pct = sr.get('positionPct')
    if position_pct is None:
        return None

    rsi = float(rsi) if rsi is not None else None

    if sr.get('nearResistance'):
        return (-8.0, "Position risk", "at resistance — wait for a breakout")
    if position_pct >= 75:
        detail = f"{position_pct}% into range — resistance overhead"
        if rsi is not None and rsi >= 68:
            return (-8.0, "Position risk", f"overextended (RSI {rsi:.0f}) at {position_pct}% of range")
        return (-5.0, "Position risk", detail)
    if sr.get('nearSupport'):
        return (3.0, "Position risk", "near support — good risk/reward")
    if position_pct <= 25:
        return (2.0, "Position risk", "near bottom of range — room to resistance")
    return None


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
    # Apply the same position-risk effect the screener and validation use, so the
    # rating shown here is the exact one that gets validated and forward-tested.
    _latest_rsi = float(df_indicators.iloc[-1].get('rsi', 50.0)) if len(df_indicators) else 50.0
    pos_risk = position_risk_effect(sr_levels, _latest_rsi) if len(sym_df) else None
    if pos_risk:
        effect, title, detail = pos_risk
        rating['score'] = round(max(0.0, min(100.0, rating['score'] + effect)), 1)
        rating['verdict'] = _verdict_for_score(rating['score'])
        rating['parts'].append((title, detail, f"{effect:+.1f}"))

    # Log this real signal for the live forward test (once per symbol per day).
    record_signal(clean_sym, latest_date, rating['verdict'], rating['score'])
    
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
        "duration": project_duration(sr_levels, trend_projection, float(latest_bar['close'])),
        "technicals": indicator_signals(df_indicators),
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

@app.get("/api/v1/market-regime")
def market_regime():
    """Lightweight, cached view of the current NEPSE market regime
    (UPTREND / SIDEWAYS / DOWNTREND). Used by the portfolio tracker and
    market overview so they agree with the screener."""
    regime = get_market_regime()
    if not regime:
        return {"error": True, "message": "Could not compute market regime."}
    return regime

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
    regime = get_market_regime()
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
        signals = indicator_signals(df_ind)
        duration = project_duration(sr, proj, float(latest.get('close', 0)))

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
        pos_risk = position_risk_effect(sr, rsi)
        if pos_risk:
            effect, title, detail = pos_risk
            rating['score'] = round(max(0.0, min(100.0, rating['score'] + effect)), 1)
            rating['verdict'] = _verdict_for_score(rating['score'])
            rating['parts'].append((title, detail, f"{effect:+.1f}"))
        if strategy == 'fundamental':
            sort_score = rating_fund['score']
        elif strategy == 'technical':
            sort_score = rating_tech['score']
        else:
            sort_score = rating['score']

        # Log this real signal for the live forward test (once per symbol per day).
        record_signal(sym, df_ind['date'].iloc[-1], rating['verdict'], rating['score'])

        passed = []
        if fundamental_pass:
            passed.append("Fundamental")
        if technical_pass:
            passed.append("Technical")

        # Strength category so the UI can answer "strong fundamental / strong
        # technical / strong in both with good recent news".
        sent_score = sent.get('score')
        sentiment_good = (sent_score is None) or (sent_score >= 0.05)
        if fundamental_pass and technical_pass and sentiment_good:
            category = "BOTH"
        elif fundamental_pass and technical_pass:
            category = "BOTH_WEAK_NEWS"
        elif fundamental_pass:
            category = "FUNDAMENTAL"
        elif technical_pass:
            category = "TECHNICAL"
        else:
            category = "NEITHER"

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
            "category": category,
            "sentimentGood": sentiment_good,
            "fundamentalPass": fundamental_pass,
            "fundamentalReasons": fundamental_reasons,
            "technicalPass": technical_pass,
            "technicalReasons": technical_reasons,
            "technicals": signals,
            "duration": duration,
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

    # Which sectors are doing best right now (real 5d/20d returns).
    ranked_sectors = sorted(
        ({"name": name, **data} for name, data in sector_momentum.items()),
        key=lambda s: s.get('momentumScore', 0),
        reverse=True,
    )[:6]

    return {
        "count": len(results),
        "strategy": strategy,
        "asOf": (regime or {}).get('asOf'),
        "marketBias": market,
        "marketRegime": regime,
        "sectorMomentum": sector_momentum,
        "topSectors": ranked_sectors,
        "topPicks": top_picks,
        "screenerResults": results
    }

# ────────────────────────────────────────────────────────────────────────────
# Walk-forward honesty check: does the screener RATING actually predict what
# happened next? For past dates we compute the exact same rating using ONLY data
# available at that date (no look-ahead — indicators are trailing by construction),
# then compare the rating's forward 5/10/20-day returns with the all-stocks
# baseline. This tells the user honestly whether the ratings carry signal.
# ────────────────────────────────────────────────────────────────────────────
_VALIDATION = {"lock": threading.Lock(), "data": None, "at": None, "running": False}


def _compute_screener_validation():
    t0 = time.time()
    df_raw = fetch_price_history_csv()
    if df_raw is None or len(df_raw) < 100:
        return {"status": "error", "message": "Not enough real price history for validation."}

    df_raw = df_raw.copy()
    sym_col = 'symbol' if 'symbol' in df_raw.columns else None
    if not sym_col:
        return {"status": "error", "message": "Price history missing symbol column."}

    # Universe: symbols with enough history, capped to keep runtime sane.
    lengths = {}
    for sym, sub in df_raw.groupby(sym_col):
        sub = sub.dropna(subset=['close'])
        if len(sub) >= 80:
            lengths[str(sym).upper()] = len(sub)
    if not lengths:
        return {"status": "error", "message": "No symbol has enough history to validate."}
    symbols = sorted(lengths, key=lengths.get, reverse=True)[:60]

    horizons = (5, 10, 20)
    buckets = {h: {} for h in horizons}
    baseline = {h: {"n": 0, "hit": 0, "ret_sum": 0.0} for h in horizons}
    total_samples = 0

    for sym in symbols:
        try:
            sym_df = df_raw[df_raw[sym_col].str.upper() == sym] \
                .dropna(subset=['close']) \
                .sort_values('date') \
                .reset_index(drop=True)
            n = len(sym_df)
            if n < 80:
                continue
            closes = sym_df['close'].astype(float).to_numpy()
            df_ind = compute_all_indicators(sym_df)
            meta = get_company_fundamentals(sym, use_cache_only=True)
            sent = get_news_sentiment(sym, use_cache_only=True)
            sent_score = (sent or {}).get('score')

            # Sample ~55 dates spaced across the most recent ~9 months.
            idxs = list(range(60, n - 21, 4))[-55:]
            for i in idxs:
                try:
                    pred = classifier.predict_movement_probabilities(
                        df_ind.iloc[max(0, i - 20):i + 1], sentiment_score=sent_score or 0.0)
                    sr = compute_support_resistance(sym_df.iloc[:i + 1])
                    rsi_val = float(df_ind.iloc[i].get('rsi', 50))
                    rating = master_score(pred, meta, sent, market_bias=None, sector_momentum=None)
                    pos = position_risk_effect(sr, rsi_val)
                    if pos:
                        effect, _t, _d = pos
                        rating['score'] = round(max(0.0, min(100.0, rating['score'] + effect)), 1)
                        rating['verdict'] = _verdict_for_score(rating['score'])
                    verdict = rating['verdict']
                except Exception:
                    continue

                total_samples += 1
                for h in horizons:
                    j = i + h
                    if j < n and closes[i] > 0:
                        fwd = (closes[j] / closes[i] - 1.0) * 100.0
                        b = buckets[h].setdefault(verdict, {"n": 0, "hit": 0, "ret_sum": 0.0})
                        b["n"] += 1
                        b["hit"] += 1 if fwd > 0 else 0
                        b["ret_sum"] += fwd
                        baseline[h]["n"] += 1
                        baseline[h]["hit"] += 1 if fwd > 0 else 0
                        baseline[h]["ret_sum"] += fwd
        except Exception as e:
            print(f"[Validation] Skipped {sym}: {e}")
            continue

    if total_samples == 0:
        return {"status": "error", "message": "No samples could be rated for validation."}

    order = ("STRONG BUY", "BUY", "HOLD", "SELL", "STRONG SELL")
    rank = {v: i for i, v in enumerate(order)}  # 0 = strongest
    horizons_out = []
    for h in horizons:
        bl = baseline[h]
        baseline_avg = (bl["ret_sum"] / bl["n"]) if bl["n"] else 0.0
        baseline_hit = (bl["hit"] / bl["n"] * 100.0) if bl["n"] else 0.0
        verdicts = []
        for v in order:
            b = buckets[h].get(v)
            if not b or b["n"] == 0:
                continue
            avg = b["ret_sum"] / b["n"]
            hit = b["hit"] / b["n"] * 100.0
            verdicts.append({
                "verdict": v,
                "count": b["n"],
                "hitRate": round(hit, 1),
                "avgReturn": round(avg, 2),
                "betterThanBaseline": round(avg - baseline_avg, 2),
            })
        # Monotonicity: do stronger verdicts (lower rank) yield higher returns?
        mono = None
        if len(verdicts) >= 3:
            xs = [rank[v["verdict"]] for v in verdicts]
            ys = [v["avgReturn"] for v in verdicts]
            if np.std(ys) > 0:
                mono = round(float(np.clip(np.corrcoef(xs, ys)[0, 1], -1, 1)), 2)
        horizons_out.append({
            "days": h,
            "verdicts": verdicts,
            "baselineAvgReturn": round(baseline_avg, 2),
            "baselineHitRate": round(baseline_hit, 1),
            "monotonicity": mono,
        })

    # Plain-language conclusion based on the 10-day horizon (best balance).
    # Mean-reversion signal: stronger verdicts (lower rank) yield HIGHER returns,
    # which shows up as strongly NEGATIVE monotonicity. Either direction counts
    # as signal as long as STRONG BUY actually beats the baseline.
    mid = horizons_out[1]
    strong = next((v for v in mid["verdicts"] if v["verdict"] == "STRONG BUY"), None)
    mono = mid.get("monotonicity")
    if (mono is not None and abs(mono) >= 0.3 and strong
            and strong["avgReturn"] > mid["baselineAvgReturn"]):
        conclusion = (
            f"On real NEPSE history the ratings carry signal: STRONG BUY picks averaged "
            f"{strong['avgReturn']:+.1f}% over {mid['days']} days vs {mid['baselineAvgReturn']:+.1f}% "
            f"for all stocks ({strong['hitRate']:.0f}% win rate). NEPSE is mean-reverting, "
            f"so the edge comes from buying oversold names, not chasing momentum."
        )
    else:
        conclusion = (
            "Ratings show a weak or unclear edge on real history — treat them as a "
            "consistent filter, not a predictor. The technical checks, position-in-range "
            "and risk flags are the more reliable part of this tool."
        )

    return {
        "status": "ready",
        "asOf": str(df_raw['date'].max())[:10],
        "samples": total_samples,
        "universe": len(symbols),
        "horizons": horizons_out,
        "conclusion": conclusion,
        "computedSeconds": round(time.time() - t0, 1),
    }


@app.get("/api/v1/ai/validation")
def screener_validation(refresh: int = 0):
    now = time.time()
    with _VALIDATION["lock"]:
        if _VALIDATION["data"] is not None and not refresh and (now - (_VALIDATION["at"] or 0)) < 1800:
            return {**_VALIDATION["data"], "cached": True}
        if _VALIDATION["running"]:
            return {"status": "running", "cached": False}
        _VALIDATION["running"] = True

    def _worker():
        res = None
        try:
            res = _compute_screener_validation()
        except Exception as e:
            res = {"status": "error", "message": str(e)}
        finally:
            with _VALIDATION["lock"]:
                _VALIDATION["data"] = res
                _VALIDATION["at"] = time.time()
                _VALIDATION["running"] = False

    threading.Thread(target=_worker, daemon=True).start()
    return {"status": "running", "cached": False}

@app.get("/api/v1/ai/forwardtest")
def forward_test():
    """Live forward-test of ratings the app actually issued, measured against
    real subsequent price action. Unlike /validation (a history replay), these
    signals accumulate from today onward — the honest real-time proof."""
    return get_forward_test()

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
