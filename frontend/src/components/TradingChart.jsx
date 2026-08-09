import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, AreaSeries } from 'lightweight-charts';

function resolveColor(value) {
  if (typeof value !== 'string' || !value.includes('var(')) return value;
  const probe = document.createElement('span');
  probe.style.color = value;
  document.body.appendChild(probe);
  const resolved = window.getComputedStyle(probe).color;
  document.body.removeChild(probe);
  return resolved || value;
}

function withAlpha(rgb, alpha) {
  if (alpha <= 0) return 'rgba(0, 0, 0, 0)';
  const parts = String(rgb).match(/[\d.]+/g);
  if (parts && parts.length >= 3) return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  return rgb;
}

function formatDateLabel(time) {
  // Accepts ISO "YYYY-MM-DD" strings, "YYYY-MM-DD HH:mm:ss" strings, epoch
  // seconds numbers, or lightweight-charts BusinessDay objects, and returns a
  // compact label like "Aug 6 '26" or "10:30 AM".
  let date = null;
  let isIntraday = false;

  if (typeof time === 'string') {
    const clean = time.includes(' ') ? time.replace(' ', 'T') : time;
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      date = parsed;
      isIntraday = time.includes(' ');
    }
  } else if (typeof time === 'number') {
    date = new Date(time * 1000);
    isIntraday = !(date.getUTCHours() === 0 && date.getUTCMinutes() === 0);
  } else if (time && typeof time === 'object' && time.year && time.month && time.day) {
    date = new Date(Date.UTC(time.year, time.month - 1, time.day));
  }

  if (!date || isNaN(date.getTime())) return String(time);

  if (isIntraday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

export default function TradingChart({
  data,
  type = 'candle', // 'candle' or 'line'
  colors: {
    backgroundColor = 'transparent',
    textColor = 'var(--text-primary, #111)',
    upColor = 'var(--green, #10b981)',
    downColor = 'var(--red, #ef4444)',
    lineColor = 'var(--accent, #3b82f6)',
  } = {},
  areaOpacity = 0.2,
  showZoomControls = true,
}) {
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const seriesRef = useRef();

  // Re-resolve CSS-variable colors whenever the app theme (light/dark) changes.
  const [themeVersion, setThemeVersion] = useState(0);

  useEffect(() => {
    const handler = () => setThemeVersion(v => v + 1);
    window.addEventListener('themechange', handler);
    return () => window.removeEventListener('themechange', handler);
  }, []);

  useEffect(() => {
    void themeVersion; // re-run this effect when the theme changes
    const resolvedBg = resolveColor(backgroundColor);
    const resolvedText = resolveColor(textColor);
    const resolvedBorder = resolveColor('var(--border, #27272a)');
    const resolvedMuted = resolveColor('var(--text-muted, #94a3b8)');
    const resolvedUp = resolveColor(upColor);
    const resolvedDown = resolveColor(downColor);
    const resolvedLine = resolveColor(lineColor);

    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: resolvedBg },
        textColor: resolvedText,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        fontSize: 12,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      grid: {
        vertLines: { color: resolvedBorder, style: 4 }, // Dotted
        horzLines: { color: resolvedBorder, style: 4 }, // Dotted
      },
      crosshair: {
        mode: 1, // Normal mode
        vertLine: {
          width: 1,
          color: resolvedMuted,
          style: 3, // Dashed
          labelBackgroundColor: resolvedBorder,
        },
        horzLine: {
          width: 1,
          color: resolvedMuted,
          style: 3,
          labelBackgroundColor: resolvedBorder,
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
        shiftVisibleRangeOnNewBar: true,
        tickMarkFormatter: formatDateLabel,
      },
      rightPriceScale: {
        borderVisible: false,
      }
    });

    chartRef.current = chart;

    // Daily (date-string) records merged from close-only sources (e.g. the recent
    // NEPSE index series) arrive as flat candles (open=high=low=close). Those
    // have no real OHLC, so render only genuine candles and overlay a thin line
    // of the real closes so the series still runs to today.
    const isDailyStrings = data.length > 0 && typeof data[0].time === 'string';
    const hasRealOhlc = d => !(d.open === d.high && d.high === d.low && d.low === d.close);
    const candleData = isDailyStrings ? data.filter(hasRealOhlc) : data;
    const closeData = type === 'candle'
      ? data.map(d => ({ time: d.time, value: d.close }))
      : data;

    if (type === 'candle') {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: resolvedUp,
        downColor: resolvedDown,
        borderVisible: false,
        wickUpColor: resolvedUp,
        wickDownColor: resolvedDown,
      });
      candleSeries.setData(candleData);
      seriesRef.current = candleSeries;

      if (closeData.length > 0) {
        const closeLine = chart.addSeries(AreaSeries, {
          lineColor: resolvedLine,
          topColor: 'rgba(0, 0, 0, 0)',
          bottomColor: 'rgba(0, 0, 0, 0)',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        closeLine.setData(closeData);
      }
    } else {
      const series = chart.addSeries(AreaSeries, {
        lineColor: resolvedLine,
        topColor: withAlpha(resolvedLine, areaOpacity),
        bottomColor: withAlpha(resolvedLine, 0),
        lineWidth: 2,
        priceLineVisible: false,
      });
      series.setData(closeData);
      seriesRef.current = series;
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
    };
    }, [data, type, backgroundColor, textColor, upColor, downColor, lineColor, themeVersion, areaOpacity]);

  const zoomIn = () => {
    if (chartRef.current) {
      const ts = chartRef.current.timeScale();
      const logicalRange = ts.getVisibleLogicalRange();
      if (logicalRange) {
        const span = logicalRange.to - logicalRange.from;
        const newSpan = span * 0.7; // zoom in by 30%
        const mid = (logicalRange.from + logicalRange.to) / 2;
        ts.setVisibleLogicalRange({ from: mid - newSpan / 2, to: mid + newSpan / 2 });
      }
    }
  };

  const zoomOut = () => {
    if (chartRef.current) {
      const ts = chartRef.current.timeScale();
      const logicalRange = ts.getVisibleLogicalRange();
      if (logicalRange) {
        const span = logicalRange.to - logicalRange.from;
        const newSpan = span * 1.4; // zoom out by 40%
        const mid = (logicalRange.from + logicalRange.to) / 2;
        ts.setVisibleLogicalRange({ from: mid - newSpan / 2, to: mid + newSpan / 2 });
      }
    }
  };

  const resetZoom = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
      {/* Interactive Floating Zoom Controls */}
      {showZoomControls && (
      <div style={{
        position: 'absolute', bottom: '12px', right: '12px', zIndex: 5,
        display: 'flex', gap: '4px', background: 'var(--bg-glass, rgba(15,23,42,0.85))',
        backdropFilter: 'blur(8px)', padding: '4px 6px', borderRadius: '6px', border: '1px solid var(--border, #334155)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}>
        <button
          onClick={zoomIn}
          title="Zoom In (Scroll wheel / pinch)"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary, #fff)', cursor: 'pointer', padding: '2px 6px', fontSize: '13px', fontWeight: 'bold' }}
        >+</button>
        <button
          onClick={zoomOut}
          title="Zoom Out"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-primary, #fff)', cursor: 'pointer', padding: '2px 6px', fontSize: '13px', fontWeight: 'bold' }}
        >−</button>
        <button
          onClick={resetZoom}
          title="Reset View"
          style={{ background: 'transparent', border: 'none', color: 'var(--accent, #3b82f6)', cursor: 'pointer', padding: '2px 6px', fontSize: '11px', fontWeight: 600 }}
        >Reset</button>
      </div>
      )}
    </div>
  );
}

