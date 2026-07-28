import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, LineSeries, CandlestickSeries, AreaSeries } from 'lightweight-charts';

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
}) {
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const seriesRef = useRef();

  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        fontSize: 12,
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
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
        vertLines: { color: 'var(--border, #e5e7eb)', style: 4 }, // Dotted
        horzLines: { color: 'var(--border, #e5e7eb)', style: 4 }, // Dotted
      },
      crosshair: {
        mode: 1, // Normal mode
        vertLine: {
          width: 1,
          color: 'var(--text-muted, #9ca3af)',
          style: 3, // Dashed
          labelBackgroundColor: 'var(--text-primary, #111)',
        },
        horzLine: {
          width: 1,
          color: 'var(--text-muted, #9ca3af)',
          style: 3,
          labelBackgroundColor: 'var(--text-primary, #111)',
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
        shiftVisibleRangeOnNewBar: true,
        tickMarkFormatter: (time) => {
          if (typeof time === 'string') {
            return time; // e.g. "2026-02-12"
          }
          if (typeof time === 'number') {
            const date = new Date(time * 1000);
            if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
            }
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
          if (typeof time === 'object' && time.year && time.month && time.day) {
            return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
          }
          return String(time);
        },
      },
      rightPriceScale: {
        borderVisible: false,
      }
    });

    chartRef.current = chart;

    let series;
    if (type === 'candle') {
      series = chart.addSeries(CandlestickSeries, {
        upColor: upColor,
        downColor: downColor,
        borderVisible: false,
        wickUpColor: upColor,
        wickDownColor: downColor,
      });
    } else {
      series = chart.addSeries(AreaSeries, {
        lineColor: lineColor,
        topColor: lineColor + '33',
        bottomColor: lineColor + '00',
        lineWidth: 2,
        priceLineVisible: false,
      });
    }
    
    series.setData(data);
    seriesRef.current = series;

    chart.timeScale().fitContent();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, type, backgroundColor, textColor, upColor, downColor, lineColor]);

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
    </div>
  );
}

