import { useTx } from '../context/TxContext';

export default function Ticker() {
  const { total, income, expense, byCategory, healthScore } = useTx();
  
  const fmt = n => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  // Compute top category
  let topCat = { label: 'Top Expense', val: 'None' };
  const entries = Object.entries(byCategory).sort((a,b) => b[1]-a[1]);
  if (entries.length > 0) {
    topCat = { label: \`Top Exp: \${entries[0][0]}\`, val: fmt(entries[0][1]), up: false, change: '' };
  }

  const items = [
    { label: 'NET WORTH', val: total < 0 ? \`-\${fmt(total)}\` : fmt(total), up: total >= 0, change: '' },
    { label: 'INCOME', val: fmt(income), up: true, change: '' },
    { label: 'SPENT', val: fmt(expense), up: false, change: '' },
    { label: 'SAVINGS RATE', val: income > 0 ? \`\${Math.round(((income - expense) / income) * 100)}%\` : '0%', up: income > expense, change: '' },
    topCat,
    { label: 'FINANCIAL HEALTH', val: \`\${healthScore}/100\`, up: healthScore >= 50, change: '' },
  ];

  // Duplicate items for infinite scroll effect
  const trackItems = [...items, ...items, ...items];

  return (
    <div className="ticker-container">
      <div className="ticker-track">
        {trackItems.map((item, i) => (
          <span className="ticker-item" key={i}>
            <span className="ticker-label">{item.label}</span>
            <span className="ticker-val">{item.val}</span>
            {item.change !== '' && (
              <span className={\`ticker-change \${item.up ? 'positive' : 'negative'}\`}>
                {item.up ? '▲' : '▼'} {item.change}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
