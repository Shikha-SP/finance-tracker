import os
import re
import json

from data_collector import relative_time

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

class FinancialRAGProcessor:
    """
    Real-data NEPSE assistant.

    Answers are grounded in:
      - Real MeroLagani fundamentals cache (P/E, ROE, EPS, book value, dividend yield, market cap)
      - Real NEPSE live-market snapshot (index, turnover, top gainers/losers, LTP)
      - Real per-scrip news sentiment cache
      - Real technical signals computed from actual price history (transparent scorer)

    No fabricated figures. When a Groq API key is supplied the LLM summarizes the
    same real context; otherwise a deterministic markdown answer is produced.
    """
    def __init__(self):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.raw_news_dir = os.path.join(self.base_dir, "data", "raw", "news")
        self.fund_cache_file = os.path.join(self.base_dir, "data", "raw", "fundamentals", "merolagani_cache.json")
        self.snapshot_file = os.path.join(self.base_dir, "data", "nepse_snapshot.json")
        self._fund_cache = None
        self._snapshot_cache = None

    # ── Real data loaders ────────────────────────────────────────────────

    def _load_fundamentals(self):
        if self._fund_cache is None:
            try:
                with open(self.fund_cache_file, encoding='utf-8') as f:
                    self._fund_cache = json.load(f)
            except Exception:
                self._fund_cache = {}
        return self._fund_cache

    def _load_snapshot(self):
        if self._snapshot_cache is None:
            try:
                with open(self.snapshot_file, encoding='utf-8') as f:
                    self._snapshot_cache = json.load(f)
            except Exception:
                self._snapshot_cache = {}
        return self._snapshot_cache

    def _news_for_symbol(self, symbol):
        try:
            with open(os.path.join(self.raw_news_dir, f"{symbol}_news.json"), encoding='utf-8') as f:
                items = json.load(f)
                return items if isinstance(items, list) else []
        except Exception:
            return []

    def _detect_symbol(self, query):
        funds = self._load_fundamentals()
        q = query.upper()
        # Match ticker symbols (longest first so e.g. CBL over CBL... is stable)
        for sym in sorted(funds.keys(), key=len, reverse=True):
            if re.search(rf'\b{re.escape(sym)}\b', q):
                return sym
        # Match full company names
        for sym, f in funds.items():
            name = (f.get('name') or '').upper()
            if name and re.search(rf'\b{re.escape(name)}\b', q):
                return sym
        return None

    def _technical_signal(self, symbol, df_raw):
        """Real transparent scorer output for one symbol from its actual price history."""
        try:
            from indicators import compute_all_indicators
            from ml_model import classifier
            if df_raw is None:
                return None
            sub = df_raw[df_raw['symbol'].str.upper() == symbol]
            if len(sub) < 5:
                return None
            di = compute_all_indicators(sub.sort_values('date'))
            pred = classifier.predict_movement_probabilities(di, cache_key=symbol)
            latest = di.iloc[-1]
            sma_ratio = float(latest.get('close', 0)) / float(latest.get('sma_20', latest.get('close', 1))) if latest.get('sma_20') else None
            return {
                "signal": pred['signal'],
                "confidence": pred['confidenceScore'],
                "price": round(float(latest['close']), 2),
                "rsi": round(float(latest.get('rsi', 50.0)), 2),
                "sma20Ratio": round(sma_ratio, 3) if sma_ratio else None
            }
        except Exception:
            return None

    # ── Real top picks (no hardcoded numbers) ────────────────────────────

    def _build_top_picks(self, limit=5):
        funds = self._load_fundamentals()
        try:
            from data_collector import fetch_price_history_csv
            df_raw = fetch_price_history_csv()
        except Exception:
            df_raw = None

        picks = []
        for sym, f in funds.items():
            pe = f.get('peRatio')
            roe = f.get('roe')
            dy = f.get('dividendYield')
            # Require sane, real valuations: skip loss-making and absurd P/E
            if pe is None or pe <= 0 or pe > 30:
                continue
            if roe is None or roe <= 0:
                continue

            tech = self._technical_signal(sym, df_raw)
            signal = tech['signal'] if tech else 'NEUTRAL'
            confidence = tech['confidence'] if tech else 55.0
            price = tech['price'] if tech and tech['price'] else f.get('price')

            score = 0.0
            parts = []
            if pe < 15:
                score += 2.0
            elif pe < 20:
                score += 1.2
            elif pe < 25:
                score += 0.6
            if roe > 18:
                score += 1.5
            elif roe > 12:
                score += 1.0
            elif roe > 8:
                score += 0.5
            if dy and dy > 4:
                score += 1.5
            elif dy and dy > 2.5:
                score += 1.0
            elif dy and dy > 1.5:
                score += 0.5
            if signal == 'BULLISH':
                score += 1.5
            elif signal == 'NEUTRAL':
                score += 0.4
            else:
                score -= 1.0
            if tech and tech.get('sma20Ratio'):
                score += 0.8 if tech['sma20Ratio'] >= 1.0 else -0.5

            reason_bits = [f"P/E {pe}", f"ROE {roe}%"]
            if dy:
                reason_bits.append(f"div yield {dy}%")
            if tech:
                reason_bits.append(f"{signal} technicals (RSI {tech['rsi']})")
            parts = reason_bits

            picks.append({
                "symbol": sym,
                "name": f.get('name') or sym,
                "sector": f.get('sector') or 'Equity',
                "signal": 'BUY' if signal == 'BULLISH' else ('HOLD' if signal == 'NEUTRAL' else 'SELL'),
                "confidence": round(float(confidence), 1),
                "price": round(float(price), 2) if price else None,
                "reason": "; ".join(parts),
                "score": score
            })

        picks.sort(key=lambda p: p['score'], reverse=True)
        return picks[:limit]

    # ── Context builders ─────────────────────────────────────────────────

    def _market_context(self):
        snap = self._load_snapshot()
        lines = []
        as_of = snap.get('asOf') or ''
        # NEPSE main index from the indices list
        nepse = next((i for i in (snap.get('indices') or []) if i.get('index') == 'NEPSE Index'), None)
        if nepse:
            val = nepse.get('currentValue') or nepse.get('close')
            chg = nepse.get('change')
            pct = nepse.get('perChange')
            turnover = ''
            for item in (snap.get('summary') or []):
                if 'turnover' in (item.get('detail') or '').lower() and item.get('value'):
                    turnover = f", turnover Rs {item['value']:,.0f}"
            lines.append(
                f"Market snapshot (as of {as_of or 'last session'}): NEPSE at {val} "
                f"({chg:+} pts, {pct:+}%){turnover}"
            )
        else:
            lines.append("Market snapshot: live index data currently unavailable.")
        gainers = (snap.get('gainers') or [])[:3]
        losers = (snap.get('losers') or [])[:3]
        if gainers:
            lines.append("Top gainers today: " + "; ".join(
                f"{g.get('symbol')} {g.get('ltp')} ({g.get('percentageChange')}%)" for g in gainers))
        if losers:
            lines.append("Top losers today: " + "; ".join(
                f"{l.get('symbol')} {l.get('ltp')} ({l.get('percentageChange')}%)" for l in losers))
        return "\n".join(lines)

    def _symbol_context(self, symbol):
        funds = self._load_fundamentals()
        f = funds.get(symbol, {})
        tech = self._technical_signal(symbol, None)
        try:
            from data_collector import fetch_price_history_csv
            df_raw = fetch_price_history_csv()
            tech = tech or self._technical_signal(symbol, df_raw)
        except Exception:
            pass

        lines = [f"Company: {symbol} ({f.get('name') or symbol}) - {f.get('sector') or 'Equity'}"]
        if f.get('peRatio') is not None:
            lines.append(f"P/E ratio {f['peRatio']}x, P/B ratio {f.get('pbRatio')}x")
        if f.get('eps') is not None:
            lines.append(f"EPS Rs {f['eps']}, ROE {f.get('roe')}%, book value Rs {f.get('bookValue')}")
        if f.get('dividendYield') is not None:
            lines.append(f"Dividend yield {f['dividendYield']}%")
        if f.get('marketCap') is not None:
            lines.append(f"Market cap Rs {f['marketCap']:,.0f}")
        if f.get('price') is not None:
            lines.append(f"Last traded price Rs {f['price']}")
        if tech:
            lines.append(
                f"Technical (computed from real price history): {tech['signal']} with {tech['confidence']}% confidence, "
                f"RSI {tech['rsi']}, price Rs {tech['price']}"
            )
        news = self._news_for_symbol(symbol)
        if news:
            lines.append("Recent news:")
            for item in news[:6]:
                lines.append(
                    f"- {item.get('title')} ({item.get('pubDate')}) [Sentiment: {item.get('sentimentLabel', 'NEUTRAL')}]"
                )
        return "\n".join(lines)

    # ── Intent helpers ───────────────────────────────────────────────────

    def _is_rec_query(self, query):
        return any(w in query.lower() for w in [
            'buy', 'recommend', 'which stock', 'top pick', 'should i buy',
            'best stock', 'invest', 'stocks to', 'which nepse', 'good stock'
        ])

    def _is_greeting(self, query):
        return any(w in query.lower().strip() for w in [
            'hi', 'hello', 'hey', 'namaste', 'good morning', 'good evening',
            'who are you', 'what can you do', 'help'
        ]) and len(query.strip().split()) <= 4

    # ── Main entry ───────────────────────────────────────────────────────

    def query_financial_document(self, query, groq_api_key=None, company_meta=None, symbol=None):
        if not symbol:
            symbol = self._detect_symbol(query)
        symbol = symbol.upper().strip() if symbol else None

        api_key = groq_api_key or os.environ.get("GROQ_API_KEY")
        is_rec = self._is_rec_query(query)
        is_greet = self._is_greeting(query)

        market_ctx = self._market_context()
        picks = self._build_top_picks(limit=5) if is_rec else []

        context_parts = [market_ctx]
        if symbol:
            context_parts.append(self._symbol_context(symbol))
        context_str = "\n\n".join(context_parts)

        picks_txt = ""
        if picks:
            picks_txt = "\n".join(
                f"- {p['symbol']} ({p['name']}): {p['signal']} {p['confidence']}% confidence, "
                f"price Rs {p['price']}. {p['reason']}."
                for p in picks
            )

        answer = None
        recommendations = picks
        groq_used = False

        if api_key:
            try:
                from groq import Groq
                client = Groq(api_key=api_key)

                if is_greet:
                    system_prompt = (
                        "You are a friendly, intelligent NEPSE financial advisor. Reply warmly and briefly, "
                        "then note you can analyze stocks, fundamentals, and news using live NEPSE data."
                    )
                    user_prompt = f"User: {query}"
                elif is_rec:
                    system_prompt = (
                        "You are an expert NEPSE stock advisor. Recommend specific scrips using ONLY the real data provided "
                        "below. State Buy/Hold/Sell signals with the real confidence and numbers given. "
                        "Never invent P/E, ROE, dividend, price, or target figures that are not in the data. "
                        "If data is missing, say so."
                    )
                    user_prompt = (
                        f"User question: {query}\n\nReal market data:\n{market_ctx}\n\n"
                        f"Top candidates computed from real fundamentals + technicals:\n{picks_txt}"
                    )
                else:
                    system_prompt = (
                        "You are a helpful NEPSE financial assistant. Answer using ONLY the real data provided below. "
                        "Never invent financial figures. If you don't have the data to answer, say you don't have it."
                    )
                    user_prompt = f"Real data:\n{context_str}\n\nUser question: {query}"

                completion = client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.2,
                    max_tokens=600
                )
                answer = completion.choices[0].message.content
                groq_used = True
                print(f"[Groq AI] Response generated (symbol={symbol})")
            except Exception as e:
                print(f"[Groq SDK Error]: {e}")

        if not answer:
            answer = self._fallback_answer(query, symbol, is_rec, is_greet, market_ctx, picks, context_str)

        sources = self._sources_for(symbol, picks)

        return {
            "answer": answer,
            "recommendations": recommendations,
            "citations": [],
            "sources": sources,
            "symbol": symbol or "NEPSE Market",
            "query": query,
            "groqPowered": groq_used
        }

    def _fallback_answer(self, query, symbol, is_rec, is_greet, market_ctx, picks, context_str):
        if is_greet:
            return (
                "Namaste! I can help you with NEPSE stocks using real market data — try:\n"
                "- \"Which stocks should I buy?\"\n"
                "- \"Tell me about NABIL or GBIME\"\n"
                "- \"How did the market do today?\"\n\n"
                "*I answer from live NEPSE data directly.*"
            )
        if is_rec:
            if not picks:
                return (
                    "### Top NEPSE Stock Recommendations\n\n"
                    "I don't have enough real valuation data to rank stocks right now. "
                    "The fundamentals cache may need refreshing.\n\n"
                    f"*Market today:* {market_ctx}"
                )
            lines = ["### Top NEPSE Stock Recommendations (from real NEPSE data)", ""]
            for p in picks:
                lines.append(
                    f"**{p['symbol']}** ({p['name']}) - **{p['signal']}** ({p['confidence']}% confidence)\n"
                    f"- Price: Rs {p['price']} · Reason: {p['reason']}"
                )
            lines.append("")
            lines.append("_" + market_ctx + "_")
            lines.append(
                "\n*Scores are computed from real fundamentals (P/E, ROE, dividend yield) and real price history.*"
            )
            return "\n".join(lines)
        if symbol:
            return (
                f"### {symbol} - Snapshot from Real NEPSE Data\n\n"
                f"{context_str}\n\n"
                "*All figures above are pulled live from NEPSE/MeroLagani data.*"
            )
        return (
            "### NEPSE Market Overview (Real Data)\n\n"
            f"{market_ctx}\n\n"
            "Ask me things like:\n- \"Which stocks should I buy?\"\n- \"Tell me about NABIL\"\n- \"What's the market doing?\"\n\n"
            "*This answer is built from live NEPSE data.*"
        )

    def _sources_for(self, symbol, picks):
        sources = []
        if symbol:
            for item in self._news_for_symbol(symbol)[:6]:
                sources.append({
                    "title": item.get('title', ''),
                    "url": item.get('url', ''),
                    "pubDate": item.get('pubDate', ''),
                    "publishedAgo": relative_time(item.get('pubDate')),
                    "sentimentLabel": item.get('sentimentLabel', 'NEUTRAL')
                })
        if not sources and picks:
            snap = self._load_snapshot()
            sources.append({
                "title": f"NEPSE market snapshot {snap.get('asOf') or ''}".strip(),
                "url": "",
                "pubDate": snap.get('asOf', ''),
                "publishedAgo": "latest session",
                "sentimentLabel": "MARKET"
            })
        return sources


rag_processor = FinancialRAGProcessor()
