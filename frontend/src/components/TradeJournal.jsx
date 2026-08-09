import { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, MinusCircle, AlertTriangle, Sparkles, User, ChevronDown, ChevronUp } from 'lucide-react';

const fmtNPR = n => 'रू ' + Math.round(Math.abs(n)).toLocaleString('en-IN');
const fmtDate = iso => {
  if (!iso) return '—';
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  if (isNaN(d)) return String(iso).slice(0, 10);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const ratingColor = v => (v === 'STRONG BUY' || v === 'BUY') ? 'var(--green)' : v === 'HOLD' ? '#f59e0b' : v === 'SELL' ? '#f97316' : 'var(--text-muted)';

function TradeJournal({ portfolio, liveMarket, nepseSeries }) {
  const [open, setOpen] = useState(true);
  const ltpMap = useMemo(() => {
    const m = {};
    (liveMarket || []).forEach(r => {
      if (r.symbol && typeof r.close === 'number') m[String(r.symbol).toUpperCase()] = r.close;
    });
    return m;
  }, [liveMarket]);

  const entries = useMemo(() => {
    if (!portfolio || !portfolio.length) return [];

    const buys = portfolio
      .filter(tx => tx.type === 'buy')
      .map(tx => ({
        ...tx,
        _d: new Date(String(tx.date || '').slice(0, 10) + 'T00:00:00').getTime(),
        _qty: Number(tx.quantity) || 0,
        _price: Number(tx.price) || 0,
      }))
      .filter(tx => Number.isFinite(tx._d) && tx._qty > 0 && tx._price > 0)
      .sort((a, b) => a._d - b._d);

    const sells = portfolio
      .filter(tx => tx.type === 'sell')
      .map(tx => ({
        ...tx,
        _d: new Date(String(tx.date || '').slice(0, 10) + 'T00:00:00').getTime(),
        _qty: Number(tx.quantity) || 0,
        _price: Number(tx.price) || 0,
      }))
      .filter(tx => Number.isFinite(tx._d) && tx._qty > 0 && tx._price > 0)
      .sort((a, b) => a._d - b._d);

    // FIFO: match each buy's shares against sells of the same symbol.
    const soldBySym = {};
    sells.forEach(s => {
      const sym = String(s.symbol || '').toUpperCase();
      (soldBySym[sym] = soldBySym[sym] || []).push({ ...s, _remain: s._qty });
    });

    const rows = buys.map(b => {
      const sym = String(b.symbol || '').toUpperCase();
      const match = soldBySym[sym] || [];
      let rem = b._qty;
      let realizedSum = 0;
      let realizedQty = 0;
      let sellDate = null;
      for (const s of match) {
        if (rem <= 0) break;
        if (s._d < b._d) continue;
        const take = Math.min(rem, s._remain);
        if (take <= 0) continue;
        realizedSum += take * ((s._price - b._price) / b._price);
        realizedQty += take;
        rem -= take;
        s._remain -= take;
        sellDate = s._d;
      }
      const ltp = ltpMap[sym];
      let retPct = null;
      if (realizedQty > 0 && rem > 0) {
        retPct = (realizedQty * (realizedSum / realizedQty) + rem * ((ltp && ltp > 0 ? (ltp - b._price) / b._price : null) ?? 0)) / (realizedQty + rem);
        if (!ltp) retPct = null;
      } else if (realizedQty > 0) {
        retPct = realizedSum / realizedQty;
      } else if (rem > 0 && ltp) {
        retPct = (ltp - b._price) / b._price;
      }
      const closed = rem <= 0;
      const end = closed && sellDate ? sellDate : Date.now();
      return {
        symbol: b.symbol,
        date: b.date,
        daysHeld: Math.max(0, Math.round((end - b._d) / 86400000)),
        entry: b._price,
        exit: closed && sellDate ? null : ltp,
        qty: b._qty,
        source: b.source === 'app' ? 'app' : 'own',
        snapshot: b.appSnapshot || null,
        retPct,
        closed,
      };
    });
    return rows.sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [portfolio, ltpMap]);

  const stats = useMemo(() => {
    const sum = (rows) => {
      const withRet = rows.filter(r => r.retPct != null);
      if (!withRet.length) return null;
      const avg = withRet.reduce((s, r) => s + r.retPct, 0) / withRet.length;
      const win = withRet.filter(r => r.retPct > 0).length / withRet.length;
      return { n: withRet.length, avg: avg * 100, win: win * 100, total: rows.length };
    };
    const app = sum(entries.filter(e => e.source === 'app'));
    const own = sum(entries.filter(e => e.source === 'own'));
    return { app, own, total: entries.length };
  }, [entries]);

  const nepseBench = useMemo(() => {
    if (!nepseSeries || !nepseSeries.length || !entries.length) return null;
    const min = Math.min(...entries.map(e => new Date(String(e.date).slice(0, 10) + 'T00:00:00').getTime()));
    const start = nepseSeries.find(r => r.timestamp * 1000 >= min);
    const last = nepseSeries[nepseSeries.length - 1];
    if (!start || !last || !start.close || !last.close) return null;
    return ((last.close - start.close) / start.close) * 100;
  }, [nepseSeries, entries]);

  if (stats.total === 0) {
    return (
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <BookOpen size={15} style={{ color: 'var(--accent)' }} /> Trade journal
          </span>
        </div>
        <div className="journal-empty">
          <BookOpen size={22} style={{ opacity: 0.4 }} />
          <span>
            When you add trades, this scoreboard records each buy, what the app said at the time, and whether
            it worked out — then compares <strong>app picks vs your own calls</strong>. That's the only honest way
            to know if following the app helps.
          </span>
        </div>
      </div>
    );
  }

  const sampleOk = (stats.app && stats.app.n >= 5) && (stats.own && stats.own.n >= 5);

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div className="card-header">
        <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <BookOpen size={15} style={{ color: 'var(--accent)' }} /> Trade journal
        </span>
        <button className="trust-toggle" onClick={() => setOpen(o => !o)} style={{ marginTop: 0 }}>
          {open ? 'Collapse' : 'Expand'} {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {open && (
        <>
          {!sampleOk && (
            <div className="journal-warn">
              <AlertTriangle size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <span>Too few trades yet — numbers below mean almost nothing until you have ~5 of each. Keep logging.</span>
            </div>
          )}

          <div className="journal-scoreboard">
            <div className="journal-stat">
              <span className="journal-stat-label"><Sparkles size={11} style={{ color: 'var(--green)' }} /> App picks</span>
              <strong className={stats.app && stats.app.avg >= 0 ? 'pos' : 'neg'}>
                {stats.app ? (stats.app.avg >= 0 ? '+' : '') + stats.app.avg.toFixed(1) + '%' : '—'}
              </strong>
              <small>{stats.app ? `${stats.app.n} trades · ${stats.app.win.toFixed(0)}% winners` : 'no trades yet'}</small>
            </div>
            <div className="journal-stat">
              <span className="journal-stat-label"><User size={11} style={{ color: '#0ea5e9' }} /> Your own calls</span>
              <strong className={stats.own && stats.own.avg >= 0 ? 'pos' : 'neg'}>
                {stats.own ? (stats.own.avg >= 0 ? '+' : '') + stats.own.avg.toFixed(1) + '%' : '—'}
              </strong>
              <small>{stats.own ? `${stats.own.n} trades · ${stats.own.win.toFixed(0)}% winners` : 'no trades yet'}</small>
            </div>
            <div className="journal-stat">
              <span className="journal-stat-label">NEPSE over same period</span>
              <strong className={nepseBench != null && nepseBench >= 0 ? 'pos' : 'neg'}>
                {nepseBench != null ? (nepseBench >= 0 ? '+' : '') + nepseBench.toFixed(1) + '%' : '—'}
              </strong>
              <small>{nepseBench != null ? 'index move' : 'no index data'}</small>
            </div>
          </div>

          <div className="journal-table">
            <div className="journal-row journal-head">
              <span>Date</span>
              <span>Symbol</span>
              <span>Call</span>
              <span>App said</span>
              <span>Entry</span>
              <span>Now</span>
              <span>Return</span>
              <span>Held</span>
              <span>Status</span>
            </div>
            {entries.slice().reverse().map((e, i) => (
              <div className="journal-row" key={i}>
                <span className="journal-date">{fmtDate(e.date)}</span>
                <span className="stock-symbol">{e.symbol}</span>
                <span className="journal-call">
                  {e.source === 'app' ? (
                    <><Sparkles size={10} style={{ color: 'var(--green)' }} /> App</>
                  ) : (
                    <><User size={10} style={{ color: '#0ea5e9' }} /> Own</>
                  )}
                </span>
                <span className="journal-appsaid">
                  {e.snapshot?.verdict ? (
                    <>
                      <span style={{ color: ratingColor(e.snapshot.verdict), fontWeight: 700 }}>{e.snapshot.verdict}</span>
                      {e.snapshot.score != null && <small> {Math.round(e.snapshot.score)}</small>}
                      {e.snapshot.rsi != null && <small> · RSI {e.snapshot.rsi}</small>}
                    </>
                  ) : (
                    <span className="journal-na">no snapshot</span>
                  )}
                </span>
                <span>{fmtNPR(e.entry)}</span>
                <span>{e.closed ? fmtNPR(e.exit) || '—' : e.exit ? fmtNPR(e.exit) : <span className="journal-na">—</span>}</span>
                <span className={e.retPct == null ? 'journal-na' : e.retPct >= 0 ? 'pos' : 'neg'}>
                  {e.retPct == null ? '—' : (e.retPct >= 0 ? '+' : '') + (e.retPct * 100).toFixed(1) + '%'}
                </span>
                <span>{e.daysHeld}d</span>
                <span className={e.closed ? 'journal-status closed' : 'journal-status open'}>
                  {e.closed ? <><MinusCircle size={10} /> closed</> : <><CheckCircle2 size={10} /> open</>}
                </span>
              </div>
            ))}
          </div>

          <div className="journal-note">
            Return = realized for closed shares (FIFO) + unrealized at current price for open shares. "App said" is
            snapshotted at the moment you logged the buy, so it can't be hindsight. Small samples mean nothing — the
            honest verdict only forms after ~5+ of each.
          </div>
        </>
      )}
    </div>
  );
}

export default TradeJournal;
