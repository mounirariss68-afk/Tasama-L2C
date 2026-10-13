/**
 * The product's small vocabulary — chips, rows, tabs, tables — so a status
 * looks the same on the Inbox as it does on the Close screen.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { PageContainer } from '@cognirise/atelier/layout';
import { AgentAvatar, AgentAutonomyChip, DecisionTrail, TrailEntry as TrailRow } from '@cognirise/atelier/archetypes';
import { useApp } from './state';
import { AGENTS, agentById, avatarFor } from '@mizan/domain/agents';
import { DEPARTMENTS, PERSONAS } from '@mizan/domain/personas';
import { describeCall, parseCallText, type ErpCall } from '@mizan/domain/erp';
import type { ErpSystem } from '@mizan/domain/types';
import { dateTime, money } from '@mizan/domain/format';
import type { EventStatus } from '@mizan/domain/derive';
import { EVENT_STATUS_LABEL } from '@mizan/domain/derive';
import type { TrailEntry } from '@mizan/domain/types';

export type Tone = 'default' | 'primary' | 'accent' | 'highlight' | 'success' | 'warn' | 'danger' | 'muted';
const TONE: Record<Tone, string> = {
  default: 'border-border/70 bg-card/50 text-muted-foreground',
  primary: 'border-primary/40 bg-primary/12 text-primary',
  accent: 'border-accent/45 bg-accent/12 text-accent',
  highlight: 'border-highlight/45 bg-highlight-wash/25 text-highlight',
  success: 'border-success/40 bg-success/12 text-success',
  warn: 'border-warn/40 bg-warn/12 text-warn',
  danger: 'border-danger/40 bg-danger/12 text-danger',
  muted: 'border-transparent bg-muted text-muted-foreground',
};

export function Chip({ children, tone = 'default', title, className = '' }: { children: ReactNode; tone?: Tone; title?: string; className?: string }) {
  return <span title={title} className={`chip inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${TONE[tone]} ${className}`}>{children}</span>;
}

export const STATUS_TONE: Record<EventStatus, Tone> = {
  scheduled: 'muted', due: 'primary', missed: 'danger', blocked_coc: 'warn', blocked_evidence: 'warn', blocked_no_po: 'danger',
  drafted: 'accent', released: 'primary', cleared: 'success', rejected: 'danger', paid: 'success',
};
export function EventStatusChip({ status }: { status: EventStatus }) { return <Chip tone={STATUS_TONE[status]}>{EVENT_STATUS_LABEL[status]}</Chip>; }

export function Money({ v, currency = 'SAR', compact = false, className = '' }: { v: number; currency?: string; compact?: boolean; className?: string }) {
  return <span className={`whitespace-nowrap font-mono tabular-nums ${className}`}>{money(v, currency, { compact })}</span>;
}

export function Delta({ v, currency = 'SAR' }: { v: number; currency?: string }) {
  const tone = Math.abs(v) < 0.5 ? 'text-muted-foreground' : v > 0 ? 'text-success' : 'text-danger';
  return <span className={`font-mono tabular-nums ${tone}`}>{v > 0 ? '+' : v < 0 ? '−' : ''}{money(Math.abs(v), currency, { compact: true }).replace(`${currency} `, '')}</span>;
}

export function AgentMark({ id, size = 22, showName = true }: { id: string; size?: number; showName?: boolean }) {
  const a = agentById(id);
  return (
    <span className="inline-flex items-center gap-1.5">
      <AgentAvatar agent={{ id: a.id, name: a.name, role: a.role, avatar: avatarFor(a), autonomy: a.autonomy }} size={size} showActivity={false} />
      {showName ? <span className="text-xs text-foreground">{a.name}</span> : null}
    </span>
  );
}

/** The body of a screen: one measure, one vertical rhythm. Mastheads and heroes sit above it, full-bleed. */
export function Body({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <PageContainer width="wide" className={`space-y-8 py-6 ${className}`}>{children}</PageContainer>;
}

/** A person (persona) or, for the close inputs, a department that is not a Mizan user. */
export function PersonMark({ id }: { id: string }) {
  const p = PERSONAS.find((x) => x.id === id);
  const d = DEPARTMENTS[id];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full border font-mono text-[9px] ${d ? 'border-dashed border-border/70 text-muted-foreground' : 'border-border/70 bg-card/60 text-foreground'}`}>{p?.initials ?? d?.initials ?? '??'}</span>
      <span className="text-xs text-foreground">{p?.name ?? d?.name ?? id}</span>
    </span>
  );
}

export function Trail({ entries, limit }: { entries: TrailEntry[]; limit?: number }) {
  const rows = [...entries].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit ?? entries.length);
  if (!rows.length) return <p className="text-xs text-muted-foreground">No activity recorded yet.</p>;
  return (
    <DecisionTrail>
      {rows.map((e) => (
        <TrailRow key={e.id} kind={e.kind} at={dateTime(e.at)} summary={e.summary} detail={e.detail ? <TrailDetail text={e.detail} /> : undefined}
          actor={e.actor.kind === 'agent' ? <AgentMark id={e.actor.id} /> : <PersonMark id={e.actor.id} />}
          autonomy={e.autonomy ? <AgentAutonomyChip level={e.autonomy} /> : undefined}
          override={e.override} />
      ))}
    </DecisionTrail>
  );
}

/**
 * What the connector posts, as finance reads it: the system, the object, the
 * fields that matter and the lines summarised. The literal API call stays one
 * click away for whoever wants it; it is never the default view.
 */
export function PostingPreview({ call, erp, compact = false }: { call: ErpCall; erp?: ErpSystem; compact?: boolean }) {
  const [raw, setRaw] = useState(false);
  const d = describeCall(call, erp);
  return (
    <div className={compact ? '' : 'rounded-md border border-border/50 bg-card/40 p-2.5'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs"><span className="font-medium">{d.object}</span><span className="text-muted-foreground"> → {d.system}</span></span>
        <button type="button" onClick={() => setRaw((o) => !o)} className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">{raw ? 'hide' : 'show'} the API call</button>
      </div>
      <dl className={`mt-1.5 grid gap-x-6 gap-y-0.5 text-[11.5px] ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {d.fields.map(([k, v]) => <div key={k} className="flex min-w-0 items-baseline justify-between gap-2"><dt className="shrink-0 text-muted-foreground">{k}</dt><dd className="truncate text-end font-mono tabular-nums" title={v}>{v}</dd></div>)}
      </dl>
      {call.note ? <p className="mt-1.5 text-[11px] text-muted-foreground">{call.note}</p> : null}
      {raw ? <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded border border-border/40 bg-background/60 p-2 font-mono text-[10.5px] leading-snug text-muted-foreground">{d.technical}</pre> : null}
    </div>
  );
}

/** A trail entry's detail: a sentence shows inline; an ERP call shows as a posting summary, the literal call folded. */
function TrailDetail({ text }: { text: string }) {
  const call = parseCallText(text);
  if (!call) return <p className="text-xs leading-snug text-muted-foreground">{text}</p>;
  return <PostingPreview call={call} compact />;
}

export type Tab = { id: string; label: string; hint?: string; body: () => ReactNode };
export function Tabs({ tabs, storageKey }: { tabs: Tab[]; storageKey: string }) {
  const { tab: requested } = useApp();
  const first = tabs[0]?.id;
  const [active, setActive] = useState<string>(() => { try { const s = localStorage.getItem(`mizan-tab-${storageKey}`); return s && tabs.some((t) => t.id === s) ? s : first; } catch { return first; } });
  useEffect(() => { if (requested && tabs.some((t) => t.id === requested)) setActive(requested); }, [requested, tabs]);
  useEffect(() => { try { localStorage.setItem(`mizan-tab-${storageKey}`, active); } catch { /* */ } }, [active, storageKey]);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <>
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setActive(t.id)} title={t.hint}
              className={`rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${t.id === current?.id ? 'border-primary/50 bg-primary/12 text-primary' : 'border-border/60 bg-card/40 text-muted-foreground hover:bg-card/70 hover:text-foreground'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {current?.body()}
    </>
  );
}

/** A dense table. Wide tables belong in a full-width PageSection, never inside the 2:1 column split. */
const NUMERIC = /amount|value|gross|net|budget|target|forecast|actual|var |days|qty|consumed|uncovered|revenue|cost|margin|open ar|^%$|expected|unit|tax|confidence|ai cost|explained|unexplained|^dr$|^cr$|^#$|pos$|findings|statement$/i;
export function Table({ head, rows, className = '' }: { head: ReactNode[]; rows: ReactNode[][]; className?: string }) {
  const end = head.map((h, i) => i > 0 && typeof h === 'string' && NUMERIC.test(h));
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-border/60 text-start font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {head.map((h, i) => <th key={i} className={`px-2 py-1.5 font-normal ${end[i] ? 'text-end' : 'text-start'}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-card/40">
              {r.map((c, j) => <td key={j} className={`px-2 py-1.5 align-top ${end[j] ? 'text-end' : 'text-start'}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Btn({ children, onClick, tone = 'default', disabled, small }: { children: ReactNode; onClick?: () => void; tone?: 'default' | 'primary' | 'danger' | 'ghost'; disabled?: boolean; small?: boolean }) {
  const cls = tone === 'primary' ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90' : tone === 'danger' ? 'border-danger/50 bg-danger/10 text-danger hover:bg-danger/20' : tone === 'ghost' ? 'border-transparent text-muted-foreground hover:bg-card/70' : 'border-border/70 bg-card/50 text-foreground hover:bg-card/80';
  return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg border ${small ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}>{children}</button>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">{children}</div>;
}

export function KV({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="space-y-1.5 text-[12px]">
      {rows.map(([k, v], i) => (<div key={i} className="flex items-baseline justify-between gap-3"><dt className="shrink-0 text-muted-foreground">{k}</dt><dd className="text-end text-foreground">{v}</dd></div>))}
    </dl>
  );
}

export { AGENTS };
