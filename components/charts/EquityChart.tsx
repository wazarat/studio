"use client";

import { LineSeries, LineStyle, createChart, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { useEffect, useRef } from "react";

import { baseChartOptions, useChartColors } from "@/components/charts/chartTheme";
import { toChartTime, type EquitySeries } from "@/lib/strategies/chart-data";
import { formatUsd } from "@/lib/venues/format";

/** Equity against buy and hold (Studio step 4b), same theme and lifecycle as the price chart. */
export function EquityChart({ series }: { series: EquitySeries }) {
  const colors = useChartColors();
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const strategy = useRef<ISeriesApi<"Line"> | null>(null);
  const hold = useRef<ISeriesApi<"Line"> | null>(null);
  const colorsRef = useRef(colors);
  colorsRef.current = colors;

  useEffect(() => {
    if (!el.current) return;
    const c = colorsRef.current;
    const api = createChart(el.current, baseChartOptions(c));
    const fmt = { type: "custom" as const, formatter: (v: number) => formatUsd(v, 0), minMove: 0.01 };
    strategy.current = api.addSeries(LineSeries, { color: c.electric, lineWidth: 2, priceLineVisible: false, title: "Strategy", priceFormat: fmt });
    hold.current = api.addSeries(LineSeries, { color: c.muted, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, title: "Buy and hold", priceFormat: fmt });
    chart.current = api;
    return () => {
      api.remove();
      chart.current = null;
      strategy.current = null;
      hold.current = null;
    };
  }, []);

  useEffect(() => {
    const api = chart.current;
    if (!api || !strategy.current || !hold.current) return;
    strategy.current.setData(series.strategy.map((p) => ({ time: toChartTime(p.time) as Time, value: p.value })));
    hold.current.setData(series.buyAndHold.map((p) => ({ time: toChartTime(p.time) as Time, value: p.value })));
    api.timeScale().fitContent();
  }, [series]);

  useEffect(() => {
    chart.current?.applyOptions(baseChartOptions(colors));
    strategy.current?.applyOptions({ color: colors.electric });
    hold.current?.applyOptions({ color: colors.muted });
  }, [colors]);

  return <div ref={el} className="h-full w-full" />;
}
