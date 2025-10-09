import React from 'react';

const StatsRadar = ({ stats = {}, size = 220, maxOverrides = {}, isDark: propIsDark }) => {
  // Determine dark mode: prefer explicit prop, otherwise read data-theme
  const isDark =
    typeof propIsDark === 'boolean'
      ? propIsDark
      : (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark');

  // Base axes (keep groupMultiplier here so we can conditionally remove it)
  const axisConfigBase = [
    { key: 'multiplier', label: 'Multiplier', max: maxOverrides.multiplier || 5 },
    { key: 'groupMultiplier', label: 'Group Multiplier', max: maxOverrides.groupMultiplier || 5 },
    { key: 'luck', label: 'Luck', max: maxOverrides.luck || 5 },
    { key: 'attackPower', label: 'Attack', max: maxOverrides.attackPower || 10 },
    { key: 'shieldCount', label: 'Shield', max: maxOverrides.shieldCount || 3 },
    { key: 'discountShop', label: 'Discount', max: maxOverrides.discountShop || 100 }
  ];

  // Hide "Group Multiplier" axis unless the value is greater than 1
  const groupMultValue = Number(stats.groupMultiplier ?? 1);
  const axisConfig = axisConfigBase.filter(a => {
    if (a.key === 'groupMultiplier') return groupMultValue > 1;
    return true;
  });

  // Color palette (adjust for dark / light) — made darker-mode colors brighter for contrast
  const ringStroke = isDark ? 'rgba(148,163,184,0.22)' : '#e6eef6';
  const axisStroke = isDark ? 'rgba(148,163,184,0.18)' : '#eef6fb';
  const labelColor = isDark ? '#e6eef6' : '#0f172a';
  const dataFill = isDark ? 'rgba(16,185,129,0.22)' : 'rgba(34,197,94,0.18)';
  const dataStroke = isDark ? 'rgba(16,185,129,1)' : 'rgba(34,197,94,0.9)';
  const tickFill = isDark ? '#34d399' : '#10b981';
  const centerDotFill = isDark ? '#94a3b8' : '#64748b';

  // Add padding so labels outside the chart don't get clipped
  const pad = 28;               // extra margin around the chart
  const svgSize = size + pad * 2;
  const cx = pad + size / 2;
  const cy = pad + size / 2;
  const radius = size * 0.42;
  const labelOffset = 18;       // move labels a bit further out
  const fontSize = 11;

  const pointsForValue = (val, max, angle) => {
    const ratio = Math.max(0, Math.min(1, (val == null ? 0 : val) / max));
    return [cx + radius * ratio * Math.cos(angle), cy + radius * ratio * Math.sin(angle)];
  };

  const axisCount = axisConfig.length;
  const angles = axisConfig.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / axisCount);

  // Rings (grid) polygon points for steps
  const rings = [0.25, 0.5, 0.75, 1].map((r) =>
    axisConfig.map((_, i) => {
      const a = angles[i];
      return `${cx + radius * r * Math.cos(a)},${cy + radius * r * Math.sin(a)}`;
    }).join(' ')
  );

  // Data polygon
  const dataPoints = axisConfig.map((a, i) => {
    const raw = a.key === 'discountShop' ? (stats[a.key] || 0) : (stats[a.key] ?? 0);
    const max = a.max;
    const [x, y] = pointsForValue(raw, max, angles[i]);
    return `${x},${y}`;
  }).join(' ');

  // Labels outside each axis
  const labels = axisConfig.map((a, i) => {
    const aAng = angles[i];
    const lx = cx + (radius + labelOffset) * Math.cos(aAng);
    const ly = cy + (radius + labelOffset) * Math.sin(aAng);
    const anchor = Math.abs(Math.cos(aAng)) < 0.2 ? 'middle' : (Math.cos(aAng) > 0 ? 'start' : 'end');
    return { x: lx, y: ly, text: a.label, anchor, angle: aAng };
  });

  return (
    <div style={{ width: svgSize, display: 'inline-block' }}>
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
        style={{ overflow: 'visible' }}
      >
        <g fontFamily="Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial">
          {/* rings */}
          {rings.map((pts, idx) => (
            <polygon
              key={idx}
              points={pts}
              fill="none"
              stroke={ringStroke}
              strokeWidth={idx === rings.length - 1 ? 1.4 : 1.0}
              strokeOpacity={isDark ? 0.85 : 1}
            />
          ))}

          {/* axis lines */}
          {angles.map((a, i) => {
            const x = cx + radius * Math.cos(a);
            const y = cy + radius * Math.sin(a);
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={axisStroke} strokeWidth={1.2} strokeOpacity={isDark ? 0.9 : 1} />;
          })}

          {/* subtle glow behind data polygon for dark mode for better visibility */}
          {isDark && (
            <polygon
              points={dataPoints}
              fill="none"
              stroke={dataStroke}
              strokeWidth={10}
              strokeOpacity={0.06}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* data polygon + fill */}
          <polygon
            points={dataPoints}
            fill={dataFill}
            stroke={dataStroke}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* center dot */}
          <circle cx={cx} cy={cy} r={3} fill={centerDotFill} />

          {/* labels */}
          {labels.map((l, i) => (
            <text
              key={i}
              x={l.x}
              y={l.y}
              textAnchor={l.anchor}
              fontSize={fontSize}
              fill={labelColor}
              dominantBaseline="middle"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {l.text}
            </text>
          ))}

          {/* small ticks + numeric values near edges */}
          {axisConfig.map((a, i) => {
            const aAng = angles[i];
            const val = a.key === 'discountShop' ? (stats[a.key] || 0) : (stats[a.key] ?? 0);
            const [vx, vy] = pointsForValue(val, a.max, aAng);
            return (
              <g key={`val-${i}`}>
                <circle cx={vx} cy={vy} r={3.5} fill={tickFill} stroke={isDark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.06)'} />
              </g>
            );
          })}
        </g>
      </svg>

      {/* tiny legend / values */}
      <div style={{ fontSize: 12, color: isDark ? '#cbd5e1' : '#475569', marginTop: 6 }}>
        {axisConfig.map((a) => {
          const v = a.key === 'discountShop' ? (stats[a.key] || 0) : (stats[a.key] ?? 0);
          return (
            <span key={a.key} style={{ marginRight: 10 }}>
              <strong style={{ color: '#10b981' }}>{String(v ?? 0)}</strong> {a.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default StatsRadar;