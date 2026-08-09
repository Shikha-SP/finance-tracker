import { useState, useEffect, useCallback, useRef } from 'react';
import { Newspaper, RefreshCw, ExternalLink, WifiOff } from 'lucide-react';

function timeAgo(iso) {
  if (!iso) return '';
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

function moodFromScore(s) {
  if (s == null) return 'NEUTRAL';
  if (s > 0.1) return 'BULLISH';
  if (s < -0.1) return 'BEARISH';
  return 'NEUTRAL';
}

export default function StockNews({ symbol }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(`/api/news/search?q=${encodeURIComponent(symbol)}`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!mounted.current) return;
      setItems(json.news || []);
      setError(false);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    mounted.current = true;
    const id = window.setTimeout(() => {
      setItems([]);
      setError(false);
      setLoading(true);
      void load(true);
    }, 0);
    const iv = setInterval(() => load(false), 5 * 60 * 1000);
    return () => {
      mounted.current = false;
      window.clearTimeout(id);
      clearInterval(iv);
    };
  }, [load]);

  return (
    <div className="stock-news">
      <div className="stock-news-head">
        <span className="stock-news-title">
          <Newspaper size={14} style={{ color: '#0ea5e9' }} />
          Latest {symbol} News
          <span className="stock-news-live">LIVE</span>
        </span>
        <div className="stock-news-head-right">
          {items.length > 0 && <span className="ms-updated">auto-updates · 5 min</span>}
          <button className="news-refresh-btn" onClick={() => load(true)} disabled={loading} title="Refresh news">
            <RefreshCw size={12} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="stock-news-empty">
          <div className="skeleton" style={{ width: '100%', height: '5rem' }} />
        </div>
      ) : error && items.length === 0 ? (
        <div className="ms-empty">
          <WifiOff size={20} style={{ opacity: 0.4 }} />
          <span>News unavailable</span>
          <button className="btn-outline" onClick={() => load(true)}>Retry</button>
        </div>
      ) : items.length === 0 ? (
        <div className="ms-empty">
          <span>No recent headlines for {symbol}</span>
        </div>
      ) : (
        <ul className="stock-news-list">
          {items.slice(0, 6).map((n) => {
            const mood = n.mood || moodFromScore(n.sentiment);
            return (
              <li key={n.id} className="news-item">
                <a href={n.link} target="_blank" rel="noopener noreferrer" className="news-item-link">
                  <span className="news-item-title">{n.title}</span>
                  <span className="news-item-meta">
                    <span className="news-source-badge news-source-googlenews">{n.source}</span>
                    <span className={`news-sent-chip ${mood.toLowerCase()}`}>{mood}</span>
                    {n.impact != null && n.impact > 0.02 && (
                      <span className="ms-impact positive">impact {n.impact.toFixed(2)}</span>
                    )}
                    <span className="news-time">{timeAgo(n.publishedAt)}</span>
                    <ExternalLink size={11} className="news-external" />
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
