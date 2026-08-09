// Port of ai_engine/rag_processor.py (FinancialRAGProcessor) to JS.
// Real-data NEPSE assistant: answers are grounded in the same cached
// fundamentals / snapshot / news / price-history files. Uses Groq for the
// LLM summary when GROQ_API_KEY is set, otherwise a deterministic markdown
// answer is built from the same real data.

const dataLoader = require('./dataLoader');
const { computeAllIndicators } = require('./indicators');
const { predictMovementProbabilities } = require('./classifier');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

function _f(v, def) {
  if (v == null) return def != null ? def : 0;
  const x = parseFloat(v);
  return isFinite(x) ? x : (def != null ? def : 0);
}

function _num(v) {
  const x = parseFloat(v);
  return isFinite(x) ? x : 0;
}

function _escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function _detectSymbol(query) {
  const funds = dataLoader.loadFundamentals();
  const q = String(query || '').toUpperCase();
  const keys = Object.keys(funds).sort((a, b) => b.length - a.length);
  for (const sym of keys) {
    if (new RegExp(`\\b${_escapeRegExp(sym)}\\b`).test(q)) return sym;
  }
  for (const [sym, f] of Object.entries(funds)) {
    const name = String(f.name || '').toUpperCase();
    if (name && new RegExp(`\\b${_escapeRegExp(name)}\\b`).test(q)) return sym;
  }
  return null;
}

// Transparent scorer output for one symbol from its actual price history.
function _technicalSignal(symbol) {
  try {
    const hist = dataLoader.loadPriceHistory();
    const rows = hist[symbol];
    if (!rows || rows.length < 5) return null;
    const ind = computeAllIndicators(rows);
    const pred = predictMovementProbabilities(ind);
    const latest = ind[ind.length - 1];
    const sma20 = _f(latest.sma_20, 0);
    const smaRatio = sma20 > 0 ? latest.close / sma20 : null;
    return {
      signal: pred.signal,
      confidence: pred.confidenceScore,
      price: Math.round(latest.close * 100) / 100,
      rsi: Math.round(_f(latest.rsi, 50) * 100) / 100,
      sma20Ratio: smaRatio != null ? Math.round(smaRatio * 1000) / 1000 : null,
    };
  } catch (err) {
    return null;
  }
}

// Real top picks (no hardcoded numbers).
function _buildTopPicks(limit = 5) {
  const funds = dataLoader.loadFundamentals();
  const picks = [];
  for (const [sym, f] of Object.entries(funds)) {
    const pe = _f(f.peRatio, null);
    const roe = _f(f.roe, null);
    const dy = _f(f.dividendYield, null);
    if (pe == null || pe <= 0 || pe > 30) continue;
    if (roe == null || roe <= 0) continue;

    const tech = _technicalSignal(sym);
    const signal = tech ? tech.signal : 'NEUTRAL';
    const confidence = tech ? tech.confidence : 55;
    const price = tech && tech.price ? tech.price : _f(f.price, null);

    let score = 0;
    if (pe < 15) score += 2.0;
    else if (pe < 20) score += 1.2;
    else if (pe < 25) score += 0.6;
    if (roe > 18) score += 1.5;
    else if (roe > 12) score += 1.0;
    else if (roe > 8) score += 0.5;
    if (dy && dy > 4) score += 1.5;
    else if (dy && dy > 2.5) score += 1.0;
    else if (dy && dy > 1.5) score += 0.5;
    if (signal === 'BULLISH') score += 1.5;
    else if (signal === 'NEUTRAL') score += 0.4;
    else score -= 1.0;
    if (tech && tech.sma20Ratio) score += tech.sma20Ratio >= 1 ? 0.8 : -0.5;

    const reasonBits = [`P/E ${pe}`, `ROE ${roe}%`];
    if (dy) reasonBits.push(`div yield ${dy}%`);
    if (tech) reasonBits.push(`${signal} technicals (RSI ${tech.rsi})`);

    picks.push({
      symbol: sym,
      name: f.name || sym,
      sector: f.sector || 'Equity',
      signal: signal === 'BULLISH' ? 'BUY' : signal === 'NEUTRAL' ? 'HOLD' : 'SELL',
      confidence: Math.round(confidence * 10) / 10,
      price: price != null ? Math.round(price * 100) / 100 : null,
      reason: reasonBits.join('; '),
      score,
    });
  }
  picks.sort((a, b) => b.score - a.score);
  return picks.slice(0, limit);
}

function _marketContext() {
  const snap = dataLoader.loadSnapshot();
  const lines = [];
  const asOf = snap.asOf || '';
  const nepse = (snap.indices || []).find(i => i.index === 'NEPSE Index');
  if (nepse) {
    const val = nepse.currentValue != null ? nepse.currentValue : nepse.close;
    const chg = nepse.change != null ? nepse.change : 0;
    const pct = nepse.perChange != null ? nepse.perChange : 0;
    let turnover = '';
    for (const item of snap.summary || []) {
      if (String(item.detail || '').toLowerCase().includes('turnover') && item.value != null) {
        turnover = `, turnover Rs ${Math.round(item.value).toLocaleString('en-IN')}`;
      }
    }
    lines.push(`Market snapshot (as of ${asOf || 'last session'}): NEPSE at ${val} (${chg >= 0 ? '+' : ''}${chg} pts, ${pct >= 0 ? '+' : ''}${pct}%)${turnover}`);
  } else {
    lines.push('Market snapshot: live index data currently unavailable.');
  }
  const gainers = (snap.gainers || []).slice(0, 3);
  const losers = (snap.losers || []).slice(0, 3);
  if (gainers.length) lines.push('Top gainers today: ' + gainers.map(g => `${g.symbol} ${g.ltp} (${g.percentageChange}%)`).join('; '));
  if (losers.length) lines.push('Top losers today: ' + losers.map(l => `${l.symbol} ${l.ltp} (${l.percentageChange}%)`).join('; '));
  return lines.join('\n');
}

function _symbolContext(symbol) {
  const f = dataLoader.loadFundamentals()[symbol] || {};
  const tech = _technicalSignal(symbol);
  const lines = [`Company: ${symbol} (${f.name || symbol}) - ${f.sector || 'Equity'}`];
  if (f.peRatio != null) lines.push(`P/E ratio ${f.peRatio}x, P/B ratio ${f.pbRatio}x`);
  if (f.eps != null) lines.push(`EPS Rs ${f.eps}, ROE ${f.roe}%, book value Rs ${f.bookValue}`);
  if (f.dividendYield != null) lines.push(`Dividend yield ${f.dividendYield}%`);
  if (f.marketCap != null) lines.push(`Market cap Rs ${Math.round(f.marketCap).toLocaleString('en-IN')}`);
  if (f.price != null) lines.push(`Last traded price Rs ${f.price}`);
  if (tech) {
    lines.push(`Technical (computed from real price history): ${tech.signal} with ${tech.confidence}% confidence, RSI ${tech.rsi}, price Rs ${tech.price}`);
  }
  const news = dataLoader.loadNewsForSymbol(symbol);
  if (news && news.length) {
    lines.push('Recent news:');
    for (const item of news.slice(0, 6)) {
      lines.push(`- ${item.title} (${item.pubDate}) [Sentiment: ${item.sentimentLabel || 'NEUTRAL'}]`);
    }
  }
  return lines.join('\n');
}

function _isRecQuery(query) {
  const q = String(query || '').toLowerCase();
  return ['buy', 'recommend', 'which stock', 'top pick', 'should i buy', 'best stock', 'invest', 'stocks to', 'which nepse', 'good stock'].some(w => q.includes(w));
}

function _isGreeting(query) {
  const q = String(query || '').toLowerCase().trim();
  return ['hi', 'hello', 'hey', 'namaste', 'good morning', 'good evening', 'who are you', 'what can you do', 'help'].some(w => q.includes(w)) && q.split(/\s+/).length <= 4;
}

async function _groqComplete(systemPrompt, userPrompt, apiKey) {
  const key = apiKey || process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 600,
      }),
    });
    if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
    const data = await res.json();
    return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || null;
  } catch (err) {
    console.log(`[Groq Error] ${err.message}`);
    return null;
  }
}

function _sourcesFor(symbol, picks) {
  const sources = [];
  if (symbol) {
    for (const item of dataLoader.loadNewsForSymbol(symbol).slice(0, 6)) {
      sources.push({
        title: item.title || '',
        url: item.url || '',
        pubDate: item.pubDate || '',
        publishedAgo: dataLoader.relativeTime(item.pubDate),
        sentimentLabel: item.sentimentLabel || 'NEUTRAL',
      });
    }
  }
  if (!sources.length && picks.length) {
    const snap = dataLoader.loadSnapshot();
    sources.push({
      title: `NEPSE market snapshot ${snap.asOf || ''}`.trim(),
      url: '',
      pubDate: snap.asOf || '',
      publishedAgo: 'latest session',
      sentimentLabel: 'MARKET',
    });
  }
  return sources;
}

function _fallbackAnswer(query, symbol, isRec, isGreet, marketCtx, picks, contextStr) {
  if (isGreet) {
    return (
      'Namaste! I can help you with NEPSE stocks using real market data — try:\n' +
      '- "Which stocks should I buy?"\n' +
      '- "Tell me about NABIL or GBIME"\n' +
      '- "How did the market do today?"\n\n' +
      '*I answer from live NEPSE data directly.*'
    );
  }
  if (isRec) {
    if (!picks.length) {
      return (
        '### Top NEPSE Stock Recommendations\n\n' +
        "I don't have enough real valuation data to rank stocks right now. " +
        'The fundamentals cache may need refreshing.\n\n' +
        `*Market today:* ${marketCtx}`
      );
    }
    const lines = ['### Top NEPSE Stock Recommendations (from real NEPSE data)', ''];
    for (const p of picks) {
      lines.push(`**${p.symbol}** (${p.name}) - **${p.signal}** (${p.confidence}% confidence)\n- Price: Rs ${p.price} · Reason: ${p.reason}`);
    }
    lines.push('');
    lines.push(`_${marketCtx}_`);
    lines.push('\n*Scores are computed from real fundamentals (P/E, ROE, dividend yield) and real price history.*');
    return lines.join('\n');
  }
  if (symbol) {
    return `### ${symbol} - Snapshot from Real NEPSE Data\n\n${contextStr}\n\n*All figures above are pulled live from NEPSE/MeroLagani data.*`;
  }
  return (
    '### NEPSE Market Overview (Real Data)\n\n' +
    `${marketCtx}\n\n` +
    'Ask me things like:\n- "Which stocks should I buy?"\n- "Tell me about NABIL"\n- "What\'s the market doing?"\n\n' +
    '*This answer is built from live NEPSE data.*'
  );
}

async function queryFinancialDocument(query, { groqApiKey, symbol } = {}) {
  if (!symbol) symbol = _detectSymbol(query);
  symbol = symbol ? String(symbol).toUpperCase().trim() : null;

  const isRec = _isRecQuery(query);
  const isGreet = _isGreeting(query);

  const marketCtx = _marketContext();
  const picks = isRec ? _buildTopPicks(5) : [];

  const contextParts = [marketCtx];
  if (symbol) contextParts.push(_symbolContext(symbol));
  const contextStr = contextParts.join('\n\n');

  const picksTxt = picks.length
    ? picks.map(p => `- ${p.symbol} (${p.name}): ${p.signal} ${p.confidence}% confidence, price Rs ${p.price}. ${p.reason}.`).join('\n')
    : '';

  let answer = null;
  let groqUsed = false;

  let systemPrompt, userPrompt;
  if (isGreet) {
    systemPrompt = 'You are a friendly, intelligent NEPSE financial advisor. Reply warmly and briefly, then note you can analyze stocks, fundamentals, and news using live NEPSE data.';
    userPrompt = `User: ${query}`;
  } else if (isRec) {
    systemPrompt = 'You are an expert NEPSE stock advisor. Recommend specific scrips using ONLY the real data provided below. State Buy/Hold/Sell signals with the real confidence and numbers given. Never invent P/E, ROE, dividend, price, or target figures that are not in the data. If data is missing, say so.';
    userPrompt = `User question: ${query}\n\nReal market data:\n${marketCtx}\n\nTop candidates computed from real fundamentals + technicals:\n${picksTxt}`;
  } else {
    systemPrompt = 'You are a helpful NEPSE financial assistant. Answer using ONLY the real data provided below. Never invent financial figures. If you don\'t have the data to answer, say you don\'t have it.';
    userPrompt = `Real data:\n${contextStr}\n\nUser question: ${query}`;
  }

  answer = await _groqComplete(systemPrompt, userPrompt, groqApiKey);
  if (answer) {
    groqUsed = true;
    console.log(`[Groq AI] Response generated (symbol=${symbol})`);
  }

  if (!answer) answer = _fallbackAnswer(query, symbol, isRec, isGreet, marketCtx, picks, contextStr);

  return {
    answer,
    recommendations: picks,
    citations: [],
    sources: _sourcesFor(symbol, picks),
    symbol: symbol || 'NEPSE Market',
    query,
    groqPowered: groqUsed,
    engine: 'local-js',
  };
}

module.exports = { queryFinancialDocument };
