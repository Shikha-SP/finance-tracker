import { useState, useEffect } from 'react';
import { useTx } from '../context/TxContext';

const fmtNPR = n => 'रू ' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

// Simulated NEPSE ticker data — refreshed periodically
function getNepseItems() {
  const base = [
    { label: 'NEPSE',     val: 2074.56, chg: -8.34,   pct: -0.40 },
    { label: 'SENSITIVE', val: 418.22,  chg: -1.22,   pct: -0.29 },
    { label: 'FLOAT',     val: 157.88,  chg: -0.65,   pct: -0.41 },
    { label: 'NABIL',     val: 920,     chg: 42,      pct: 4.78  },
    { label: 'NTC',       val: 780,     chg: 32,      pct: 4.28  },
    { label: 'UPPER',     val: 612,     chg: -38,     pct: -5.84 },
    { label: 'GBIME',     val: 345,     chg: 15,      pct: 4.54  },
    { label: 'NIBL',      val: 623,     chg: -22,     pct: -3.41 },
    { label: 'NICA',      val: 567,     chg: 21,      pct: 3.84  },
    { label: 'ADBL',      val: 412,     chg: 14,      pct: 3.52  },
  ];
  return base;
}

export default function Ticker() {
  const { total, income, expense, healthScore } = useTx();
  const [nepseItems, setNepseItems] = useState(getNepseItems());

  // Slightly fluctuate values every 30 seconds to feel alive
  useEffect(() => {
    const id = setInterval(() => {
      setNepseItems(prev =>
        prev.map(item => ({
          ...item,
          val: +(item.val + (Math.random() - 0.5) * item.val * 0.002).toFixed(2),
          chg: +(item.chg + (Math.random() - 0.5) * 0.5).toFixed(2),
        }))
      );
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const budgetItems = [
    { label: 'PORTFOLIO', val: fmtNPR(total), up: total >= 0, change: '' },
    { label: 'INCOME',    val: fmtNPR(income), up: true, change: '' },
    { label: 'SPENT',     val: fmtNPR(expense), up: false, change: '' },
    { label: 'HEALTH',    val: `${healthScore}/100`, up: healthScore >= 50, change: '' },
  ];

  // Interleave budget and market items
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
