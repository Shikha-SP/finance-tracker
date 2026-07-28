import { useState, useEffect } from 'react';
import { useTx } from '../context/TxContext';

const API_BASE = 'http://localhost:5000/api';

const fmtNPR = n => 'रू ' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function Ticker() {
  const { total, income, expense, healthScore } = useTx();
  const [nepseItems, setNepseItems] = useState([]);

  useEffect(() => {
    // Fetch real indices for the ticker
    fetch(`${API_BASE}/nepse/indices`)
      .then(res => res.json())
      .then(data => {
        if (data && data.indices) {
          const items = data.indices.slice(0, 10).map(idx => ({
            label: idx.name.toUpperCase(),
            val: idx.value,
            chg: idx.change,
            pct: idx.changePct
          }));
          setNepseItems(items);
        }
      })
      .catch(() => {}); // silently fail and just show budget items
  }, []);

  const budgetItems = [
    { label: 'PORTFOLIO', val: fmtNPR(total), up: total >= 0, change: '' },
    { label: 'INCOME',    val: fmtNPR(income), up: true, change: '' },
    { label: 'SPENT',     val: fmtNPR(expense), up: false, change: '' },
    { label: 'HEALTH',    val: `${healthScore}/100`, up: healthScore >= 50, change: '' },
  ];

  const allItems = [
    ...budgetItems,
    ...nepseItems.map(n => ({
      label: n.label,
      val: n.val.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      up: n.chg >= 0,
      change: `${n.chg >= 0 ? '+' : ''}${n.pct.toFixed(2)}%`,
    })),
  ];

  const trackItems = [...allItems, ...allItems, ...allItems];

  return (
    <div className="ticker-container">
      <div className="ticker-track">
        {trackItems.map((item, i) => (
          <span className="ticker-item" key={i}>
            <span className="ticker-label">{item.label}</span>
            <span className="ticker-val">{item.val}</span>
            {item.change !== '' && (
              <span className={`ticker-change ${item.up ? 'positive' : 'negative'}`}>
                {item.up ? '▲' : '▼'} {item.change}
              </span>
            )}
            <span className="ticker-separator">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
