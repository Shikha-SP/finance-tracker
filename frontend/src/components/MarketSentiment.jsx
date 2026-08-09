import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw, TrendingUp, TrendingDown, Minus, ExternalLink,
  Gauge, WifiOff,
} from 'lucide-react';

const SENTIMENT_URL = '/api/news/sentiment';
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

export default function MarketSentiment() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(SENTIMENT_URL, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!mounted.current) return;
      setData(json);
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

  if (loading && !data) {
    return (
      <div className="market-sentiment">
        <div className="ms-body">
          <div className="skeleton" style={{ width: '100%', height: '9rem' }} />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="market-sentiment">
        <div className="ms-header">
          <span className="ms-title"><Gauge size={15} className="ms-icon" /> Market Sentiment</span>
        </div>
        <div className="ms-empty">
          <WifiOff size={20} style={{ opacity: 0.4 }} />
          <span>Sentiment unavailable</span>
          <button className="btn-outline" onClick={() => load(true)}>Retry</button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const mood = data.mood || 'NEUTRAL';
  const moodClass = mood.toLowerCase();
  const score = data.score ?? 0;
  const pctLeft = Math.round(((score + 1) / 2) * 100); // 0..100 gauge position
  const total = data.counts?.positive + data.counts?.neutral + data.counts?.negative || 1;
  const pctPos = Math.round(((data.counts?.positive || 0) / total) * 100);
  const pctNeu = Math.round(((data.counts?.neutral || 0) / total) * 100);
  const pctNeg = Math.round(((data.counts?.negative || 0) / total) * 100);

  const MoodIcon = mood === 'BULLISH' ? TrendingUp : mood === 'BEARISH' ? TrendingDown : Minus;

  return (
    <div className="market-sentiment">
      <div className="ms-header">
        <span className="ms-title"><Gauge size={15} className="ms-icon" /> Market Sentiment</span>
        <div className="ms-header-right">
          {data.updatedAt && <span className="ms-updated">updated {timeAgo(data.updatedAt)}</span>}
          <button className="news-refresh-btn" onClick={() => load(true)} disabled={loading} title="Refresh sentiment">
            <RefreshCw size={12} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div className="ms-body">
        {/* Mood + gauge */}
        <div className="ms-mood-col">
          <div className={`ms-mood ms-mood-${moodClass}`}>
            <MoodIcon size={18} />
            <span>{mood}</span>
          </div>
          <div className="ms-score">
            <span className={`ms-score-val ${score >= 0 ? 'positive' : 'negative'}`}>
              {score > 0 ? '+' : ''}{score.toFixed(2)}
            </span>
            <span className="ms-score-label">weighted score</span>
          </div>
          <div className="ms-gauge" title={`Score ${score} (−1 bearish … +1 bullish)`}>
            <div className="ms-gauge-track">
              <div className="ms-gauge-zero" />
              <div className={`ms-gauge-fill ${score >= 0 ? 'ms-fill-pos' : 'ms-fill-neg'}`} style={{ left: `${Math.min(96, Math.max(4, pctLeft))}%` }} />
            </div>
            <div className="ms-gauge-labels">
              <span>Bearish</span>
              <span>Neutral</span>
              <span>Bullish</span>
            </div>
          </div>
          <div className="ms-counts">
            <div className="ms-count ms-count-pos">
              <span className="ms-count-dot" />
              <span>Bullish</span>
              <span className="ms-count-num">{data.counts?.positive || 0}</span>
            </div>
            <div className="ms-count ms-count-neu">
              <span className="ms-count-dot" />
              <span>Neutral</span>
              <span className="ms-count-num">{data.counts?.neutral || 0}</span>
            </div>
            <div className="ms-count ms-count-neg">
              <span className="ms-count-dot" />
              <span>Bearish</span>
              <span className="ms-count-num">{data.counts?.negative || 0}</span>
            </div>
          </div>
          <div className="ms-dist">
            <div className="ms-dist-bar">
              <span className="ms-dist-pos" style={{ width: `${pctPos}%` }} />
              <span className="ms-dist-neu" style={{ width: `${pctNeu}%` }} />
              <span className="ms-dist-neg" style={{ width: `${pctNeg}%` }} />
            </div>
          </div>
          <div className="ms-footnote">
            Recency-weighted from {data.considered || 0} headlines · impact fades over 3-day half-life
          </div>
        </div>

        {/* Top bullish / bearish */}
        <div className="ms-lists">
          <div className="ms-list ms-list-pos">
            <div className="ms-list-head">
              <TrendingUp size={13} /> Most Bullish
            </div>
            {data.bullish?.length ? (
              <ul>
                {data.bullish.map(n => (
                  <li key={n.id}>
                    <a href={n.link} target="_blank" rel="noopener noreferrer">
                      <span className="ms-list-title">
                        {n.title}
                        <ExternalLink size={10} className="news-external" />
                      </span>
                      <span className="ms-list-meta">
                        <span>{n.source}</span>
                        <span className="ms-impact positive">{n.impact.toFixed(2)}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="ms-list-empty">No bullish headlines</div>
            )}
          </div>
          <div className="ms-list ms-list-neg">
            <div className="ms-list-head">
              <TrendingDown size={13} /> Most Bearish
            </div>
            {data.bearish?.length ? (
              <ul>
                {data.bearish.map(n => (
                  <li key={n.id}>
                    <a href={n.link} target="_blank" rel="noopener noreferrer">
                      <span className="ms-list-title">
                        {n.title}
                        <ExternalLink size={10} className="news-external" />
                      </span>
                      <span className="ms-list-meta">
                        <span>{n.source}</span>
                        <span className="ms-impact negative">{n.impact.toFixed(2)}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="ms-list-empty">No bearish headlines</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
