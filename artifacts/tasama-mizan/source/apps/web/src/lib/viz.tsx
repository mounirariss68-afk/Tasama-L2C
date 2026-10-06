/**
 * Charts.
 *
 * Hand-built SVG rather than a charting library, because the mark specifications
 * the design system asks for — 2px strokes, 4px rounded data-ends anchored to
 * the baseline, a 2px surface gap between adjacent fills, a 2px surface ring on
 * overlapping marks, recessive grid, selective direct labels — are all things a
 * library fights you on.
 *
 * Colour rules, which are not negotiable and are the reason this file exists:
 *   · Categorical hues come from --chart-1..5 in a FIXED order, never cycled.
 *     The order is blue, bronze, green, violet, terracotta; blue and violet are
 *     deliberately not adjacent because that is the one pair colour-vision
 *     deficiency cannot separate. The whole set is validated.
 *   · Sequential = one hue, light to dark. Diverging = two hues with a NEUTRAL
 *     grey midpoint, never a hue at the middle.
 *   · Status colours (success / warn / danger) are reserved for state and never
 *     reused as a sixth series.
 *   · Text always wears text tokens. A value label is never painted in its
 *     series colour — the mark beside it carries the identity.
 *   · Never two y-scales on one chart.
 */
import { useId, useState, type ReactNode } from 'react';

export const SERIES = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
] as const;

export const STATUS = {
  success: 'var(--color-success)',
  warn: 'var(--color-warn)',
  danger: 'var(--color-danger)',
} as const;

export const ragColor = (r: 'green' | 'amber' | 'red') =>
  r === 'green' ? STATUS.success : r === 'amber' ? STATUS.warn : STATUS.danger;

const GRID = 'color-mix(in oklab, var(--color-foreground) 12%, transparent)';
const AXIS = 'var(--color-muted-foreground)';
const SURFACE = 'var(--color-card)';

// ------------------------------------------------------------------ tooltip

function Tip({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  const flip = x > w * 0.62;
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-lg border border-border/70 bg-popover/95 px-2.5 py-2 text-[11px] leading-snug shadow-lg backdrop-blur-md"
      style={{
        left: flip ? undefined : x + 12,
        right: flip ? w - x + 12 : undefined,
        top: Math.max(y - 12, 0),
        minWidth: 140,
      }}
    >
      {children}
    </div>
  );
}

export function TipRow({ swatch, label, value }: { swatch?: string; label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-px">
      {swatch ? (
        <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: swatch }} />
      ) : (
        <span className="h-2 w-2 shrink-0" />
      )}
      <span className="text-muted-foreground">{label}</span>
      <span className="ms-auto font-mono tabular-nums text-foreground">{value}</span>
    </div>
  );
}

// ------------------------------------------------------------------- legend

export function Legend({
  items,
  className = '',
}: {
  items: { label: string; color: string; dashed?: boolean }[];
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${className}`}>
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className="h-[3px] w-4 rounded-full"
            style={
              i.dashed
                ? { backgroundImage: `repeating-linear-gradient(90deg, ${i.color} 0 4px, transparent 4px 7px)` }
                : { background: i.color }
            }
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// -------------------------------------------------------------- line / area

export type Line = { label: string; color: string; points: number[]; dashed?: boolean; area?: boolean };

/**
 * Cumulative line chart with a crosshair and a shared tooltip. Used for the EVM
 * curves, benefit realisation and any other "three measures, one scale" view.
 * One y-scale. Always.
 */
export function LineChart({
  series,
  labels,
  height = 200,
  format = (v: number) => String(Math.round(v)),
  yTicks = 4,
  marker,
  className = '',
}: {
  series: Line[];
  labels: string[];
  height?: number;
  format?: (v: number) => string;
  yTicks?: number;
  /** A vertical annotation — "today", a gate date, a baseline finish. */
  marker?: { at: number; label: string };
  className?: string;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000;
  const H = height;
  const pad = { t: 10, r: 14, b: 22, l: 52 };
  const n = labels.length;
  const all = series.flatMap((s) => s.points).filter((v) => Number.isFinite(v));
  const max = Math.max(...all, 1);
  const min = Math.min(...all, 0);
  const x = (i: number) => pad.l + (i / Math.max(n - 1, 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => min + ((max - min) * i) / yTicks);

  // A series that stops part-way — realised benefit against a profile that runs
  // into the future — breaks the line rather than drawing to nowhere.
  const path = (pts: number[]) => {
    let d = '';
    let pen = false;
    pts.forEach((v, i) => {
      if (!Number.isFinite(v)) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };

  /** Index of the last finite point, for closing an area fill. */
  const lastFinite = (pts: number[]) => {
    for (let i = pts.length - 1; i >= 0; i -= 1) if (Number.isFinite(pts[i])) return i;
    return -1;
  };

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        role="img"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const rel = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((rel - pad.l) / (W - pad.l - pad.r)) * (n - 1));
          setHover(Math.min(Math.max(i, 0), n - 1));
        }}
      >
        <defs>
          {series.map((s, si) =>
            s.area ? (
              <linearGradient key={si} id={`${id}-a${si}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.20" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
              </linearGradient>
            ) : null,
          )}
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text
              x={pad.l - 8}
              y={y(t) + 3.5}
              textAnchor="end"
              fill={AXIS}
              fontSize={10}
              fontFamily="var(--font-mono)"
            >
              {format(t)}
            </text>
          </g>
        ))}

        {marker ? (
          <g>
            <line
              x1={x(marker.at)}
              x2={x(marker.at)}
              y1={pad.t}
              y2={H - pad.b}
              stroke={AXIS}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.7}
            />
            <text
              x={x(marker.at) + 4}
              y={pad.t + 9}
              fill={AXIS}
              fontSize={9}
              fontFamily="var(--font-mono)"
              letterSpacing="0.06em"
            >
              {marker.label.toUpperCase()}
            </text>
          </g>
        ) : null}

        {series.map((s, si) =>
          s.area ? (
            <path
              key={`a${si}`}
              d={
                lastFinite(s.points) < 0
                  ? ''
                  : `${path(s.points)} L${x(lastFinite(s.points))},${y(min)} L${x(0)},${y(min)} Z`
              }
              fill={`url(#${id}-a${si})`}
            />
          ) : null,
        )}

        {series.map((s, si) => (
          <path
            key={`l${si}`}
            d={path(s.points)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={s.dashed ? '5 4' : undefined}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {hover !== null ? (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={pad.t}
              y2={H - pad.b}
              stroke={AXIS}
              strokeWidth={1}
              opacity={0.45}
            />
            {series.map((s, si) =>
              Number.isFinite(s.points[hover]) ? (
                // 2px surface ring keeps overlapping markers readable.
                <circle
                  key={si}
                  cx={x(hover)}
                  cy={y(s.points[hover])}
                  r={4.5}
                  fill={s.color}
                  stroke={SURFACE}
                  strokeWidth={2}
                />
              ) : null,
            )}
          </g>
        ) : null}

        {labels.map((l, i) =>
          i % Math.ceil(n / 7) === 0 || i === n - 1 ? (
            <text
              key={i}
              x={x(i)}
              y={H - 6}
              textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
              fill={AXIS}
              fontSize={10}
              fontFamily="var(--font-mono)"
            >
              {l}
            </text>
          ) : null,
        )}
      </svg>

      {hover !== null ? (
        <Tip x={(x(hover) / W) * 100 * 10} y={20} w={1000}>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {labels[hover]}
          </div>
          {series.map((s) => (
            <TipRow
              key={s.label}
              swatch={s.color}
              label={s.label}
              value={Number.isFinite(s.points[hover]) ? format(s.points[hover]) : '—'}
            />
          ))}
        </Tip>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- bar chart

export function BarChart({
  rows,
  height = 200,
  format = (v: number) => String(Math.round(v)),
  color,
  baseline,
  className = '',
}: {
  rows: { label: string; value: number; color?: string; sub?: string }[];
  height?: number;
  format?: (v: number) => string;
  color?: string;
  /** A reference line — a target, a tolerance, a portfolio mean. */
  baseline?: { at: number; label: string };
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 1000;
  const H = height;
  const pad = { t: 12, r: 12, b: 26, l: 8 };
  const max = Math.max(...rows.map((r) => r.value), baseline?.at ?? 0, 1);
  const slot = (W - pad.l - pad.r) / rows.length;
  // 2px of surface between adjacent fills — the gap is what makes them separate
  // objects rather than one striped block.
  const bw = Math.max(slot - 8, 4);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);

  return (
    <div className={`relative ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke={GRID} strokeWidth={1} />
        {baseline ? (
          <g>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(baseline.at)}
              y2={y(baseline.at)}
              stroke={AXIS}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text x={W - pad.r} y={y(baseline.at) - 5} textAnchor="end" fill={AXIS} fontSize={9} fontFamily="var(--font-mono)">
              {baseline.label}
            </text>
          </g>
        ) : null}
        {rows.map((r, i) => {
          const h = Math.max(H - pad.b - y(r.value), 1.5);
          return (
            <rect
              key={i}
              x={pad.l + i * slot + (slot - bw) / 2}
              y={y(r.value)}
              width={bw}
              height={h}
              // 4px rounded data-end, square against the baseline.
              rx={Math.min(4, bw / 2)}
              fill={r.color ?? color ?? SERIES[0]}
              opacity={hover === null || hover === i ? 1 : 0.42}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
        {rows.map((r, i) =>
          rows.length <= 14 ? (
            <text
              key={`t${i}`}
              x={pad.l + i * slot + slot / 2}
              y={H - 8}
              textAnchor="middle"
              fill={AXIS}
              fontSize={10}
              fontFamily="var(--font-mono)"
            >
              {r.label}
            </text>
          ) : null,
        )}
      </svg>
      {hover !== null ? (
        <Tip x={((pad.l + hover * slot + slot / 2) / W) * 1000} y={8} w={1000}>
          <div className="font-medium text-foreground">{rows[hover].label}</div>
          {rows[hover].sub ? <div className="text-muted-foreground">{rows[hover].sub}</div> : null}
          <div className="mt-1 font-mono tabular-nums text-foreground">{format(rows[hover].value)}</div>
        </Tip>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------- bubble chart

/**
 * The standard portfolio bubble: x = delivery confidence, y = value, size =
 * cost, colour = portfolio. Four quadrants, named the way portfolio managers
 * name them, because "high value / high risk" is a description and "oyster" is
 * a decision.
 */
export function BubbleChart({
  points,
  height = 320,
  xLabel,
  yLabel,
  quadrants,
  onSelect,
  className = '',
}: {
  points: { id: string; x: number; y: number; size: number; color: string; label: string; meta?: string }[];
  height?: number;
  xLabel: string;
  yLabel: string;
  quadrants?: [string, string, string, string];
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 1000;
  const H = height;
  const pad = { t: 16, r: 18, b: 34, l: 60 };
  const maxY = Math.max(...points.map((p) => p.y), 1);
  const maxS = Math.max(...points.map((p) => p.size), 1);
  const x = (v: number) => pad.l + ((v - 0.5) / 4.5) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / maxY) * (H - pad.t - pad.b);
  const r = (v: number) => 6 + Math.sqrt(v / maxS) * 22;
  const mx = x(3);
  const my = y(maxY / 2);
  const active = points.find((p) => p.id === hover);

  return (
    <div className={`relative ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <line x1={mx} x2={mx} y1={pad.t} y2={H - pad.b} stroke={GRID} strokeWidth={1} />
        <line x1={pad.l} x2={W - pad.r} y1={my} y2={my} stroke={GRID} strokeWidth={1} />
        {quadrants ? (
          <g fill={AXIS} fontSize={10} fontFamily="var(--font-mono)" letterSpacing="0.08em" opacity={0.75}>
            <text x={pad.l + 8} y={pad.t + 12}>{quadrants[0].toUpperCase()}</text>
            <text x={W - pad.r - 8} y={pad.t + 12} textAnchor="end">{quadrants[1].toUpperCase()}</text>
            <text x={pad.l + 8} y={H - pad.b - 8}>{quadrants[2].toUpperCase()}</text>
            <text x={W - pad.r - 8} y={H - pad.b - 8} textAnchor="end">{quadrants[3].toUpperCase()}</text>
          </g>
        ) : null}

        {points.map((p) => (
          <circle
            key={p.id}
            cx={x(p.x)}
            cy={y(p.y)}
            r={r(p.size)}
            fill={p.color}
            fillOpacity={hover === null || hover === p.id ? 0.55 : 0.2}
            stroke={p.color}
            strokeWidth={hover === p.id ? 2.5 : 1.5}
            className={onSelect ? 'cursor-pointer' : ''}
            onMouseEnter={() => setHover(p.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect?.(p.id)}
          />
        ))}

        <text x={W / 2} y={H - 8} textAnchor="middle" fill={AXIS} fontSize={10} fontFamily="var(--font-mono)">
          {xLabel}
        </text>
        <text
          x={-H / 2}
          y={14}
          transform="rotate(-90)"
          textAnchor="middle"
          fill={AXIS}
          fontSize={10}
          fontFamily="var(--font-mono)"
        >
          {yLabel}
        </text>
      </svg>
      {active ? (
        <Tip x={x(active.x)} y={y(active.y) - 30} w={W}>
          <div className="font-medium text-foreground">{active.label}</div>
          {active.meta ? <div className="mt-0.5 text-muted-foreground">{active.meta}</div> : null}
        </Tip>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ heatmap

/**
 * Sequential heat grid — ONE hue, light to dark. Used for capacity-vs-demand and
 * for the residual risk matrix. Each cell carries its number as well as its
 * shade, so the colour is reinforcement rather than the only encoding.
 */
export function HeatGrid({
  rows,
  columns,
  cell,
  scale = 'sequential',
  className = '',
}: {
  rows: { key: string; label: string; sub?: string }[];
  columns: { key: string; label: string }[];
  cell: (rowKey: string, colKey: string) => { value: number; display: string; tip?: string } | null;
  /** 'sequential' = one hue. 'diverging' = two hues around a NEUTRAL midpoint at 1.0. */
  scale?: 'sequential' | 'diverging';
  className?: string;
}) {
  const [hover, setHover] = useState<{ r: string; c: string } | null>(null);

  const fill = (v: number) => {
    if (scale === 'diverging') {
      // Neutral grey at the midpoint, never a hue. Under-use cools, over-use warms.
      if (v > 1) {
        const t = Math.min((v - 1) / 0.45, 1);
        return `color-mix(in oklab, var(--color-danger) ${18 + t * 62}%, var(--color-muted))`;
      }
      const t = Math.min((1 - v) / 0.55, 1);
      return `color-mix(in oklab, var(--color-chart-1) ${6 + t * 34}%, var(--color-muted))`;
    }
    return `color-mix(in oklab, var(--color-chart-1) ${8 + Math.min(v, 1) * 72}%, transparent)`;
  };

  return (
    <div className={`relative overflow-x-auto ${className}`}>
      <table className="w-full border-separate" style={{ borderSpacing: '2px' }}>
        <thead>
          <tr>
            <th className="w-48 text-start" />
            {columns.map((c) => (
              <th
                key={c.key}
                className="px-1 pb-1 font-mono text-[10px] font-normal uppercase tracking-wider text-muted-foreground"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="pe-3 align-middle">
                <div className="truncate text-xs text-foreground">{r.label}</div>
                {r.sub ? <div className="truncate text-[10px] text-muted-foreground">{r.sub}</div> : null}
              </td>
              {columns.map((c) => {
                const d = cell(r.key, c.key);
                const on = hover?.r === r.key && hover?.c === c.key;
                return (
                  <td key={c.key} className="p-0">
                    <div
                      className="relative flex h-8 items-center justify-center rounded-[5px] font-mono text-[11px] tabular-nums transition-colors"
                      style={{
                        background: d ? fill(d.value) : 'transparent',
                        outline: on ? '2px solid var(--color-ring)' : undefined,
                        outlineOffset: -1,
                      }}
                      onMouseEnter={() => setHover({ r: r.key, c: c.key })}
                      onMouseLeave={() => setHover(null)}
                    >
                      <span className="text-foreground">{d?.display ?? ''}</span>
                      {on && d?.tip ? (
                        <div className="pointer-events-none absolute bottom-full start-1/2 z-20 mb-1 w-max max-w-64 -translate-x-1/2 rounded-lg border border-border/70 bg-popover/95 px-2.5 py-1.5 text-[11px] leading-snug text-foreground shadow-lg backdrop-blur-md">
                          {d.tip}
                        </div>
                      ) : null}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ gantt

export function Timeline({
  rows,
  from,
  to,
  today,
  height = 26,
  onSelect,
  axis = false,
  className = '',
}: {
  rows: {
    id: string;
    label: string;
    sub?: string;
    start: number;
    end: number;
    /** Baseline end, when it differs from the forecast — drawn as a ghost. */
    baselineEnd?: number;
    color: string;
    progress?: number;
    markers?: { at: number; label: string; done: boolean; critical: boolean }[];
    depth?: number;
    /** Rows this row cannot start until. Drawn as finish-to-start connectors. */
    dependsOn?: string[];
  }[];
  from: number;
  to: number;
  today: number;
  height?: number;
  onSelect?: (id: string) => void;
  /** Draw the quarter scale and gridlines. Off for a one-row inline timeline. */
  axis?: boolean;
  className?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const span = Math.max(to - from, 1);
  const pos = (v: number) => ((v - from) / span) * 100;

  /**
   * The quarter scale. A Gantt without a time axis is a picture of some bars:
   * the reader cannot answer "when" without one, which is the only question
   * the chart exists to answer. Quarters rather than months because a
   * three-year portfolio horizon at month grain is unreadable, and a PMO
   * reports to quarters anyway.
   */
  const quarters = (() => {
    const out: { at: number; label: string; yearStart: boolean }[] = [];
    const d = new Date(from);
    d.setDate(1);
    d.setMonth(Math.floor(d.getMonth() / 3) * 3);
    while (d.getTime() <= to) {
      const q = Math.floor(d.getMonth() / 3) + 1;
      out.push({ at: d.getTime(), label: `Q${q}`, yearStart: q === 1 });
      d.setMonth(d.getMonth() + 3);
    }
    return out;
  })();
  const years = (() => {
    const out: { at: number; label: string }[] = [];
    const d = new Date(from);
    d.setMonth(0, 1);
    while (d.getTime() <= to) {
      if (d.getTime() >= from) out.push({ at: d.getTime(), label: String(d.getFullYear()) });
      d.setFullYear(d.getFullYear() + 1);
    }
    return out;
  })();

  /** Row order, so a connector knows how many rows to travel vertically. */
  const index = new Map(rows.map((r, i) => [r.id, i]));
  const ROW = height + 3; // row height plus the 3px gap between rows

  return (
    <div className={`relative ${className}`}>
      {axis ? (
        <div className="mb-1.5 flex items-end gap-3">
          <div className="w-52 shrink-0" />
          <div className="relative h-8 flex-1">
            {years.map((y) => (
              <span
                key={`y${y.at}`}
                className="absolute top-0 font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground"
                style={{ left: `${pos(y.at)}%` }}
              >
                {y.label}
              </span>
            ))}
            {quarters.map((q) => (
              <span
                key={`q${q.at}`}
                className="absolute bottom-0 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground"
                style={{ left: `calc(${pos(q.at)}% + 2px)` }}
              >
                {q.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Gridlines sit under the bars: a quarter boundary you can read a date off. */}
      {axis ? (
        <div className="pointer-events-none absolute bottom-0 end-0 top-8 start-52 ms-3">
          {quarters.map((q) => (
            <div
              key={`g${q.at}`}
              className={`absolute bottom-0 top-0 w-px ${q.yearStart ? 'bg-border' : 'bg-border/45'}`}
              style={{ left: `${pos(q.at)}%` }}
            />
          ))}
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute bottom-0 z-10 w-px bg-accent/70"
        style={{ top: axis ? '2rem' : 0, left: `calc(13rem + ${pos(today)}% * (100% - 13rem) / 100%)` }}
      />
      {axis ? (
        <span
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-full bg-accent px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent-foreground"
          style={{ top: '-0.1rem', left: `calc(13rem + ${pos(today)}% * (100% - 13rem) / 100%)` }}
        >
          today
        </span>
      ) : null}

      <div className="relative space-y-[3px]">
        {rows.map((r) => (
          <div
            key={r.id}
            className={`group flex items-center gap-3 ${onSelect ? 'cursor-pointer' : ''}`}
            onMouseEnter={() => setHover(r.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect?.(r.id)}
          >
            <div className="w-52 shrink-0" style={{ paddingLeft: (r.depth ?? 0) * 12 }}>
              <div className="truncate text-xs text-foreground">{r.label}</div>
              {r.sub ? <div className="truncate text-[10px] text-muted-foreground">{r.sub}</div> : null}
            </div>
            <div className="relative flex-1" style={{ height }}>
              {/* Finish-to-start connectors. An elbow: down from the
                  predecessor's finish, then across to this bar's start. Drawn
                  faint until either end is hovered, because a portfolio with
                  ten links and every one at full strength is a cobweb. */}
              {(r.dependsOn ?? []).map((pid) => {
                const from_ = rows.find((x) => x.id === pid);
                if (!from_) return null;
                const dy = ((index.get(r.id) ?? 0) - (index.get(pid) ?? 0)) * ROW;
                if (dy <= 0) return null;
                const late = from_.end > r.start;
                const stroke = late ? 'var(--color-danger)' : 'var(--color-muted-foreground)';
                const x0 = pos(from_.end);
                const x1 = pos(r.start);
                const lit = hover === r.id || hover === pid;
                const style = {
                  background: stroke,
                  opacity: lit ? 0.95 : 0.3,
                } as const;
                return (
                  <span key={pid} aria-hidden="true" title={`${from_.label} → ${r.label}`}>
                    <span
                      className="pointer-events-none absolute w-px"
                      style={{ ...style, left: `${x0}%`, top: -dy + height / 2, height: dy }}
                    />
                    <span
                      className="pointer-events-none absolute h-px"
                      style={{
                        ...style,
                        left: `${Math.min(x0, x1)}%`,
                        width: `${Math.max(Math.abs(x1 - x0), 0.15)}%`,
                        top: height / 2,
                      }}
                    />
                    <span
                      className="pointer-events-none absolute h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rotate-45"
                      style={{ ...style, left: `${x1}%`, top: height / 2 }}
                    />
                  </span>
                );
              })}
              {r.baselineEnd !== undefined && r.baselineEnd < r.end ? (
                <div
                  className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
                  style={{
                    left: `${pos(r.baselineEnd)}%`,
                    width: `${pos(r.end) - pos(r.baselineEnd)}%`,
                    background: 'repeating-linear-gradient(90deg, var(--color-danger) 0 3px, transparent 3px 6px)',
                  }}
                  title="Slip against baseline"
                />
              ) : null}
              <div
                className="absolute top-1/2 h-[14px] -translate-y-1/2 overflow-hidden rounded-[4px] transition-opacity"
                style={{
                  left: `${pos(r.start)}%`,
                  width: `${Math.max(pos(r.end) - pos(r.start), 0.6)}%`,
                  background: `color-mix(in oklab, ${r.color} 26%, transparent)`,
                  boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${r.color} 55%, transparent)`,
                  opacity: hover === null || hover === r.id ? 1 : 0.5,
                }}
              >
                {r.progress !== undefined ? (
                  <div
                    className="h-full rounded-[3px]"
                    style={{ width: `${Math.min(r.progress, 100)}%`, background: r.color }}
                  />
                ) : null}
              </div>
              {(r.markers ?? []).map((m, i) => (
                <div
                  key={i}
                  className="absolute top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1.5px]"
                  style={{
                    left: `${pos(m.at)}%`,
                    background: m.done ? 'var(--color-foreground)' : m.critical ? 'var(--color-warn)' : 'var(--color-card)',
                    boxShadow: `0 0 0 1.5px ${m.critical ? 'var(--color-warn)' : 'var(--color-foreground)'}`,
                  }}
                  title={`${m.label}${m.done ? ' — achieved' : ''}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- small pieces

export function Sparkline({
  points,
  color = SERIES[0],
  width = 84,
  height = 24,
}: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const d = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - 2 - ((v - min) / (max - min || 1)) * (height - 4);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const lastY = height - 2 - ((points[points.length - 1] - min) / (max - min || 1)) * (height - 4);
  return (
    <svg width={width} height={height} className="shrink-0 overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={lastY} r={2.5} fill={color} stroke={SURFACE} strokeWidth={1.5} />
    </svg>
  );
}

/** A proportion bar. Used for gate readiness, benefit attainment, utilisation. */
export function Meter({
  value,
  target,
  tone = 'primary',
  height = 6,
  className = '',
}: {
  value: number;
  target?: number;
  tone?: 'primary' | 'success' | 'warn' | 'danger' | 'accent' | 'highlight';
  height?: number;
  className?: string;
}) {
  const color =
    tone === 'primary'
      ? 'var(--color-primary)'
      : tone === 'accent'
        ? 'var(--color-accent)'
        : tone === 'highlight'
          ? 'var(--color-highlight)'
          : STATUS[tone as keyof typeof STATUS];
  return (
    <div
      className={`relative w-full overflow-hidden rounded-full bg-muted ${className}`}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%`, background: color }}
      />
      {target !== undefined ? (
        <div
          className="absolute top-0 h-full w-px bg-foreground/60"
          style={{ left: `${Math.min(target, 1) * 100}%` }}
        />
      ) : null}
    </div>
  );
}

/** Proportional segments — a portfolio split, a RAG distribution, a gate mix. */
export function StackBar({
  segments,
  height = 10,
  className = '',
}: {
  segments: { label: string; value: number; color: string }[];
  height?: number;
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className={`flex w-full gap-[2px] ${className}`} style={{ height }}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <div
            key={s.label}
            className="h-full rounded-[3px] first:rounded-l-full last:rounded-r-full"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label} — ${s.value}`}
          />
        ))}
    </div>
  );
}

/** A dial for a single index — CPI, SPI, attainment. Reads at a glance, exact on hover. */
export function Dial({
  value,
  min = 0.7,
  max = 1.3,
  pivot = 1,
  label,
  display,
  size = 92,
}: {
  value: number;
  min?: number;
  max?: number;
  pivot?: number;
  label: string;
  display: string;
  size?: number;
}) {
  const r = size / 2 - 8;
  const c = size / 2;
  const a = (v: number) => (-220 + ((Math.min(Math.max(v, min), max) - min) / (max - min)) * 260) * (Math.PI / 180);
  const pt = (v: number, rr = r) => `${c + rr * Math.cos(a(v))},${c + rr * Math.sin(a(v))}`;
  const arc = (from: number, to: number, rr = r) =>
    `M${pt(from, rr)} A${rr},${rr} 0 ${Math.abs(a(to) - a(from)) > Math.PI ? 1 : 0},1 ${pt(to, rr)}`;
  const tone = value >= pivot ? STATUS.success : value >= pivot - 0.1 ? STATUS.warn : STATUS.danger;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.78} viewBox={`0 0 ${size} ${size * 0.82}`}>
        <path d={arc(min, max)} fill="none" stroke={GRID} strokeWidth={6} strokeLinecap="round" />
        <path d={arc(min, value)} fill="none" stroke={tone} strokeWidth={6} strokeLinecap="round" />
        <line
          x1={c + (r - 9) * Math.cos(a(pivot))}
          y1={c + (r - 9) * Math.sin(a(pivot))}
          x2={c + (r + 5) * Math.cos(a(pivot))}
          y2={c + (r + 5) * Math.sin(a(pivot))}
          stroke={AXIS}
          strokeWidth={1.5}
        />
        <text
          x={c}
          y={c + 4}
          textAnchor="middle"
          fill="var(--color-foreground)"
          fontSize={19}
          fontFamily="var(--font-mono)"
          fontWeight={600}
        >
          {display}
        </text>
      </svg>
      <div className="-mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

/** The 5×5 residual risk matrix. Sequential fill, count in the cell. */
export function RiskMatrix({
  counts,
  onSelect,
  selected,
}: {
  counts: (p: number, i: number) => number;
  onSelect?: (p: number, i: number) => void;
  selected?: { p: number; i: number } | null;
}) {
  const max = Math.max(
    ...[1, 2, 3, 4, 5].flatMap((p) => [1, 2, 3, 4, 5].map((i) => counts(p, i))),
    1,
  );
  return (
    <div className="flex gap-2">
      <div
        className="flex w-4 items-center justify-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        Probability
      </div>
      <div className="flex-1">
        <div className="grid grid-cols-5 gap-[3px]">
          {[5, 4, 3, 2, 1].map((p) =>
            [1, 2, 3, 4, 5].map((i) => {
              const n = counts(p, i);
              const score = p * i;
              const on = selected?.p === p && selected?.i === i;
              return (
                <button
                  key={`${p}-${i}`}
                  type="button"
                  onClick={() => onSelect?.(p, i)}
                  className="relative flex aspect-[1.5] items-center justify-center rounded-[5px] font-mono text-xs tabular-nums transition-all"
                  style={{
                    background:
                      score >= 15
                        ? `color-mix(in oklab, var(--color-danger) ${22 + (n / max) * 58}%, var(--color-muted))`
                        : score >= 8
                          ? `color-mix(in oklab, var(--color-warn) ${18 + (n / max) * 52}%, var(--color-muted))`
                          : `color-mix(in oklab, var(--color-success) ${12 + (n / max) * 40}%, var(--color-muted))`,
                    outline: on ? '2px solid var(--color-ring)' : undefined,
                    outlineOffset: -1,
                    opacity: n === 0 ? 0.35 : 1,
                  }}
                  title={`Probability ${p} × impact ${i} — score ${score} — ${n} open`}
                >
                  <span className="text-foreground">{n || ''}</span>
                </button>
              );
            }),
          )}
        </div>
        <div className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Impact →
        </div>
      </div>
    </div>
  );
}
