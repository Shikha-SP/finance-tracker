"""
Forward-test log: the honest, going-forward proof of whether the AI ratings
predict returns.

Every time the app issues a real rating (analyze or screener) it records one
row per symbol per trading date: {date, symbol, verdict, score}. Later, when
enough real sessions have passed, we look up what ACTUALLY happened to each
symbol's price after the signal date and report realized 5/10/20-day returns,
averaged per verdict, vs the all-symbols baseline.

This is different from the historical walk-forward validation: those numbers
were computed from the past. This log accumulates from today onward, so the
edge we claim gets tested in real time and the scorecard stays honest.
"""
import json
import os
import threading

from data_collector import fetch_price_history_csv, DATA_DIR

LOG_DIR = os.path.join(DATA_DIR, "ai")
LOG_FILE = os.path.join(LOG_DIR, "forward_signals.json")

_lock = threading.Lock()

ORDER = ("STRONG BUY", "BUY", "HOLD", "SELL", "STRONG SELL")
HORIZONS = (5, 10, 20)


def _load():
    if not os.path.exists(LOG_FILE):
        return []
    try:
        with open(LOG_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _save(rows):
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        with open(LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(rows, f)
    except OSError:
        pass


def record_signal(symbol, date, verdict, score):
    """
    Record a real rating issued today. One entry per (date, symbol) so a
    symbol rated 50 times in a single screener run only counts once.
    Returns True if a new signal was recorded.
    """
    if not symbol or not date or not verdict:
        return False
    sym = str(symbol).upper().strip()
    day = str(date)[:10]
    with _lock:
        rows = _load()
        for r in rows:
            if r.get("date") == day and r.get("symbol") == sym:
                return False
        rows.append({"date": day, "symbol": sym, "verdict": verdict, "score": float(score or 0)})
        _save(rows)
        return True


def get_forward_test():
    """Compute realized forward returns for logged signals vs baseline.

    Returns a dict suitable for the scorecard:
      - status: 'collecting' (not enough matured signals yet) or 'ready'
      - total: signals logged
      - matured: signals whose horizon has fully elapsed
      - pending: signals still waiting for enough sessions
      - horizons: per-horizon verdict buckets + baseline
      - note: plain-language guidance
    """
    rows = _load()
    if not rows:
        return {
            "status": "collecting",
            "total": 0, "matured": 0, "pending": 0,
            "horizons": [],
            "note": "No forward signals logged yet — they accumulate from today onward.",
        }

    df = fetch_price_history_csv()
    if df is None or len(df) < 10:
        return {"status": "error", "message": "No price history to measure forward returns."}

    sym_col = 'symbol'
    df[sym_col] = df[sym_col].astype(str).str.upper()
    # Index closes by (symbol, date-index) for fast lookups.
    closes_by_sym = {}
    for sym, sub in df.groupby(sym_col):
        sub = sub.dropna(subset=['close']).sort_values('date').reset_index(drop=True)
        closes_by_sym[sym] = (sub['date'].astype(str).str[:10].tolist(), sub['close'].astype(float).tolist())

    buckets = {h: {} for h in HORIZONS}
    baseline = {h: {"n": 0, "ret_sum": 0.0} for h in HORIZONS}
    matured_total = 0
    pending_total = 0

    for r in rows:
        days = closes_by_sym.get(r.get("symbol"))
        if not days:
            continue
        dates, closes = days
        try:
            i = dates.index(str(r.get("date"))[:10])
        except ValueError:
            continue
        base = closes[i]
        if base <= 0:
            continue
        for h in HORIZONS:
            j = i + h
            if j < len(closes) and closes[j] > 0:
                fwd = (closes[j] / base - 1.0) * 100.0
                b = buckets[h].setdefault(r["verdict"], {"n": 0, "ret_sum": 0.0})
                b["n"] += 1
                b["ret_sum"] += fwd
                bl = baseline[h]
                bl["n"] += 1
                bl["ret_sum"] += fwd
                if h == max(HORIZONS):
                    matured_total += 1
            else:
                if h == min(HORIZONS):
                    pending_total += 1

    horizons_out = []
    for h in HORIZONS:
        bl = baseline[h]
        bl_avg = (bl["ret_sum"] / bl["n"]) if bl["n"] else 0.0
        verdicts = []
        for v in ORDER:
            b = buckets[h].get(v)
            if not b or b["n"] == 0:
                continue
            verdicts.append({
                "verdict": v,
                "count": b["n"],
                "avgReturn": round(b["ret_sum"] / b["n"], 2),
                "betterThanBaseline": round(b["ret_sum"] / b["n"] - bl_avg, 2),
            })
        horizons_out.append({
            "days": h,
            "verdicts": verdicts,
            "baselineAvgReturn": round(bl_avg, 2),
        })

    enough = matured_total >= 20
    status = "ready" if enough else "collecting"
    if not enough:
        note = (
            f"Still collecting live evidence — {matured_total} of the signals logged so far have "
            f"had enough trading sessions to measure. As more real sessions pass, this becomes the "
            f"honest live proof of whether the ratings edge holds."
        )
    else:
        note = (
            "Live forward test: these are ratings the app actually issued, measured against what "
            "the market did afterward. Real-time evidence, not history replays."
        )

    return {
        "status": status,
        "total": len(rows),
        "matured": matured_total,
        "pending": pending_total,
        "horizons": horizons_out,
        "note": note,
    }
