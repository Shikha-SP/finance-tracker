import { Activity, TrendingUp, TrendingDown, Clock } from 'lucide-react';

export const REGIME = {
  UPTREND:   { color: 'var(--green)', bg: 'rgba(16,185,129,0.09)',  border: 'rgba(16,185,129,0.45)',  icon: TrendingUp,   tag: 'RISK-ON · GOOD TIME TO BUY' },
  SIDEWAYS:  { color: '#f59e0b',       bg: 'rgba(245,158,11,0.09)', border: 'rgba(245,158,11,0.40)',  icon: Activity,     tag: 'MIXED · PICK ONLY THE STRONG' },
  DOWNTREND: { color: '#ef4444',       bg: 'rgba(239,68,68,0.09)',  border: 'rgba(239,68,68,0.45)',   icon: TrendingDown, tag: 'RISK-OFF · CASH BEATS PICKING' },
};

export const fmtRegimeDate = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const regimeStyle = (regime) => REGIME[regime] || REGIME.SIDEWAYS;

export default function RegimeBanner({ marketRegime, compact = false }) {
  const style = regimeStyle(marketRegime?.regime);
  const Icon = style.icon;
  const asOf = fmtRegimeDate(marketRegime?.asOf);

  return (
    <div className="regime-banner" style={{ background: style.bg, borderColor: style.border }}>
      <div className="regime-main">
        <div className="regime-icon" style={{ background: style.color, color: '#fff' }}>
          <Icon size={22} />
        </div>
        <div>
          <div className="regime-line">
            NEPSE is in a <strong style={{ color: style.color }}>{marketRegime?.regime || '…'}</strong>
            <span className="regime-tag" style={{ color: style.color, borderColor: style.color }}>{style.tag}</span>
          </div>
          <div className="regime-date">
            <Clock size={12} /> Based on data as of <strong>{asOf}</strong>
            {marketRegime?.index != null && (
              <> · NEPSE index <strong>{marketRegime.index.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                {marketRegime.indexDailyChangePct != null && (
                  <span style={{ color: marketRegime.indexDailyChangePct >= 0 ? 'var(--green)' : '#ef4444' }}>
                    {' '}({marketRegime.indexDailyChangePct > 0 ? '+' : ''}{marketRegime.indexDailyChangePct}%)
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {marketRegime?.advice && <div className="regime-advice">{marketRegime.advice}</div>}

      {!compact && (
        <div className="regime-stats">
          <div className="regime-stat">
            <span className="regime-stat-label">Median 20-day move (all stocks)</span>
            <span className={`regime-stat-value ${(marketRegime?.median20dReturn ?? 0) >= 0 ? 'positive' : 'negative'}`}>
              {marketRegime?.median20dReturn != null ? `${marketRegime.median20dReturn > 0 ? '+' : ''}${marketRegime.median20dReturn}%` : '—'}
            </span>
          </div>
          <div className="regime-stat">
            <span className="regime-stat-label">Stocks above their 20-day avg</span>
            <span className={`regime-stat-value ${(marketRegime?.pctAboveSma20 ?? 0) >= 50 ? 'positive' : 'negative'}`}>
              {marketRegime?.pctAboveSma20 != null ? `${marketRegime.pctAboveSma20}%` : '—'}
            </span>
          </div>
          <div className="regime-stat">
            <span className="regime-stat-label">Median 5-day move</span>
            <span className={`regime-stat-value ${(marketRegime?.median5dReturn ?? 0) >= 0 ? 'positive' : 'negative'}`}>
              {marketRegime?.median5dReturn != null ? `${marketRegime.median5dReturn > 0 ? '+' : ''}${marketRegime.median5dReturn}%` : '—'}
            </span>
          </div>
          <div className="regime-stat">
            <span className="regime-stat-label">Suggested max position</span>
            <span className="regime-stat-value" style={{ color: style.color }}>
              {marketRegime?.maxPositionPct != null ? `${marketRegime.maxPositionPct}%` : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
