"use client";

import {
  CandlestickSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

import { baseChartOptions, useChartColors, type ChartColors } from "@/components/charts/chartTheme";
import { toChartTime, type ChartMarker, type Overlay, type Pane } from "@/lib/strategies/chart-data";
import type { Candle } from "@/lib/venues/types";

/**
 * The price chart (Studio step 4b): daily candles, the rule's lines,
 * RSI in its own pane and the backtest's entry and exit markers. One
 * chart instance for the life of the component; data changes go through
 * setData, theme changes through applyOptions, never a rebuild.
 */
export interface PriceChartProps {
  candles: Candle[];
  overlays: Overlay[];
  pane: Pane | null;
  markers: ChartMarker[];
  priceLines?: { price: number; title: string; color: keyof ChartColors }[];
}

function toLine(values: number[], candles: Candle[]) {
  return candles.map((c, i) =>
    Number.isFinite(values[i]) ? { time: toChartTime(c.time) as Time, value: values[i] } : { time: toChartTime(c.time) as Time },
  );
}

export function PriceChart({ candles, overlays, pane, markers, priceLines = [] }: PriceChartProps) {
  const colors = useChartColors();
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markerPlugin = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const overlaySeries = useRef(new Map<string, ISeriesApi<"Line">>());
  const paneSeries = useRef<ISeriesApi<"Line"> | null>(null);
  const paneLines = useRef<IPriceLine[]>([]);
  const levelLines = useRef<IPriceLine[]>([]);
  const colorsRef = useRef(colors);
  colorsRef.current = colors;

  useEffect(() => {
    if (!el.current) return;
    const c = colorsRef.current;
    const api = createChart(el.current, baseChartOptions(c));
    const series = api.addSeries(CandlestickSeries, {
      upColor: c.up,
      downColor: c.down,
      wickUpColor: c.up,
      wickDownColor: c.down,
      borderVisible: false,
      priceLineVisible: false,
    });
    chart.current = api;
    candleSeries.current = series;
    markerPlugin.current = createSeriesMarkers(series, []);
    return () => {
      api.remove();
      chart.current = null;
      candleSeries.current = null;
      markerPlugin.current = null;
      overlaySeries.current.clear();
      paneSeries.current = null;
      paneLines.current = [];
      levelLines.current = [];
    };
  }, []);

  // Candles: the only place the view is re-fitted.
  useEffect(() => {
    const api = chart.current;
    const series = candleSeries.current;
    if (!api || !series) return;
    series.setData(candles.map((c) => ({ time: toChartTime(c.time) as Time, open: c.open, high: c.high, low: c.low, close: c.close })));
    api.timeScale().fitContent();
  }, [candles]);

  // Overlays reconciled by key.
  useEffect(() => {
    const api = chart.current;
    if (!api) return;
    const live = overlaySeries.current;
    const wanted = new Set(overlays.map((o) => o.key));
    for (const [key, s] of live) {
      if (!wanted.has(key)) {
        api.removeSeries(s);
        live.delete(key);
      }
    }
    for (const o of overlays) {
      let s = live.get(o.key);
      const color = colorsRef.current[o.color === "text" ? "strong" : o.color];
      if (!s) {
        s = api.addSeries(LineSeries, {
          color,
          lineWidth: 1,
          lineStyle: o.dashed ? LineStyle.Dashed : LineStyle.Solid,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          title: o.title,
        });
        live.set(o.key, s);
      } else {
        s.applyOptions({ color, title: o.title, lineStyle: o.dashed ? LineStyle.Dashed : LineStyle.Solid });
      }
      s.setData(toLine(o.values, candles));
    }
  }, [overlays, candles]);

  // The RSI pane.
  useEffect(() => {
    const api = chart.current;
    if (!api) return;
    if (!pane) {
      if (paneSeries.current) {
        api.removeSeries(paneSeries.current);
        paneSeries.current = null;
        paneLines.current = [];
      }
      return;
    }
    let s = paneSeries.current;
    if (!s) {
      s = api.addSeries(
        LineSeries,
        {
          color: colorsRef.current.signal,
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          title: pane.title,
          autoscaleInfoProvider: () => ({ priceRange: { minValue: pane.range[0], maxValue: pane.range[1] } }),
        },
        1,
      );
      paneSeries.current = s;
      const panes = api.panes();
      if (panes.length > 1) {
        panes[0].setStretchFactor(3);
        panes[1].setStretchFactor(1);
      }
    } else {
      s.applyOptions({ title: pane.title });
    }
    for (const l of paneLines.current) s.removePriceLine(l);
    paneLines.current = pane.lines.map((l) =>
      s!.createPriceLine({ price: l.value, color: colorsRef.current.muted, lineStyle: LineStyle.Dashed, lineWidth: 1, title: l.title, axisLabelVisible: true }),
    );
    s.setData(toLine(pane.values, candles));
  }, [pane, candles]);

  // Horizontal levels on the price pane.
  useEffect(() => {
    const series = candleSeries.current;
    if (!series) return;
    for (const l of levelLines.current) series.removePriceLine(l);
    levelLines.current = priceLines.map((l) =>
      series.createPriceLine({ price: l.price, color: colorsRef.current[l.color], lineStyle: LineStyle.Dotted, lineWidth: 1, title: l.title, axisLabelVisible: true }),
    );
  }, [priceLines]);

  // Markers.
  useEffect(() => {
    const plugin = markerPlugin.current;
    if (!plugin) return;
    const c = colorsRef.current;
    const data: SeriesMarker<Time>[] = markers.map((m) => ({
      time: toChartTime(m.time) as Time,
      position: m.kind === "entry" ? "belowBar" : m.kind === "exit" ? "aboveBar" : "inBar",
      shape: m.kind === "entry" ? "arrowUp" : m.kind === "exit" ? "arrowDown" : "circle",
      color: m.kind === "entry" ? c.electric : m.kind === "exit" ? c.strong : c.muted,
      text: m.text,
      size: m.kind === "refused" ? 0.6 : 1,
    }));
    plugin.setMarkers(data);
  }, [markers]);

  // Theme.
  useEffect(() => {
    const api = chart.current;
    if (!api) return;
    api.applyOptions(baseChartOptions(colors));
    candleSeries.current?.applyOptions({ upColor: colors.up, downColor: colors.down, wickUpColor: colors.up, wickDownColor: colors.down });
    for (const o of overlays) overlaySeries.current.get(o.key)?.applyOptions({ color: colors[o.color === "text" ? "strong" : o.color] });
    paneSeries.current?.applyOptions({ color: colors.signal });
  }, [colors, overlays]);

  return <div ref={el} className="h-full w-full" />;
}
