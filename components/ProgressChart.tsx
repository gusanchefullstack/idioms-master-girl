/** Inline SVG line chart of daily scores – no chart library, works offline (research R12). */
export default function ProgressChart({ series }: { series: { date: string; daily: number | null }[] }) {
  const W = 640;
  const H = 220;
  const pad = { l: 34, r: 12, t: 12, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (series.length > 1 ? (i / (series.length - 1)) * iw : iw / 2);
  const y = (v: number) => pad.t + ih - (v / 100) * ih;

  // Break the line where a day is missing.
  const segments: string[] = [];
  let cur = "";
  series.forEach((p, i) => {
    if (p.daily == null) {
      if (cur) segments.push(cur);
      cur = "";
      return;
    }
    cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(p.daily).toFixed(1)}`;
  });
  if (cur) segments.push(cur);

  const labelEvery = Math.ceil(series.length / 6);
  const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const completed = series.filter((p) => p.daily != null).length;

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Daily scores for the last ${series.length} days; ${completed} days completed.`}
    >
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line className="grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
          <text className="axis-label" x={pad.l - 6} y={y(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {series.map((p, i) =>
        i % labelEvery === 0 || i === series.length - 1 ? (
          <text
            key={p.date}
            className="axis-label"
            x={x(i)}
            y={H - 8}
            textAnchor={i === series.length - 1 ? "end" : i === 0 ? "start" : "middle"}
          >
            {fmt(p.date)}
          </text>
        ) : null,
      )}
      {segments.map((d) => (
        <path key={d} className="line" d={d} />
      ))}
      {series.map((p, i) =>
        p.daily != null ? (
          <circle key={p.date} className="dot" cx={x(i)} cy={y(p.daily)} r={4}>
            <title>{`${fmt(p.date)}: ${p.daily}`}</title>
          </circle>
        ) : null,
      )}
    </svg>
  );
}
