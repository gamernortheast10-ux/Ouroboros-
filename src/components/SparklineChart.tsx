import React, { useId } from 'react';

interface SparklineProps {
  values: number[];
  positive: boolean;
  height?: number;
  detailed?: boolean;
}

export const SparklineChart: React.FC<SparklineProps> = ({
  values,
  positive,
  height = 88,
  detailed = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const safeValues = values.length >= 2 ? values : [100, 100];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = max - min || 1;
  const width = 360;
  const padY = 8;

  const points = safeValues.map((val, idx) => {
    const x = (idx / (safeValues.length - 1)) * width;
    const y = height - padY - ((val - min) / range) * (height - padY * 2);
    return { x, y };
  });

  const linePath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  const strokeColor = positive ? '#10b981' : '#ef4444';
  const gradId = `${positive ? 'gradUp' : 'gradDown'}-${uid}`;
  const lastPt = points[points.length - 1];

  return (
    <div className="w-full overflow-hidden rounded-xl bg-[#0c0c15] border border-white/[0.06]">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Price trend chart"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {detailed && (
          <g stroke="rgba(255,255,255,0.05)" strokeWidth="1">
            <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} />
            <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} />
            <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} />
          </g>
        )}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastPt.x} cy={lastPt.y} r="3.5" fill={strokeColor} />
      </svg>
    </div>
  );
};

export const MiniCandleBars: React.FC<{ values: number[] }> = ({ values }) => {
  const recent = values.slice(-6);
  const min = Math.min(...recent);
  const max = Math.max(...recent);
  const range = max - min || 1;

  return (
    <div className="flex items-end gap-1 h-7" aria-hidden="true">
      {recent.map((val, idx) => {
        const prev = idx > 0 ? recent[idx - 1] : val;
        const isUp = val >= prev;
        const pct = Math.max(25, Math.round(((val - min) / range) * 100));
        return (
          <span
            key={idx}
            className={`w-1 rounded-sm ${isUp ? 'bg-emerald-500' : 'bg-rose-500'}`}
            style={{ height: `${pct}%` }}
          />
        );
      })}
    </div>
  );
};
