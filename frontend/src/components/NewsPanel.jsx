import { useState, useEffect, useCallback, useRef } from 'react';
import { Newspaper, RefreshCw, ExternalLink, WifiOff, TrendingUp, TrendingDown } from 'lucide-react';

const NEWS_URL = '/api/news';
const REFRESH_MS = 5 * 60 * 1000;

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

export default function NewsPanel() {
  const [news, setNews] = useState([]);
  const [sources, setSources] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');
  const mounted = useRef(true);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(`${NEWS_URL}?refresh=0`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!mounted.current) return;
      setNews(data.news || []);
      setSources(data.sources || []);
      setUpdatedAt(data.updatedAt || null);
      setError(false);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const id = window.setTimeout(() => load(true), 0);
    const iv = setInterval(() => load(false), REFRESH_MS);
    return () => {
      mounted.current = false;
      window.clearTimeout(id);
      clearInterval(iv);
    };
  }, [load]);

  const visible = filter === 'all' ? news : news.filter(n => n.sourceId === filter);

  return (
    <div className="news-panel">
      <div className="news-panel-header">
        <div className="news-panel-title-row">
          <Newspaper size={15} className="news-panel-icon" />
          <span className="news-panel-title">Market News</span>
          {news.length > 0 && (
            <span className="news-live-badge">
              <span className="news-live-dot" />
              LIVE
            </span>
          )}
        </div>
        <div className="news-panel-actions">
          {updatedAt && (
            <span className="news-updated">
              {timeAgo(updatedAt)} · {new Date(updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            className="news-refresh-btn"
            onClick={() => load(true)}
            disabled={loading}
            title="Refresh news"
          >
            <RefreshCw size={12} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {sources.length > 1 && (
        <div className="news-source-filters">
          <button
            className={`news-source-chip${filter === 'all' ? ' active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          {sources.map(s => (
            <button
              key={s.id}
              className={`news-source-chip${filter === s.id ? ' active' : ''}`}
              onClick={() => setFilter(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="news-panel-body">
        {loading && news.length === 0 ? (
          <div className="news-skeleton-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="news-skeleton-item" key={i}>
                <div className="skeleton" style={{ width: '40%', height: '0.6rem' }} />
                <div className="skeleton" style={{ width: '95%', height: '0.8rem' }} />
                <div className="skeleton" style={{ width: '70%', height: '0.8rem' }} />
              </div>
            ))}
          </div>
        ) : error && news.length === 0 ? (
          <div className="news-empty">
            <WifiOff size={22} style={{ opacity: 0.4 }} />
            <span>News temporarily unavailable</span>
            <button className="btn-outline" onClick={() => load(true)}>Retry</button>
          </div>
        ) : visible.length === 0 ? (
          <div className="news-empty">
            <Newspaper size={22} style={{ opacity: 0.4 }} />
            <span>No news yet — check back soon.</span>
          </div>
        ) : (
          <ul className="news-list">
            {visible.slice(0, 12).map(n => (
              <li className="news-item" key={n.id}>
                <a
                  href={n.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="news-link"
                >
                  <span className="news-item-meta">
                    <span className={`news-source-badge news-source-${n.sourceId}`}>{n.source}</span>
                    {n.category && <span className="news-category">{n.category}</span>}
                    {n.mood && n.mood !== 'NEUTRAL' && (
                      <span
                        className={`news-sent-chip ${n.mood.toLowerCase()}`}
                        title={`Sentiment: ${n.mood} (${n.sentiment >= 0 ? '+' : ''}${n.sentiment}) · impact ${n.impact}`}
                      >
                        {n.mood === 'BULLISH' ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                        {n.mood}
                        <span className="news-sent-impact">{n.impact?.toFixed(2)}</span>
                      </span>
                    )}
                    <span className="news-time">{timeAgo(n.publishedAt)}</span>
                  </span>
                  <span className="news-title">
                    {n.title}
                    <ExternalLink size={11} className="news-external" />
                  </span>
                  {n.excerpt && <span className="news-excerpt">{n.excerpt}</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
