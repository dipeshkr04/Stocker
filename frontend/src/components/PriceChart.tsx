import type { DailyBar } from "../types";
import { useMemo, useState, type PointerEvent } from "react";

interface Props {
  bars: DailyBar[];
}

export function PriceChart({ bars }: Props) {
  if (!bars.length) return <div className="chart-empty">No historical observations available.</div>;
  return <RenderedPriceChart bars={bars} />;
}

function RenderedPriceChart({ bars }: Props) {
  const width = 900;
  const height = 340;
  const plotHeight = 286;
  const values = bars.map((bar) => bar.adjustedClose ?? bar.close);
  const min = Math.min(...values) * 0.995;
  const max = Math.max(...values) * 1.005;
  const scaleX = (index: number) => (index / Math.max(values.length - 1, 1)) * width;
  const scaleY = (value: number) => plotHeight - ((value - min) / Math.max(max - min, 0.01)) * (plotHeight - 24) - 12;
  const line = (series: number[]) => series.map((value, index) => `${scaleX(index)},${scaleY(value)}`).join(" ");
  const actual = bars.map((bar) => bar.adjustedClose ?? bar.close);
  const dates = bars.map((bar) => bar.date);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const tickIndexes = useMemo(() => {
    const count = Math.min(7, dates.length);
    if (count <= 1) return [0];
    return Array.from({ length: count }, (_, index) =>
      Math.round((index * (dates.length - 1)) / (count - 1)),
    );
  }, [dates.length]);
  const dateFormatter = useMemo(() => {
    const spanDays = (new Date(dates.at(-1)!).getTime() - new Date(dates[0]).getTime()) / 86_400_000;
    if (spanDays <= 45) return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
    if (spanDays <= 730) return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });
    return new Intl.DateTimeFormat(undefined, { year: "numeric" });
  }, [dates]);
  const formatDate = (date: string) => dateFormatter.format(new Date(`${date}T00:00:00`));
  const hoverValue = hoverIndex === null ? null : values[hoverIndex];
  const hoverDate = hoverIndex === null ? null : dates[hoverIndex];
  const handlePointerMove = (event: PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const chartX = ((event.clientX - bounds.left) / bounds.width) * width;
    const nextIndex = Math.max(0, Math.min(values.length - 1, Math.round((chartX / width) * (values.length - 1))));
    setHoverIndex(nextIndex);
  };
  return (
    <div className="chart-wrap">
      <div className="chart-visual">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Historical and forecast price chart">
          <line x1="0" y1={plotHeight} x2={width} y2={plotHeight} className="chart-axis" />
          {tickIndexes.map((index) => (
            <g key={dates[index]} className="chart-tick">
              <line x1={scaleX(index)} y1={plotHeight + 1} x2={scaleX(index)} y2={plotHeight + 7} />
              <text x={scaleX(index)} y={height - 7} textAnchor={index === 0 ? "start" : index === dates.length - 1 ? "end" : "middle"}>
                {formatDate(dates[index])}
              </text>
            </g>
          ))}
          {hoverIndex !== null && (
            <g className="chart-hover" pointerEvents="none">
              <line x1={scaleX(hoverIndex)} y1="0" x2={scaleX(hoverIndex)} y2={plotHeight} />
              <circle cx={scaleX(hoverIndex)} cy={scaleY(hoverValue!)} r="5" />
              <g transform={`translate(${Math.min(Math.max(scaleX(hoverIndex) - 70, 4), width - 144)}, 8)`}>
                <rect width="140" height="45" rx="6" />
                <text x="9" y="17">{formatDate(hoverDate!)}</text>
                <text x="9" y="35" className="chart-hover-value">{hoverValue!.toFixed(2)}</text>
              </g>
            </g>
          )}
          <polyline points={line(actual)} className="chart-actual" />
          {actual.length === 1 && <circle cx={scaleX(0)} cy={scaleY(actual[0])} r="6" className="chart-single-point" />}
          <rect
            x="0"
            y="0"
            width={width}
            height={plotHeight}
            className="chart-hit-area"
            aria-label={hoverDate ? `${formatDate(hoverDate)} ${hoverValue?.toFixed(2)}` : "Explore chart values"}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          />
        </svg>
        {hoverDate && <div className="chart-readout"><strong>{formatDate(hoverDate)}</strong><span>{hoverValue!.toFixed(2)}</span></div>}
      </div>
      <div className="chart-legend"><span><i className="legend-dot actual" />Observed close</span></div>
    </div>
  );
}
