export default function Ticker() {
  const items = [
    { label: 'FTSE 100', val: '7,942.30', change: '+0.54%', up: true },
    { label: 'S&P 500', val: '5,234.18', change: '-0.21%', up: false },
    { label: 'NASDAQ', val: '16,340.50', change: '+0.88%', up: true },
    { label: 'GOLD', val: '2,340.10', change: '+1.20%', up: true },
    { label: 'EUR/USD', val: '1.0842', change: '-0.11%', up: false },
    { label: 'BTC/USD', val: '64,210.00', change: '+2.40%', up: true },
    { label: 'CRUDE OIL', val: '83.20', change: '-0.50%', up: false },
  ];

  // Duplicate items for infinite scroll effect
  const trackItems = [...items, ...items];

  return (
    <div className="ticker-container">
      <div className="ticker-track">
        {trackItems.map((item, i) => (
          <span className="ticker-item" key={i}>
            <span className="ticker-label">{item.label}</span>
            <span className="ticker-val">{item.val}</span>
            <span className={`ticker-change ${item.up ? 'positive' : 'negative'}`}>
              {item.up ? '▲' : '▼'} {item.change}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
