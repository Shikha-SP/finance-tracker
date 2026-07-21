import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, LineSeries, CandlestickSeries } from 'lightweight-charts';

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
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      grid: {
        vertLines: { color: 'var(--border, #e5e7eb)' },
        horzLines: { color: 'var(--border, #e5e7eb)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
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
      series = chart.addSeries(LineSeries, {
        color: lineColor,
        lineWidth: 2,
      });
    }
    
    series.setData(data);
    seriesRef.current = series;

    // Force chart to fit content
    chart.timeScale().fitContent();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, type, backgroundColor, textColor, upColor, downColor, lineColor]);

  return <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />;
}
