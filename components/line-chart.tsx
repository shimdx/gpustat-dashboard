"use client";

type Point = {
  value: number | null;
  label: string;
};

type LineChartProps = {
  points: Point[];
  stroke: string;
  fill: string;
  height?: number;
  title?: string;
  suffix?: string;
};

export function LineChart({
  points,
  stroke,
  fill,
  height = 96,
  title,
  suffix = "",
}: LineChartProps) {
  const validValues = points.map((point) => point.value).filter((value): value is number => value !== null);

  if (validValues.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-[20px] border border-[var(--md-outline-variant)] bg-[var(--md-surface-container-high)] text-xs text-[var(--md-on-surface-variant)]">
        No data yet
      </div>
    );
  }

  const width = 320;
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = Math.max(max - min, 1);

  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const normalized = point.value === null ? null : (point.value - min) / range;
    const y = normalized === null ? null : height - normalized * (height - 12) - 6;
    return { x, y, value: point.value, label: point.label };
  });

  const line = coordinates
    .filter((point): point is { x: number; y: number; value: number | null; label: string } => point.y !== null)
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  const latest = validValues.at(-1);

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-[var(--md-outline-variant)] bg-[var(--md-surface-container-high)] p-3">
      {title ? (
        <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-[var(--md-on-surface-variant)]">
          <span>{title}</span>
          <span>{latest === undefined ? "n/a" : `${latest}${suffix}`}</span>
        </div>
      ) : null}
      <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full">
        <path d={area} fill={fill} opacity="0.3" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <div className="mt-2 flex items-baseline justify-between text-xs">
        <span className="text-[var(--md-on-surface-variant)]">{points[0]?.label}</span>
        <span className="font-medium text-[var(--md-on-surface)]">{latest === undefined ? "n/a" : `${latest}${suffix}`}</span>
      </div>
    </div>
  );
}
