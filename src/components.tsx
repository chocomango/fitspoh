import { useId } from "react";
export function Chart({
  points,
  goal,
  label = "Value",
}: {
  points: { date: string; value: number }[];
  goal?: number;
  label?: string;
}) {
  const gradientId = useId();
  if (!points.length)
    return (
      <div className="chart-empty">
        Your progress starts with your first entry.
      </div>
    );
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const values = sorted.map((p) => p.value);
  const lo = Math.min(...values, goal ?? Infinity);
  const hi = Math.max(...values, goal ?? -Infinity);
  const span = Math.max(hi - lo, 1);
  const min = lo - span * 0.15,
    max = hi + span * 0.15;
  const from = Date.parse(sorted[0].date),
    to = Date.parse(sorted.at(-1)!.date);
  const x = (p: { date: string }) =>
    40 + (to === from ? 0.5 : (Date.parse(p.date) - from) / (to - from)) * 530;
  const y = (v: number) => 160 - ((v - min) / (max - min)) * 130;
  return (
    <div className="chart">
      <svg viewBox="0 0 610 200" role="img" aria-label={`${label} over time`}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--chart-line, #ccff73)"
              stopOpacity=".25"
            />
            <stop
              offset="100%"
              stopColor="var(--chart-line, #ccff73)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="40"
              x2="570"
              y1={30 + i * 43}
              y2={30 + i * 43}
              stroke="var(--chart-grid, #303730)"
              strokeDasharray="4 5"
            />
            <text x="1" y={34 + i * 43} fill="var(--muted)" fontSize="10">
              {(max - ((max - min) * i) / 3).toFixed(1)}
            </text>
          </g>
        ))}
        {goal !== undefined && (
          <g>
            <line
              x1="40"
              x2="570"
              y1={y(goal)}
              y2={y(goal)}
              stroke="var(--chart-goal, #a9b2ff)"
              strokeDasharray="5 4"
            />
            <text
              x="570"
              y={y(goal) - 6}
              textAnchor="end"
              fill="var(--chart-goal, #a9b2ff)"
              fontSize="10"
            >
              Goal {goal.toFixed(1)}
            </text>
          </g>
        )}
        <path
          d={`M ${sorted.map((p) => `${x(p)} ${y(p.value)}`).join(" L ")} L ${x(sorted.at(-1)!)} 160 L ${x(sorted[0])} 160 Z`}
          fill={`url(#${gradientId})`}
        />
        <polyline
          points={sorted.map((p) => `${x(p)},${y(p.value)}`).join(" ")}
          fill="none"
          stroke="var(--chart-line, #ccff73)"
          strokeWidth="2.5"
        />
        {sorted.map((p, i) => (
          <circle
            key={i}
            cx={x(p)}
            cy={y(p.value)}
            r="4"
            fill="var(--chart-line, #ccff73)"
          >
            <title>
              {new Date(p.date).toLocaleDateString()}: {p.value.toFixed(2)}{" "}
              {label}
            </title>
          </circle>
        ))}
        <text x="40" y="190" fill="var(--muted)" fontSize="11">
          {new Date(sorted[0].date).toLocaleDateString()}
        </text>
        <text
          x="570"
          y="190"
          textAnchor="end"
          fill="var(--muted)"
          fontSize="11"
        >
          {new Date(sorted.at(-1)!.date).toLocaleDateString()}
        </text>
      </svg>
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">＋</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
