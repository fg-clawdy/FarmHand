type Series = { key: string; label: string; color: string; values: number[] };

function niceMax(n: number) {
  if (n <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(n));
  const norm = n / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

export function GroupedBarChart({
  labels,
  series,
  height = 220,
}: {
  labels: string[];
  series: Series[];
  height?: number;
}) {
  const width = Math.max(420, labels.length * 48);
  const pad = { top: 16, right: 12, bottom: 36, left: 32 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const groupW = innerW / Math.max(1, labels.length);
  const barW = Math.max(4, (groupW * 0.72) / Math.max(1, series.length));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart" role="img">
      {[0, 0.5, 1].map((t) => {
        const y = pad.top + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#c9b48a" strokeDasharray="3 4" />
            <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#5c3218">
              {Math.round(max * t)}
            </text>
          </g>
        );
      })}
      {labels.map((label, i) => {
        const gx = pad.left + i * groupW + groupW * 0.14;
        return (
          <g key={label}>
            {series.map((s, si) => {
              const v = s.values[i] ?? 0;
              const h = (v / max) * innerH;
              const x = gx + si * barW;
              const y = pad.top + innerH - h;
              return <rect key={s.key} x={x} y={y} width={barW - 2} height={Math.max(0, h)} fill={s.color} rx="2" />;
            })}
            <text
              x={pad.left + i * groupW + groupW / 2}
              y={height - 10}
              textAnchor="middle"
              fontSize="10"
              fill="#5c3218"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function MixBars({
  title,
  counts,
  total,
  pct,
}: {
  title: string;
  counts: Record<string, number>;
  total: number;
  pct: Record<string, number>;
}) {
  const rows = [
    { key: "corn", label: "Corn", color: "#d7a441" },
    { key: "strawberry", label: "Strawberry", color: "#9b2c1f" },
    { key: "cotton", label: "Cotton", color: "#6b7c8a" },
  ];
  return (
    <div>
      <p className="muted" style={{ margin: "0 0 8px" }}>
        {title} · {total} total
      </p>
      {rows.map((row) => (
        <div className="mix-row" key={row.key}>
          <span>{row.label}</span>
          <div className="mix-track">
            <div className="mix-fill" style={{ width: `${pct[row.key] ?? 0}%`, background: row.color }} />
          </div>
          <strong>
            {counts[row.key] ?? 0} ({pct[row.key] ?? 0}%)
          </strong>
        </div>
      ))}
    </div>
  );
}
