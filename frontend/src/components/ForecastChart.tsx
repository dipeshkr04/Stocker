import { useMemo, useState, type PointerEvent } from "react";
import type { ForecastPoint } from "../types";

interface Props {
  lastObservedDate: string;
  lastObservedValue: number;
  points: ForecastPoint[];
  currency: string;
}

const formatValue = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);

export function ForecastChart({ lastObservedDate, lastObservedValue, points, currency }: Props) {
  const width = 900;
  const height = 340;
  const plotHeight = 286;
  const dates = [lastObservedDate, ...points.map((point) => point.date)];
  const values = [lastObservedValue, ...points.map((point) => point.predictedValue)];
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const min = Math.min(...values) * 0.995;
  const max = Math.max(...values) * 1.005;
  const scaleX = (index: number) => (index / Math.max(values.length - 1, 1)) * width;
  const scaleY = (value: number) => plotHeight - ((value - min) / Math.max(max - min, 0.01)) * (plotHeight - 24) - 12;
  const dateFormatter = useMemo(() => {
    const spanDays = (new Date(dates.at(-1)!).getTime() - new Date(dates[0]).getTime()) / 86_400_000;
    return new Intl.DateTimeFormat(undefined, spanDays <= 45
      ? { month: "short", day: "numeric" }
      : spanDays <= 730 ? { month: "short", year: "numeric" } : { year: "numeric" });
  }, [dates]);
  const formatDate = (date: string) => dateFormatter.format(new Date(`${date.slice(0, 10)}T12:00:00`));
  const tickIndexes = useMemo(() => {
    const count = Math.min(7, dates.length);
    if (count <= 1) return [0];
    return Array.from({ length: count }, (_, index) => Math.round((index * (dates.length - 1)) / (count - 1)));
  }, [dates.length]);
  const line = values.map((value, index) => `${scaleX(index)},${scaleY(value)}`).join(" ");
  const handlePointerMove = (event: PointerEvent<SVGRectElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const chartX = ((event.clientX - bounds.left) / bounds.width) * width;
    setHoverIndex(Math.max(0, Math.min(values.length - 1, Math.round((chartX / width) * (values.length - 1)))));
  };
  const hoverValue = hoverIndex === null ? null : values[hoverIndex];
  const hoverDate = hoverIndex === null ? null : dates[hoverIndex];

  return (
    <div className="chart-wrap forecast-chart-wrap">
      <div className="chart-visual">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Forecast price chart">
          <line x1="0" y1={plotHeight} x2={width} y2={plotHeight} className="chart-axis" />
          {tickIndexes.map((index) => <g key={dates[index]} className="chart-tick">
            <line x1={scaleX(index)} y1={plotHeight + 1} x2={scaleX(index)} y2={plotHeight + 7} />
            <text x={scaleX(index)} y={height - 7} textAnchor={index === 0 ? "start" : index === dates.length - 1 ? "end" : "middle"}>{formatDate(dates[index])}</text>
          </g>)}
          <polyline points={line} className="chart-forecast" />
          {hoverIndex !== null && <g className="chart-hover" pointerEvents="none">
            <line x1={scaleX(hoverIndex)} y1="0" x2={scaleX(hoverIndex)} y2={plotHeight} />
            <circle cx={scaleX(hoverIndex)} cy={scaleY(hoverValue!)} r="5" />
            <g transform={`translate(${Math.min(Math.max(scaleX(hoverIndex) - 70, 4), width - 144)}, 8)`}>
              <rect width="140" height="45" rx="6" />
              <text x="9" y="17">{formatDate(hoverDate!)}</text>
              <text x="9" y="35" className="chart-hover-value">{formatValue(hoverValue!, currency)}</text>
            </g>
          </g>}
          <rect x="0" y="0" width={width} height={plotHeight} className="chart-hit-area" aria-label="Explore forecast values" onPointerMove={handlePointerMove} onPointerLeave={() => setHoverIndex(null)} />
        </svg>
      </div>
      <div className="chart-legend"><span><i className="legend-dot forecast" />Forecast estimate</span><span className="source-label">Starts at last observed close</span></div>
    </div>
  );
}
