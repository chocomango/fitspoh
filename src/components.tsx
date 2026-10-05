import { useEffect, useState, useId } from "react";
import { Pause, Play } from "lucide-react";
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
type Pose = {
  head: [number, number];
  shoulder: [number, number];
  hip: [number, number];
  elbow: [number, number];
  hand: [number, number];
  knee: [number, number];
  foot: [number, number];
};
const standing: Pose = {
  head: [100, 35],
  shoulder: [100, 60],
  hip: [100, 118],
  elbow: [125, 90],
  hand: [140, 122],
  knee: [112, 160],
  foot: [120, 198],
};
const poses: Record<string, [Pose, Pose]> = {
  squat: [
    { ...standing, elbow: [125, 55], hand: [138, 43] },
    {
      head: [95, 78],
      shoulder: [102, 102],
      hip: [70, 140],
      elbow: [123, 98],
      hand: [138, 84],
      knee: [130, 149],
      foot: [120, 198],
    },
  ],
  curl: [standing, { ...standing, elbow: [125, 90], hand: [127, 48] }],
  overhead: [
    { ...standing, elbow: [130, 75], hand: [134, 38] },
    { ...standing, elbow: [115, 22], hand: [120, 2] },
  ],
  raise: [
    { ...standing, elbow: [118, 90], hand: [126, 122] },
    { ...standing, elbow: [148, 60], hand: [182, 60] },
  ],
  row: [
    {
      ...standing,
      head: [143, 67],
      shoulder: [125, 88],
      hip: [78, 119],
      elbow: [141, 123],
      hand: [145, 153],
    },
    {
      ...standing,
      head: [143, 67],
      shoulder: [125, 88],
      hip: [78, 119],
      elbow: [98, 109],
      hand: [119, 120],
    },
  ],
  hinge: [
    { ...standing, elbow: [112, 92], hand: [112, 127] },
    {
      ...standing,
      head: [155, 90],
      shoulder: [135, 111],
      hip: [75, 120],
      elbow: [140, 147],
      hand: [144, 176],
      knee: [112, 161],
    },
  ],
  lunge: [
    { ...standing, knee: [128, 157], foot: [150, 198] },
    {
      ...standing,
      head: [100, 65],
      shoulder: [100, 90],
      hip: [100, 143],
      elbow: [125, 120],
      hand: [132, 154],
      knee: [145, 147],
      foot: [163, 198],
    },
  ],
  press: [
    {
      head: [54, 140],
      shoulder: [77, 145],
      hip: [136, 145],
      elbow: [90, 114],
      hand: [72, 98],
      knee: [162, 164],
      foot: [170, 198],
    },
    {
      head: [54, 140],
      shoulder: [77, 145],
      hip: [136, 145],
      elbow: [80, 97],
      hand: [83, 50],
      knee: [162, 164],
      foot: [170, 198],
    },
  ],
};
export function MovementDemo({ kind }: { kind: string }) {
  const [playing, setPlaying] = useState(false),
    [phase, setPhase] = useState(0);
  const [reduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (!playing) return;
    if (reduced) {
      const timer = setInterval(() => setPhase((p) => (p > 0.5 ? 0 : 1)), 1500);
      return () => clearInterval(timer);
    }
    const start = performance.now();
    let frame: number;
    const step = (time: number) => {
      setPhase((1 - Math.cos(((time - start) / 1400) * Math.PI)) / 2);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, reduced]);
  const [a, b] = poses[kind] ?? poses.curl;
  const p = {} as Pose;
  for (const key of Object.keys(a) as (keyof Pose)[])
    p[key] = [
      a[key][0] + (b[key][0] - a[key][0]) * phase,
      a[key][1] + (b[key][1] - a[key][1]) * phase,
    ];
  const points = (arr: [number, number][]) =>
    arr.map((a) => a.join(",")).join(" ");
  return (
    <div className={`demo ${reduced ? "reduced" : ""}`}>
      <svg
        viewBox="0 0 220 220"
        role="img"
        aria-label={`${kind} movement schematic, ${phase > 0.5 ? "finish" : "start"} position`}
      >
        <line x1="20" y1="202" x2="200" y2="202" stroke="#434b3b" />
        {kind === "press" && (
          <path
            d="M48 157h96m-80 0v40m68-40v40"
            stroke="#647452"
            strokeWidth="7"
          />
        )}
        <polyline
          points={points([p.shoulder, p.hip, p.knee, p.foot])}
          stroke="#ccff73"
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points={points([p.shoulder, p.elbow, p.hand])}
          stroke="#dce6cc"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={p.head[0]} cy={p.head[1]} r="14" fill="#ccff73" />
        <circle cx={p.hand[0]} cy={p.hand[1]} r="8" fill="#788962" />
        {kind === "lunge" && (
          <polyline
            points={points([p.hip, [62, 178], [48, 198]])}
            stroke="#8fba59"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
          />
        )}
        <text x="18" y="20" fill="#8f9b84" fontSize="10">
          MOVEMENT SCHEMATIC
        </text>
      </svg>
      <div className="demo-controls">
        <button className="secondary" onClick={() => setPlaying(!playing)}>
          {playing ? <Pause size={14} /> : <Play size={14} />}{" "}
          {playing ? "Pause" : "Play"}
        </button>
        <button
          className="ghost"
          onClick={() => {
            setPlaying(false);
            setPhase((p) => (p > 0.5 ? 0 : 1));
          }}
        >
          {phase > 0.5 ? "Finish" : "Start"} position
        </button>
      </div>
      <small>
        Illustrative movement pattern. Follow the exercise-specific instructions
        and photos for setup.
      </small>
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
