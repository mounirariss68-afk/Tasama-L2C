/**
 * Overview — "Can we close, and where is the money?"
 */
import { AlertTriangle, ArrowRight, Banknote, CalendarClock, Coins, FileWarning, Gauge, Route, TrendingUp } from 'lucide-react';
import { FeedCard, HeroFeature, PageColumns, PageContainer, PageHero, PageSection, Panel, PanelAction, StatRow, StatTile } from '@cognirise/atelier/layout';
import { ProvenanceNote } from '@cognirise/atelier/archetypes';
import { useApp } from '../app/state';
import { Body, Chip, Delta, Money } from '../app/bits';
import { arOpen, budgetByMonth, closeSummary, deferredBalance, dso, dsoBySegment, fyTotals, inboxItems, marginByClient, overdue, unbilled, waterfall, cashStats, GM_TARGET, nonPifShare } from '@mizan/domain/derive';
import { money, monthName, pct, period } from '@mizan/domain/format';
import { STAGES, stageMetrics } from '@mizan/domain/process';
import { BarChart, Legend, LineChart, SERIES } from '../lib/viz';

export function OverviewScreen() {
  const { world, go, persona } = useApp();
  const close = closeSummary(world);
  const wf = waterfall(world);
  const unb = unbilled(world);
  const ar = arOpen(world);
  const od = overdue(world);
  const odAmt = od.reduce((s, x) => s + (x.invoice.currency === 'USD' ? x.invoice.gross * 3.75 : x.invoice.gross), 0);
  const fy = fyTotals(world);
  const bm = budgetByMonth(world);
  const cash = cashStats(world);
  const margins = marginByClient(world).rows;
  const totalRev = margins.reduce((s, m) => s + m.revenue, 0);
  const totalMargin = margins.reduce((s, m) => s + m.margin, 0);
  const gm = totalRev ? totalMargin / totalRev : 0;
  const inbox = inboxItems(world).filter((i) => i.roles.includes(persona.id) || persona.id === 'noura');
  const blockedCoc = world.events.filter((e) => e.period === world.closingPeriod || e.id.includes('/D2')).filter((e) => e.coc !== 'signed' && e.coc !== 'not_required' && !e.invoiceId);
  const headline = world.flags.periodClosed
    ? `${period(world.closingPeriod)} is closed.`
    : `${money(unb, 'SAR', { compact: true })} of delivered work is unbilled; ${blockedCoc.length} invoice${blockedCoc.length === 1 ? ' is' : 's are'} blocked on a client certificate of completion. ${close.blocked} of Tasama's 24 closing procedures ${close.blocked === 1 ? 'is' : 'are'} blocked.`;

  const steps = [
    { label: 'Contracted', value: wf.contracted, sub: 'Billing schedule for the month' },
    { label: 'Evidenced', value: wf.evidenced, sub: 'Delivery evidence complete' },
    { label: 'Invoiced', value: wf.invoiced, sub: 'Drafted, released or posted' },
    { label: 'Cleared', value: wf.cleared, sub: 'Accepted by ZATCA' },
    { label: 'Collected', value: wf.collected, sub: 'Cash applied' },
  ];
  const labels = bm.map((m) => monthName(m.month));
  const feed = inbox.slice(0, 5);

  return (
    <>
      <PageHero
        eyebrow={`Revenue operations · as of ${world.asOf} · close day ${world.closeDay} of 10`}
        title={<>{period(world.closingPeriod)} close</>}
        lede={headline}
        feature={<HeroFeature label="Unbilled revenue" value={money(unb, 'SAR', { compact: true })} support={`${world.events.filter((e) => ['due', 'missed', 'blocked_coc'].includes(eventStatusSafe(world, e))).length} billing events delivered and not invoiced`} />}
        actions={
          <>
            <button type="button" onClick={() => go('close')} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/30 hover:bg-white/25">Open the close <ArrowRight size={14} /></button>
            <button type="button" onClick={() => go('inbox')} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/85 hover:bg-white/10">{inbox.length} waiting on {persona.name.split(' ')[0]}</button>
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Chip tone="highlight">{close.items.filter((i) => i.number <= 24 && i.status === 'done').length} of {close.tasama} procedures done</Chip>
          <Chip tone={close.blocked ? 'danger' : 'muted'}>{close.blocked} blocked</Chip>
          <Chip tone={close.inputsDone ? 'success' : 'warn'}>inputs 1–5 {close.inputsDone ? 'in' : 'open'}</Chip>
          <Chip tone="muted">hard close Day 10 · target Day 5</Chip>
        </div>
      </PageHero>
      <Body>


      <PageSection label="The month, in five numbers">
        <StatRow>
          <StatTile label="Overdue receivables" value={money(odAmt, 'SAR', { compact: true })} state={`${od.length} invoices`} trend={{ direction: 'up', label: `oldest ${Math.max(0, ...od.map((x) => x.days))} days`, sentiment: 'bad' }} />
          <StatTile label="DSO" value={`${dso(world)} days`} state="90-day countback" trend={{ direction: 'flat', label: Object.entries(dsoBySegment(world)).map(([k, v]) => `${k} ${v.dso === null ? 'n/a' : v.dso}`).join(' · '), sentiment: 'neutral' }} />
          <StatTile label="Cash applied" value={money(cash.appliedAmount, 'SAR', { compact: true })} state={`${cash.applied} receipts`} trend={{ direction: cash.proposed.length ? 'down' : 'flat', label: `${cash.proposed.length} proposed · ${cash.unapplied.length} unapplied · ${pct(cash.autoRate)} auto`, sentiment: cash.proposed.length ? 'neutral' : 'good' }} />
          <StatTile label="FY forecast" value={money(fy.forecast, 'SAR', { compact: true })} state={`vs budget ${money(fy.budget, 'SAR', { compact: true })}`} trend={{ direction: fy.forecast >= fy.budget ? 'up' : 'down', label: `YTD ${money(fy.actualYtd, 'SAR', { compact: true })} vs ${money(fy.budgetYtd, 'SAR', { compact: true })} · GM ${pct(gm)} vs ${pct(GM_TARGET)} · non-PIF ${pct(nonPifShare(world))}`, sentiment: fy.forecast >= fy.budget ? 'good' : 'bad' }} />
        </StatRow>
      </PageSection>

      <PageColumns
        aside={
          <Panel icon={<AlertTriangle size={16} />} title="Needs attention" action={<PanelAction onClick={() => go('inbox')}>Open inbox</PanelAction>}>
            <div className="space-y-2">
              {feed.length === 0 ? <p className="text-xs text-muted-foreground">Nothing is waiting on you.</p> : feed.map((i) => (
                <FeedCard key={i.id} tags={<><Chip tone={i.attention ? 'warn' : 'muted'}>{i.type.replace(/_/g, ' ')}</Chip>{i.clientId ? <Chip>{world.clients.find((c) => c.id === i.clientId)?.short}</Chip> : null}</>}
                  timestamp={i.amount ? money(i.amount, i.currency ?? 'SAR', { compact: true }) : undefined} headline={i.title} consequence={i.decision} onOpen={() => go('inbox', i.id)} />
              ))}
            </div>
          </Panel>
        }
      >
        <Panel icon={<Gauge size={16} />} title={`Lead to cash — ${period(world.closingPeriod)}`} action={<PanelAction onClick={() => go('l2c', undefined, 'billing')}>Billing</PanelAction>}>
          <BarChart rows={steps.map((s, i) => ({ label: s.label, value: s.value, sub: s.sub, color: i < 2 ? SERIES[0] : i < 4 ? SERIES[3] : SERIES[2] }))} height={180} format={(v) => money(v, 'SAR', { compact: true })} />
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px] sm:grid-cols-4">
            <div><span className="text-muted-foreground">Evidenced → invoiced</span><div><Delta v={wf.invoiced - wf.evidenced} /></div></div>
            <div><span className="text-muted-foreground">Invoiced → cleared</span><div><Delta v={wf.cleared - wf.invoiced} /></div></div>
            <div><span className="text-muted-foreground">Cleared → collected</span><div><Delta v={wf.collected - wf.cleared} /></div></div>
            <div><span className="text-muted-foreground">Deferred balance</span><div><Money v={deferredBalance(world)} compact /></div></div>
          </div>
          <ProvenanceNote>The drop between each step is named on the Billing tab: blocked on CoC, no PO cover, missed, rejected by ZATCA, not yet due for payment.</ProvenanceNote>
        </Panel>

        <Panel icon={<TrendingUp size={16} />} title="Budget · Target · Forecast · Actual — FY2026" action={<PanelAction onClick={() => go('close', undefined, 'budget')}>Variances</PanelAction>}>
          <LineChart
            labels={labels}
            height={200}
            format={(v) => money(v, 'SAR', { compact: true }).replace('SAR ', '')}
            marker={{ at: 8, label: 'Sep close' }}
            series={[
              { label: 'Budget', color: SERIES[1], points: bm.map((m) => m.budget), dashed: true },
              { label: 'Target', color: SERIES[4], points: bm.map((m) => m.target), dashed: true },
              { label: 'Forecast', color: SERIES[0], points: bm.map((m) => m.forecast) },
              { label: 'Actual', color: SERIES[2], points: bm.map((m) => m.actual ?? NaN), area: true },
            ]}
          />
          <Legend className="mt-2" items={[{ label: 'Budget', color: SERIES[1], dashed: true }, { label: 'Target', color: SERIES[4], dashed: true }, { label: 'Forecast (schedule + weighted pipeline)', color: SERIES[0] }, { label: 'Actual (recognised)', color: SERIES[2] }]} />
          <ProvenanceNote>Tasama's own four columns (Budget, Target, Forecast, Actual by month and business line) with synthetic values. Forecast is the billing schedule plus weighted pipeline — not a typed number.</ProvenanceNote>
        </Panel>
      </PageColumns>

      <PageSection label="The process, in four stages" action={<button type="button" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => go('l2c', undefined, 'process')}><Route size={12} /> Open the process view <ArrowRight size={11} /></button>}>
        <div className="grid gap-3 md:grid-cols-4">
          {STAGES.map((st) => { const m = stageMetrics(world, st.id); const headline = m[st.id === 'lead-to-contract' ? 1 : st.id === 'contract-to-service' ? 1 : st.id === 'service-to-cash' ? 2 : 1]; const alert = m.find((x) => x.tone === 'bad' && x.value !== '0') ?? m.find((x) => x.tone === 'warn' && x.value !== '0'); return (
            <button key={st.id} type="button" onClick={() => go('l2c', undefined, 'process')} className="rounded-xl border border-border/60 glass-l3 p-3 text-start transition-colors hover:border-primary/40">
              <div className="flex items-center justify-between gap-2"><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Stage {st.index}</span><Chip tone={st.mizanRole === 'reads' ? 'muted' : 'primary'}>{st.mizanRole === 'reads' ? 'reads' : 'operates'}</Chip></div>
              <div className="mt-1 font-serif text-base leading-tight">{st.name}</div>
              <div className="mt-2 text-[11px] text-muted-foreground">{headline.label}</div>
              <div className="font-mono text-sm tabular-nums">{headline.value}</div>
              {alert ? <div className={`mt-1.5 text-[11px] ${alert.tone === 'bad' ? 'text-danger' : 'text-warn'}`}>{alert.label} · {alert.value}</div> : <div className="mt-1.5 text-[11px] text-success">nothing flagged</div>}
            </button>
          ); })}
        </div>
      </PageSection>

      <PageSection label="Where the money sits">
        <div className="grid gap-4 md:grid-cols-3">
          <Panel icon={<FileWarning size={16} />} title="Unbilled by reason">
            <UnbilledByReason />
          </Panel>
          <Panel icon={<Banknote size={16} />} title="Receivables by segment">
            {Object.entries(dsoBySegment(world)).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-border/30 py-1.5 text-[12px] last:border-0">
                <span>{k}</span><span className="font-mono tabular-nums text-muted-foreground">{v.dso === null ? 'no billing in 90 d' : `${v.dso} d`}</span><Money v={v.ar} compact />
              </div>
            ))}
            <ProvenanceNote>Saudi B2B terms are long and PIF and Government cycles longer still; the segment split is the honest view of DSO.</ProvenanceNote>
          </Panel>
          <Panel icon={<Coins size={16} />} title="Margin by client (September)">
            {margins.filter((m) => m.revenue).slice(0, 6).map((m) => (
              <div key={m.client.id} className="flex items-center justify-between border-b border-border/30 py-1.5 text-[12px] last:border-0">
                <span>{m.client.short}</span><Money v={m.revenue} compact className="text-muted-foreground" /><span className={`font-mono tabular-nums ${(m.marginPct ?? 0) >= GM_TARGET ? 'text-success' : 'text-warn'}`}>{m.marginPct === null ? '—' : pct(m.marginPct)}</span>
              </div>
            ))}
            <ProvenanceNote>Vendor cost is matched from invoices; payroll is allocated from the HR register by timesheet share{marginByClient(world).estimate ? ' — at the August run-rate until September\'s register is booked' : ''}.</ProvenanceNote>
          </Panel>
        </div>
      </PageSection>
      <div><div className="flex items-center gap-2 text-[11px] text-muted-foreground"><CalendarClock size={12} /> Close calendar: statements read on Day 1, hard close by Day 10 — the outer bound Tasama commits to its own clients, applied here to Tasama's own books — with a five-day target.</div></div>
      </Body>
    </>
  );
}

import { eventStatus, EVENT_STATUS_LABEL, toSAR } from '@mizan/domain/derive';
import type { World, BillingEvent } from '@mizan/domain/types';
function eventStatusSafe(world: World, e: BillingEvent) { return eventStatus(world, e); }

function UnbilledByReason() {
  const { world, go } = useApp();
  const groups: Record<string, { n: number; amt: number }> = {};
  for (const e of world.events) {
    const s = eventStatus(world, e);
    if (!['due', 'missed', 'blocked_coc', 'blocked_no_po', 'blocked_evidence'].includes(s)) continue;
    groups[s] = groups[s] ?? { n: 0, amt: 0 }; groups[s].n++; groups[s].amt += toSAR(e.expectedAmount, e.currency);
  }
  const order = ['due', 'missed', 'blocked_coc', 'blocked_no_po', 'blocked_evidence'] as const;
  return (
    <>
      {order.filter((k) => groups[k]).map((k) => (
        <button key={k} type="button" onClick={() => go('l2c', undefined, 'billing')} className="flex w-full items-center justify-between border-b border-border/30 py-1.5 text-start text-[12px] last:border-0 hover:bg-card/40">
          <span>{EVENT_STATUS_LABEL[k]}</span><span className="font-mono text-muted-foreground">{groups[k].n}</span><Money v={groups[k].amt} compact />
        </button>
      ))}
      <ProvenanceNote>"Blocked — no PO cover" is work delivered without an instrument to bill it; it is not in unbilled revenue because it is not recognised.</ProvenanceNote>
    </>
  );
}
