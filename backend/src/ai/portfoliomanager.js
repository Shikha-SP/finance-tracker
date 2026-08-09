// Port of the AI engine's portfoliomanager.py to JS.
// Reads/writes CSVs directly (no external deps).

const fs = require('fs');
const path = require('path');

const DEFAULT_CAPITAL = 1000000;

function _num(v) {
  const x = parseFloat(String(v).replace(/[,%]/g, ''));
  return isFinite(x) ? x : 0;
}

function parseCsv(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lines.length) return rows;
  const header = lines[0].split(',').map(h => h.trim());
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const obj = {};
    header.forEach((h, idx) => { obj[h] = (cols[idx] || '').trim(); });
    rows.push(obj);
  }
  return rows;
}

function toCsv(rows, header) {
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map(h => r[h] ?? '').join(','));
  return lines.join('\n');
}

class PortfolioManager {
  constructor(portfolioPath, marketPath) {
    this.portfolioPath = portfolioPath;
    this.marketPath = marketPath;
    this.map = {};          // symbol -> {quantity, avg_price, buy_date}
    this.trades = [];       // {date, symbol, action, price, quantity, amount}
    this.transactions = []; // {date, symbol, action, price, quantity, amount}
    this.capital = DEFAULT_CAPITAL;
    this.startDate = null;
    this.market = {};       // symbol -> [{date, open, high, low, close, volume} sorted]
    this.symbols = [];
    this.indexSymbol = 'NEPSE';
  }

  loadPortfolio() {
    if (!fs.existsSync(this.portfolioPath)) return false;
    const text = fs.readFileSync(this.portfolioPath, 'utf-8');
    const rows = parseCsv(text);
    this.map = {};
    this.symbols = [];
    for (const r of rows) {
      const sym = String(r.symbol || r.Symbol || r.SYMBOL || '').toUpperCase().trim();
      if (!sym) continue;
      this.map[sym] = {
        quantity: _num(r.quantity || r.Quantity),
        avg_price: _num(r.avg_price || r.avgPrice || r.avg || r['avg price']),
        buy_date: r.buy_date || r.buyDate || r.date || null,
      };
      this.symbols.push(sym);
    }
    if (rows.length) {
      const c = rows[0].capital;
      if (c) this.capital = _num(c);
    }
    this.loadMarket();
    return this.symbols.length > 0;
  }

  savePortfolio() {
    const rows = [];
    for (const sym of Object.keys(this.map)) {
      const h = this.map[sym];
      rows.push({ symbol: sym, quantity: h.quantity, avg_price: h.avg_price, buy_date: h.buy_date || '' });
    }
    rows.push({ symbol: 'CAPITAL', quantity: '', avg_price: '', buy_date: String(this.capital) });
    fs.writeFileSync(this.portfolioPath, toCsv(rows, ['symbol', 'quantity', 'avg_price', 'buy_date']), 'utf-8');
  }

  loadMarket() {
    if (!fs.existsSync(this.marketPath)) return;
    const text = fs.readFileSync(this.marketPath, 'utf-8');
    const rows = parseCsv(text);
    const bySym = {};
    for (const r of rows) {
      const sym = String(r.symbol || r.Symbol).toUpperCase().trim();
      if (!sym) continue;
      if (!bySym[sym]) bySym[sym] = [];
      bySym[sym].push({
        date: r.date || r.Date,
        open: _num(r.open),
        high: _num(r.high),
        low: _num(r.low),
        close: _num(r.close),
        volume: _num(r.volume),
      });
    }
    for (const sym of Object.keys(bySym)) {
      bySym[sym].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    }
    this.market = bySym;
  }

  _latestPrice(symbol) {
    const rows = this.market[symbol];
    if (!rows || !rows.length) return null;
    return rows[rows.length - 1].close;
  }

  _priceOn(symbol, date) {
    const rows = this.market[symbol];
    if (!rows || !rows.length) return null;
    if (!date) return rows[rows.length - 1].close;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i].date).slice(0, 10) <= String(date).slice(0, 10)) return rows[i].close;
    }
    return rows[0].close;
  }

  _recordTransaction(symbol, action, price, quantity, date) {
    const t = { date, symbol, action: action.toUpperCase(), price, quantity, amount: price * quantity };
    this.trades.push(t);
    this.transactions.push(t);
  }

  addTransaction(symbol, action, price, quantity, date = new Date().toISOString().slice(0, 10)) {
    symbol = symbol.toUpperCase();
    const qty = _num(quantity);
    const pr = _num(price);
    if (qty <= 0 || pr <= 0) return null;

    if (action.toUpperCase() === 'BUY') {
      const existing = this.map[symbol];
      if (existing) {
        const newTotalQty = existing.quantity + qty;
        existing.avg_price = (existing.avg_price * existing.quantity + pr * qty) / newTotalQty;
        existing.quantity = newTotalQty;
        if (!existing.buy_date) existing.buy_date = date;
      } else {
        this.map[symbol] = { quantity: qty, avg_price: pr, buy_date: date };
        if (!this.symbols.includes(symbol)) this.symbols.push(symbol);
      }
      this._recordTransaction(symbol, 'BUY', pr, qty, date);
    } else if (action.toUpperCase() === 'SELL') {
      const existing = this.map[symbol];
      if (!existing || existing.quantity < qty) return null;
      existing.quantity -= qty;
      if (existing.quantity <= 0) {
        delete this.map[symbol];
        this.symbols = this.symbols.filter(s => s !== symbol);
      }
      this._recordTransaction(symbol, 'SELL', pr, qty, date);
    }
    this.savePortfolio();
    return this.map[symbol];
  }

  getHoldings() {
    return Object.keys(this.map).map(sym => {
      const h = this.map[sym];
      const price = this._latestPrice(sym);
      return {
        symbol: sym,
        quantity: h.quantity,
        avg_price: h.avg_price,
        buy_date: h.buy_date,
        current_price: price,
        market_value: price != null ? Math.round(h.quantity * price * 100) / 100 : null,
        cost_basis: Math.round(h.quantity * h.avg_price * 100) / 100,
        profit_pct: price != null && h.avg_price > 0 ? Math.round(((price / h.avg_price - 1) * 100) * 10) / 10 : null,
        weight: 0,
      };
    });
  }

  portfolioValueSeries() {
    const series = [];
    const prices = {};
    let maxDate = null;
    for (const sym of this.symbols) {
      const rows = this.market[sym];
      if (!rows) continue;
      for (const r of rows) {
        if (!maxDate || r.date > maxDate) maxDate = r.date;
        if (!prices[r.date]) prices[r.date] = {};
        prices[r.date][sym] = r.close;
      }
    }
    if (!maxDate) return [];
    const dates = Object.keys(prices).sort();
    for (const d of dates) {
      let value = 0;
      for (const sym of Object.keys(this.map)) {
        const p = prices[d] && prices[d][sym] != null ? prices[d][sym] : this._priceOn(sym, d);
        value += this.map[sym].quantity * p;
      }
      series.push({ date: d, value: Math.round(value * 100) / 100 });
    }
    return series;
  }

  getMetrics() {
    const holdings = this.getHoldings();
    let totalValue = 0, cost = 0, totalPct = 0, count = 0;
    for (const h of holdings) {
      if (h.market_value == null) continue;
      totalValue += h.market_value;
      cost += h.cost_basis;
      if (h.profit_pct != null) { totalPct += h.profit_pct; count++; }
    }
    const cash = Math.max(0, this.capital - cost);
    totalValue += cash;
    const totalReturn = this.capital > 0 ? (totalValue / this.capital - 1) * 100 : 0;

    const series = this.portfolioValueSeries();
    const returns = [];
    for (let i = 1; i < series.length; i++) returns.push(series[i].value / series[i - 1].value - 1);
    const std = _std(returns) * 100;
    const drawdown = maxDrawdown(series.map(s => s.value));
    const sharpe = std > 0 ? (mean(returns) / std) * Math.sqrt(252) : 0;

    return {
      totalValue: Math.round(totalValue * 100) / 100,
      cash: Math.round(cash * 100) / 100,
      costBasis: Math.round(cost * 100) / 100,
      totalReturnPct: Math.round(totalReturn * 100) / 100,
      avgHoldingReturnPct: count ? Math.round((totalPct / count) * 100) / 100 : 0,
      volatilityPct: Math.round(std * 100) / 100,
      maxDrawdownPct: Math.round(drawdown * 100) / 100,
      sharpeRatio: Math.round(sharpe * 100) / 100,
      holdingsCount: holdings.length,
      dailyReturns: returns.length,
      startDate: this.startDate || series[0]?.date || null,
    };
  }

  correlations() {
    const syms = this.symbols.filter(s => (this.market[s] || []).length > 20);
    const corr = {};
    for (const a of syms) {
      corr[a] = {};
      const ra = returnsFor(this.market[a]);
      for (const b of syms) {
        if (a === b) { corr[a][b] = 1; continue; }
        const rb = returnsFor(this.market[b]);
        corr[a][b] = Math.round(pearson(ra, rb) * 100) / 100;
      }
    }
    return corr;
  }

  turnover() {
    let buyVal = 0, sellVal = 0;
    for (const t of this.trades) {
      if (t.action === 'BUY') buyVal += t.amount;
      else sellVal += t.amount;
    }
    const m = this.getMetrics();
    const avgAssets = m.totalValue || 1;
    const value = Math.min(buyVal, sellVal);
    return { turnoverRatio: Math.round((value / avgAssets) * 1000) / 1000, buyValue: Math.round(buyVal), sellValue: Math.round(sellVal), tradesCount: this.trades.length };
  }

  rebalanceSuggestion(targetWeights) {
    const holdings = this.getHoldings();
    let totalValue = 0;
    for (const h of holdings) if (h.market_value != null) totalValue += h.market_value;
    if (!totalValue) return { suggestions: [] };
    const n = holdings.length || 1;
    const suggestions = [];
    for (const h of holdings) {
      const target = targetWeights && targetWeights[h.symbol] != null ? targetWeights[h.symbol] : 1 / n;
      const desiredValue = totalValue * target;
      const diffValue = desiredValue - (h.market_value || 0);
      const diffQty = h.current_price > 0 ? Math.round(diffValue / h.current_price) : 0;
      if (Math.abs(diffQty) >= 1) {
        suggestions.push({
          symbol: h.symbol,
          action: diffQty > 0 ? 'BUY' : 'SELL',
          quantity: Math.abs(diffQty),
          estAmount: Math.round(Math.abs(diffValue) * 100) / 100,
          currentWeight: Math.round(((h.market_value || 0) / totalValue) * 1000) / 1000,
          targetWeight: target,
        });
      }
    }
    return { suggestions, totalValue: Math.round(totalValue * 100) / 100, targetWeights };
  }

  riskProfile() {
    const m = this.getMetrics();
    const holdings = this.getHoldings();
    let topWeight = 0, topSymbol = null, highVol = 0;
    for (const h of holdings) {
      const w = h.market_value != null && m.totalValue > 0 ? h.market_value / m.totalValue : 0;
      if (w > topWeight) { topWeight = w; topSymbol = h.symbol; }
      if (h.profit_pct != null && Math.abs(h.profit_pct) > 5) highVol++;
    }

    const indexRows = this.market[this.indexSymbol];
    const beta = betaTo(indexRows, holdings, this.market);
    let profile = 'MODERATE';
    const vol = m.volatilityPct || 0;
    if (vol > 4 || topWeight > 0.4 || beta > 1.3) profile = 'AGGRESSIVE';
    if (vol < 1.5 && topWeight < 0.2 && beta < 0.8) profile = 'CONSERVATIVE';

    return {
      profile,
      volatilityPct: m.volatilityPct,
      maxDrawdownPct: m.maxDrawdownPct,
      sharpeRatio: m.sharpeRatio,
      topHolding: { symbol: topSymbol, weightPct: topWeight ? Math.round(topWeight * 1000) / 10 : 0 },
      beta,
      concentration: topWeight ? Math.round(topWeight * 1000) / 10 : 0,
      highVolHoldings: highVol,
    };
  }

  alerts() {
    const holdings = this.getHoldings();
    const out = [];
    for (const h of holdings) {
      if (h.current_price == null) continue;
      const drop = h.avg_price > 0 ? (h.current_price / h.avg_price - 1) : 0;
      if (drop <= -0.05) {
        out.push({ symbol: h.symbol, level: 'SELL', message: `Down ${Math.round(drop * 100)}% from avg price — review position`, price: h.current_price });
      } else if (drop >= 0.15) {
        out.push({ symbol: h.symbol, level: 'TAKE_PROFIT', message: `Up ${Math.round(drop * 100)}% from avg price — consider partial profit`, price: h.current_price });
      }
    }
    return out;
  }

  profitLossSummary() {
    const holdings = this.getHoldings();
    let totalProfit = 0;
    const rows = holdings.map(h => {
      const profit = h.market_value != null && h.cost_basis != null ? h.market_value - h.cost_basis : null;
      if (profit != null) totalProfit += profit;
      return {
        symbol: h.symbol,
        quantity: h.quantity,
        avgPrice: h.avg_price,
        currentPrice: h.current_price,
        cost: h.cost_basis,
        value: h.market_value,
        profit: profit != null ? Math.round(profit * 100) / 100 : null,
        profitPct: h.profit_pct,
      };
    });
    return { holdings: rows, totalProfit: Math.round(totalProfit * 100) / 100 };
  }
}

function _std(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  let s = 0;
  for (const v of arr) s += (v - m) * (v - m);
  return Math.sqrt(s / (arr.length - 1));
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function maxDrawdown(values) {
  let peak = -Infinity, maxDd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    if (peak > 0) maxDd = Math.max(maxDd, (peak - v) / peak);
  }
  return maxDd;
}

function returnsFor(rows) {
  if (!rows || rows.length < 2) return [];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i - 1].close > 0) out.push(rows[i].close / rows[i - 1].close - 1);
  }
  return out;
}

function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 5) return 0;
  const ra = [], rb = [];
  for (let i = 0; i < n; i++) { ra.push(a[i]); rb.push(b[i]); }
  const ma = mean(ra), mb = mean(rb);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const xa = ra[i] - ma, xb = rb[i] - mb;
    num += xa * xb; da += xa * xa; db += xb * xb;
  }
  const den = Math.sqrt(da * db);
  return den > 0 ? num / den : 0;
}

function betaTo(indexRows, holdings, market) {
  if (!indexRows || indexRows.length < 20) return null;
  const ri = returnsFor(indexRows);
  const varI = _std(ri) ** 2;
  if (varI <= 0) return null;
  let totalValue = 0;
  for (const h of holdings) totalValue += h.market_value != null ? h.market_value : 0;
  if (totalValue <= 0) return null;

  let beta = 0;
  for (const h of holdings) {
    const rows = market && market[h.symbol];
    const rs = returnsFor(rows);
    const n = Math.min(rs.length, ri.length);
    if (n < 10) continue;
    const ra = rs.slice(rs.length - n), rb = ri.slice(ri.length - n);
    const ma = mean(ra), mb = mean(rb);
    let cov = 0;
    for (let i = 0; i < n; i++) cov += (ra[i] - ma) * (rb[i] - mb);
    cov /= n;
    const b = cov / varI;
    const w = (h.market_value || 0) / totalValue;
    beta += b * w;
  }
  return Math.round(beta * 100) / 100;
}

module.exports = { PortfolioManager };
