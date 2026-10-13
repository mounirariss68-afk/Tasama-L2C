/**
 * Lead to Cash — the workspace. One job: from the signed PO to the applied
 * receipt. Contracts & POs · Billing · Collections · Clients.
 */
import { useMemo, useState } from 'react';
import { Banknote, Building2, FileSignature, FileText, Receipt, Route } from 'lucide-react';
import { PageColumns, PageContainer, PageMasthead, PageSection, Panel, PanelAction, StatRow, StatTile } from '@cognirise/atelier/layout';
import { AgentAutonomyChip, DemoReference, ProvenanceChip, ProvenanceNote, WorkItemCard, WorkflowStep, WorkflowWalkthrough, WorkspaceLane, WorkspaceLanes } from '@cognirise/atelier/archetypes';
import { useApp } from '../app/state';
import { Body, AgentMark, Btn, Chip, EventStatusChip, KV, Money, Table, Tabs, Trail } from '../app/bits';
import { ageBucket, ageing, arOpen, clientOf, daysBetween, dso, eventStatus, invoiceOf, isInvoiced, lineOf, marginByClient, openInvoices, poConsumption, toSAR, unbilled, waterfall, GM_TARGET, type EventStatus } from '@mizan/domain/derive';
import { date, money, pct, period } from '@mizan/domain/format';
import { STAGES, stageMetrics, type StageId } from '@mizan/domain/process';
import { WORKFLOWS } from '@mizan/domain/workflows';
import { BUSINESS_LINE_LABEL, PRICING_LABEL } from '@mizan/domain/types';
import { Meter, StackBar, SERIES, STATUS } from '../lib/viz';

export function L2CScreen() {
  const { world, clientLens, persona } = useApp();
  const visible = persona.clients.length ? persona.clients : world.clients.map((c) => c.id);
  const scope = clientLens && visible.includes(clientLens) ? [clientLens] : visible;
  const client = scope.length === 1 ? clientOf(world, scope[0]) : null;
  const w = useMemo(() => ({ ...world, events: world.events.filter((e) => scope.includes(e.clientId)), invoices: world.invoices.filter((i) => scope.includes(i.clientId)), pos: world.pos.filter((p) => scope.includes(p.clientId)), clients: world.clients.filter((c) => scope.includes(c.id)) }), [world, scope]);
  const wf = waterfall(w);
  return (
    <>
      <PageMasthead title={client ? `${client.short} — lead to cash` : 'Lead to cash'} meta={client ? client.name : `${w.clients.length} accounts · ${w.pos.length} purchase orders · ${w.pos.reduce((s, p) => s + p.lines.length, 0)} lines`}
        figures={<><Chip tone="primary">{period(world.closingPeriod)}</Chip><Chip>contracted {money(wf.contracted, 'SAR', { compact: true })}</Chip><Chip>invoiced {money(wf.invoiced, 'SAR', { compact: true })}</Chip><Chip tone={unbilled(w) ? 'warn' : 'success'}>unbilled {money(unbilled(w), 'SAR', { compact: true })}</Chip></>} />

      <Body>
        <Tabs storageKey="l2c" tabs={[
        { id: 'process', label: 'Process', body: () => <ProcessTab /> },
        { id: 'contracts', label: 'Contracts & orders', body: () => <><ContractsTab w={w} /><OrdersTab w={w} /></> },
        { id: 'billing', label: 'Billing', body: () => <BillingTab w={w} /> },
        { id: 'collections', label: 'Collections', body: () => <CollectionsTab w={w} /> },
        { id: 'clients', label: 'Clients', body: () => <ClientsTab w={w} /> },
      ]} />
      </Body>
    </>
  );
}

type W = ReturnType<typeof useApp>['world'];

const STAGE_TONE: Record<string, 'success' | 'warn' | 'danger' | 'muted'> = { good: 'success', warn: 'warn', bad: 'danger', neutral: 'muted' };

/** The four stages, with live numbers from the same derivations the other tabs use, and every step's actor, system, gate, agent and coverage. */
function ProcessTab() {
  const { world, go } = useApp();
  const [open, setOpen] = useState<StageId>('service-to-cash');
  const stage = STAGES.find((s) => s.id === open)!;
  return (
    <>
      <PageSection label="Lead-to-cash in four stages — Tasama's own lifecycle names, with the close split out">
        <div className="grid gap-3 lg:grid-cols-4">
          {STAGES.map((st) => {
            const m = stageMetrics(world, st.id);
            const sel = st.id === open;
            return (
              <button key={st.id} type="button" onClick={() => setOpen(st.id)} className={`rounded-xl border p-3 text-start transition-colors ${sel ? 'border-primary/60 bg-primary/10' : 'border-border/60 glass-l3 hover:border-primary/40'}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Stage {st.index}</span><Chip tone={st.mizanRole === 'reads' ? 'muted' : 'primary'}>{st.mizanRole === 'reads' ? 'Mizan reads' : 'Mizan operates'}</Chip></div>
                <div className="mt-1 font-serif text-lg leading-tight">{st.name}</div>
                <p className="mt-1 text-xs italic text-muted-foreground">{st.question}</p>
                <div className="mt-3 space-y-1">
                  {m.slice(0, 4).map((x) => <div key={x.label} className="flex items-baseline justify-between gap-2 text-[11px]"><span className="truncate text-muted-foreground">{x.label}</span><span className={`font-mono tabular-nums ${x.tone === 'bad' ? 'text-danger' : x.tone === 'warn' ? 'text-warn' : x.tone === 'good' ? 'text-success' : ''}`}>{x.value}</span></div>)}
                </div>
                <div className="mt-3 text-[10px] text-muted-foreground">{st.steps.length} steps · {st.steps.filter((x) => x.coverage === 'implemented').length} implemented · {st.steps.filter((x) => x.coverage === 'read-only').length} read-only</div>
              </button>
            );
          })}
        </div>
      </PageSection>
      <PageSection label={`Stage ${stage.index} — ${stage.name}`} action={<span className="text-[11px] text-muted-foreground">{stage.tasamaName}</span>}>
        <PageColumns aside={
          <Panel icon={<Route size={16} />} title="Owner, systems, numbers">
            <KV rows={[['Owner', stage.owner], ['Systems of record', stage.systems.join(' · ')], ['Mizan', stage.mizanRole === 'reads' ? 'Reads only — the pipeline, the quote lines and the contract terms stay where they are' : 'Operates the stage and posts to the ERP through the connector']]} />
            <div className="mt-3 space-y-1.5">{stageMetrics(world, stage.id).map((x) => <div key={x.label} className="flex items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">{x.label}</span><Chip tone={STAGE_TONE[x.tone ?? 'neutral']}>{x.value}</Chip></div>)}</div>
            <ProvenanceNote>{stage.id === 'lead-to-contract' ? 'Opportunities and contract terms are read from Salesforce and Sirion (simulated here). Nothing in this stage is edited in Mizan.' : stage.id === 'close' ? 'The close is Tasama\'s own month-end — its books, its bank accounts, its budget. The finance work Tasama performs for its clients is a different platform and is not covered here.' : 'Every number on the left is derived from the same world the other tabs show: nothing is typed in.'}</ProvenanceNote>
          </Panel>
        }>
          <Panel title={`${stage.steps.length} steps`} action={<span className="text-[11px] text-muted-foreground">actor → system → what Mizan does → gate</span>}>
            <WorkflowWalkthrough>
              {stage.steps.map((st, i) => {
                const wf = st.workflowId ? WORKFLOWS.find((x) => x.id === st.workflowId) : undefined;
                return (
                  <WorkflowStep key={st.id} index={i + 1} title={st.title}
                    actor={<span className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">{st.actor}</span><Chip tone="muted">{st.system}</Chip>{st.agentId ? <AgentMark id={st.agentId} size={18} /> : null}</span>}
                    detail={st.mizan}
                    decision={st.gate ? `Gate: ${st.gate}` : undefined}
                    autonomy={st.autonomy ? <AgentAutonomyChip level={st.autonomy} /> : undefined}
                    coverage={st.coverage === 'read-only' ? undefined : st.coverage}
                    outputs={wf ? [<button key="wf" type="button" className="text-start text-xs text-primary hover:underline" onClick={() => go('agents', wf.id, 'workflows')}>Workflow {wf.id.toUpperCase()}: {wf.name} →</button>] : st.coverage === 'read-only' ? [<span key="ro" className="text-xs text-muted-foreground">Read-only in Mizan — the system of record stays authoritative</span>] : undefined} />
                );
              })}
            </WorkflowWalkthrough>
          </Panel>
        </PageColumns>
      </PageSection>
    </>
  );
}

/** Stage 1 as Mizan sees it: opportunities read from Salesforce (forecast only) and the contract terms extracted from Sirion. */
function ContractsTab({ w }: { w: W }) {
  const { world } = useApp();
  const opps = world.opportunities.filter((o) => w.clients.some((c) => c.id === o.clientId));
  const open = opps.filter((o) => !o.stage.startsWith('Closed'));
  const weighted = open.reduce((s, o) => s + (o.recurring ? o.amount * o.termMonths : o.amount) * o.probability, 0);
  const contracts = world.contracts.filter((c) => w.clients.some((x) => x.id === c.clientId));
  const expiryTone = (c: typeof contracts[number]) => c.status === 'expired' ? 'danger' : c.end <= '2027-01-06' ? 'warn' : 'success';
  return (
    <>
      <PageSection label="Opportunities — read from Salesforce, feed the forecast only">
        <Panel icon={<Route size={16} />} title={`${open.length} open opportunities · weighted ${money(weighted, 'SAR', { compact: true })} over their terms`} action={<Chip tone="muted">read-only · Salesforce Sales (simulated)</Chip>}>
          <Table head={['Opportunity', 'Client', 'Line', 'Stage', 'Amount', 'Probability', 'Expected start', 'Owner', 'Note']}
            rows={opps.map((o) => [
              <span><DemoReference>{o.id}</DemoReference><div className="text-[11px] text-muted-foreground">{o.name}</div></span>,
              clientOf(world, o.clientId).short,
              <span className="text-[11px]">{BUSINESS_LINE_LABEL[o.businessLine]}</span>,
              <Chip tone={o.stage === 'Closed won' ? 'success' : o.stage === 'Closed lost' ? 'danger' : o.stage.startsWith('Negotiation') || o.stage.startsWith('Proposal') ? 'primary' : 'muted'}>{o.stage}</Chip>,
              <span className="font-mono text-[11px] tabular-nums">{money(o.amount, 'SAR', { compact: true })}{o.recurring ? <span className="text-muted-foreground"> / month × {o.termMonths}</span> : <span className="text-muted-foreground"> one-off</span>}</span>,
              <span className="font-mono tabular-nums">{pct(o.probability)}</span>,
              <span className="text-[11px] text-muted-foreground">{date(o.expectedStart)}</span>,
              <span className="text-[11px]">{o.owner}</span>,
              <span className="text-[11px] text-muted-foreground">{o.note}</span>,
            ])} />
          <ProvenanceNote>Mizan does not run sales. It reads the weighted pipeline by business line and month so Mizaniya can re-cut the forecast; the Deal Review Committee, pricing and CPQ stay in Salesforce.</ProvenanceNote>
        </Panel>
      </PageSection>
      <PageSection label="Contracts — the billing terms extracted from Sirion">
        <Panel icon={<FileSignature size={16} />} title={`${contracts.length} contracts`} action={<span className="text-[11px] text-muted-foreground">Aqd extracts payment days, CoC requirement, rate card, expiry</span>}>
          <Table head={['Contract', 'Client', 'Type', 'Status', 'Term', 'Total value', 'Payment terms', 'CoC required', 'Rate card', 'Source', 'Expiry watch']}
            rows={contracts.map((c) => { const days = daysBetween(world.asOf, c.end); const posOn = world.pos.filter((p) => p.contractId === c.id).length; return [
              <span><DemoReference>{c.id}</DemoReference><div className="text-[11px] text-muted-foreground">{posOn} PO(s)</div></span>,
              clientOf(world, c.clientId).short,
              <span className="text-[11px]">{c.type}</span>,
              <Chip tone={c.status === 'expired' ? 'danger' : c.status === 'active' ? 'success' : 'muted'}>{c.status}</Chip>,
              <span className="text-[11px] text-muted-foreground">{date(c.start)} – {date(c.end)}</span>,
              c.totalValue ? <Money v={c.totalValue} compact /> : <span className="text-muted-foreground">framework</span>,
              <span className="font-mono tabular-nums">{c.paymentTermsDays} days</span>,
              c.cocRequired ? <Chip tone="primary">yes</Chip> : <span className="text-muted-foreground">no</span>,
              <span className="font-mono text-[11px]">{c.rateCardVersion}</span>,
              <span className="text-[11px] text-muted-foreground">{c.source}</span>,
              <Chip tone={expiryTone(c)}>{c.status === 'expired' ? `expired ${-days} days ago` : days <= 92 ? `expires in ${days} days` : 'in term'}</Chip>,
            ]; })} />
          <ProvenanceNote>REDC's framework expired on 31 August with delivery continuing: Hares flags the revenue at risk and Aqd has drafted the extension request. Expiry within 90 days starts the renewal watch (wf-09).</ProvenanceNote>
        </Panel>
      </PageSection>
    </>
  );
}

function OrdersTab({ w }: { w: W }) {
  const { world, go } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const po = open ? world.pos.find((p) => p.id === open) : null;
  return (
    <>
      <PageSection label="Purchase orders and their cover">
        <Panel icon={<FileText size={16} />} title={`${w.pos.length} purchase orders`} action={<span className="text-[11px] text-muted-foreground">Consumed = invoiced + unbilled ÷ PO value</span>}>
          <Table head={['PO', 'Client', 'Contract', 'Term', 'Value', 'Consumed', 'Uncovered', 'Status', '']}
            rows={w.pos.map((p) => { const c = poConsumption(world, p.id); const contract = world.contracts.find((x) => x.id === p.contractId)!; return [
              <button type="button" className="text-start hover:underline" onClick={() => setOpen(p.id)}><DemoReference>{p.id}</DemoReference><div className="text-[11px] text-muted-foreground">{p.lines.length} line(s) · {p.lines.flatMap((l) => l.matchFlags).length ? <span className="text-warn">{p.lines.flatMap((l) => l.matchFlags).length} flag</span> : 'no flags'}</div></button>,
              clientOf(world, p.clientId).short,
              <span className="text-[11px]"><DemoReference>{contract.id}</DemoReference><div className={contract.status === 'expired' ? 'text-danger' : 'text-muted-foreground'}>{contract.type} · {contract.status} · to {date(contract.end)}</div></span>,
              <span className="text-[11px] text-muted-foreground">{date(p.start)} – {date(p.end)}</span>,
              <Money v={p.value} currency={p.currency} compact />,
              <div className="min-w-[7rem]"><div className="flex items-center justify-end gap-2 font-mono text-[11px] tabular-nums">{pct(c.pct)}</div><Meter value={c.pct} target={0.8} tone={c.pct > 0.95 ? 'danger' : c.pct > 0.8 ? 'warn' : 'primary'} /></div>,
              c.uncovered ? <span className="font-mono tabular-nums text-danger">{money(c.uncovered, p.currency, { compact: true })}</span> : <span className="text-muted-foreground">—</span>,
              <Chip tone={p.status === 'expired' ? 'danger' : p.status === 'open' ? 'success' : 'muted'}>{p.status}</Chip>,
              p.scheduleConfirmed ? <Chip tone="muted">schedule confirmed</Chip> : <Chip tone="warn">schedule to confirm</Chip>,
            ]; })} />
          <ProvenanceNote>Jada sits at 96% with three AMS months left; REDC's PO expired on 31 August with delivery continuing. Both are Hares findings and Aqd has drafted the requests to the KAMs.</ProvenanceNote>
        </Panel>
      </PageSection>
      {po ? (
        <PageSection label={`${po.id} — lines and billing schedule`} action={<Btn tone="ghost" small onClick={() => setOpen(null)}>Close</Btn>}>
          <PageColumns aside={<Panel title="Purchase order"><KV rows={[['Client', clientOf(world, po.clientId).name], ['Contract', <DemoReference>{po.contractId}</DemoReference>], ['Proposal', <DemoReference>{po.proposalId}</DemoReference>], ['PO date', date(po.date)], ['Term', `${date(po.start)} – ${date(po.end)}`], ['Value', money(po.value, po.currency)], ['Payment terms', `${clientOf(world, po.clientId).paymentTermsDays} days`], ['CoC required', world.contracts.find((x) => x.id === po.contractId)!.cocRequired ? 'Yes (AMS, PMIS, ERP, ServiceNow lines)' : 'No']]} /><div className="mt-3"><Trail entries={world.trail.filter((t) => t.recordRef === po.id)} limit={5} /></div></Panel>}>
            {po.lines.map((l) => {
              const evs = world.events.filter((e) => e.lineId === l.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
              return (
                <Panel key={l.id} title={l.activity} action={<Chip tone="primary">{PRICING_LABEL[l.pricingModel]}</Chip>}>
                  <div className="mb-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span>{BUSINESS_LINE_LABEL[l.businessLine]}</span><span>· {l.serviceTag}</span><span>· {money(l.rate, po.currency)} per {l.unit}</span>{l.vendorPOId ? <span>· vendor PO {l.vendorPOId}</span> : null}</div>
                  {l.matchFlags.map((m) => <div key={m} className="mb-2 rounded-md border border-warn/40 bg-warn/10 p-2 text-xs text-warn">⚠ {m}</div>)}
                  <Table head={['Event', 'Due', 'Expected', 'Evidence', 'CoC', 'Status', 'Invoice']} rows={evs.map((e) => { const s = eventStatus(world, e); return [
                    <span className="text-[11px]">{e.label}</span>, <span className="text-[11px] text-muted-foreground">{date(e.dueDate)}</span>, <Money v={e.expectedAmount} currency={e.currency} />,
                    <span className="text-[11px]">{e.evidence.length ? e.evidence.map((v) => v.label).join('; ') : e.dueDate > world.asOf ? '—' : <span className="text-warn">missing</span>}</span>,
                    <span className="text-[11px]">{e.coc === 'not_required' ? '—' : e.coc}</span>, <EventStatusChip status={s} />,
                    e.invoiceId ? <button type="button" className="text-[11px] hover:underline" onClick={() => go('inbox', `rel:${e.invoiceId}`)}><DemoReference>{e.invoiceId}</DemoReference></button> : <span className="text-muted-foreground">—</span>,
                  ]; })} />
                </Panel>
              );
            })}
          </PageColumns>
        </PageSection>
      ) : null}
    </>
  );
}

function BillingTab({ w }: { w: W }) {
  const { world, go, actions, persona } = useApp();
  const evs = w.events.filter((e) => e.period === world.closingPeriod || ['missed', 'blocked_coc', 'blocked_no_po'].includes(eventStatus(world, e)));
  const byStatus = (s: EventStatus[]) => evs.filter((e) => s.includes(eventStatus(world, e)));
  const intake = byStatus(['due', 'missed', 'blocked_coc', 'blocked_evidence', 'blocked_no_po']);
  const inflight = byStatus(['drafted', 'released', 'rejected']);
  const output = byStatus(['cleared', 'paid']);
  const canRun = ['faisal', 'noura'].includes(persona.id);
  const dueCount = byStatus(['due']).length;
  const card = (e: typeof evs[number]) => { const s = eventStatus(world, e); const inv = invoiceOf(world, e.invoiceId); return (
    <WorkItemCard key={e.id} reference={<DemoReference>{inv ? inv.id : e.id.split('/').pop()}</DemoReference>} title={`${clientOf(world, e.clientId).short} — ${e.label}`} state={<EventStatusChip status={s} />}
      handler={<span className="text-[11px] text-muted-foreground">{s.startsWith('blocked_coc') ? 'Shahid' : s === 'missed' ? 'Hares' : s === 'blocked_no_po' ? 'Aqd' : s === 'rejected' ? 'Fatoora' : s === 'drafted' ? 'Head of Revenue & Treasury' : 'Fatoora'}</span>}
      meta={<span className="font-mono tabular-nums">{money(e.expectedAmount, e.currency)}{inv?.erpRef ? ` · ${inv.erpRef}` : ''}</span>}
      onOpen={() => { if (inv?.status === 'draft') go('inbox', `rel:${inv.id}`); else if (inv?.zatca === 'rejected') go('inbox', `zatca:${inv.id}`); else if (s === 'missed') go('inbox', `catch:${e.id}`); else if (s === 'blocked_coc') go('inbox', `coc:${e.id}`); }} />); };
  return (
    <>
      <PageSection label={`Billing run — ${period(world.closingPeriod)}`} action={canRun ? <Btn tone="primary" small disabled={!dueCount} onClick={() => actions.runBillingRun()}>Draft {dueCount} due invoice{dueCount === 1 ? '' : 's'}</Btn> : <span className="text-[11px] text-muted-foreground">Billing run: Head of Revenue & Treasury</span>}>
        <StatRow>
          <StatTile label="Due — ready to invoice" value={String(byStatus(['due']).length)} state={money(byStatus(['due']).reduce((s, e) => s + toSAR(e.expectedAmount, e.currency), 0), 'SAR', { compact: true })} />
          <StatTile label="Missed (earlier months)" value={String(byStatus(['missed']).length)} state={money(byStatus(['missed']).reduce((s, e) => s + toSAR(e.expectedAmount, e.currency), 0), 'SAR', { compact: true })} trend={{ direction: byStatus(['missed']).length ? 'down' : 'flat', label: 'Hares', sentiment: byStatus(['missed']).length ? 'bad' : 'good' }} />
          <StatTile label="Blocked" value={String(byStatus(['blocked_coc', 'blocked_no_po', 'blocked_evidence']).length)} state={money(byStatus(['blocked_coc', 'blocked_no_po', 'blocked_evidence']).reduce((s, e) => s + toSAR(e.expectedAmount, e.currency), 0), 'SAR', { compact: true })} trend={{ direction: 'flat', label: `${byStatus(['blocked_coc']).length} CoC · ${byStatus(['blocked_no_po']).length} no PO`, sentiment: 'neutral' }} />
          <StatTile label="Invoiced this month" value={String(inflight.length + output.length)} state={money([...inflight, ...output].reduce((s, e) => s + toSAR(invoiceOf(world, e.invoiceId)?.net ?? 0, e.currency), 0), 'SAR', { compact: true })} trend={{ direction: 'flat', label: `${byStatus(['rejected']).length} rejected by ZATCA`, sentiment: byStatus(['rejected']).length ? 'bad' : 'good' }} />
        </StatRow>
      </PageSection>
      <div>
        <WorkspaceLanes>
          <WorkspaceLane title="Intake" caption="Due, missed or blocked — not yet an invoice" count={intake.length} tone="accent">{intake.length ? intake.map(card) : <p className="text-xs text-muted-foreground">Everything due is invoiced.</p>}</WorkspaceLane>
          <WorkspaceLane title="In flight" caption="Drafted, awaiting release, posting or rejected" count={inflight.length}>{inflight.length ? inflight.map(card) : <p className="text-xs text-muted-foreground">No drafts. Run the billing run.</p>}</WorkspaceLane>
          <WorkspaceLane title="Output" caption="Posted to the ERP and cleared by ZATCA" count={output.length}>{output.length ? output.map(card) : <p className="text-xs text-muted-foreground">Nothing cleared yet this month.</p>}</WorkspaceLane>
        </WorkspaceLanes>
      </div>
    </>
  );
}

function CollectionsTab({ w }: { w: W }) {
  const { world, go } = useApp();
  const open = openInvoices(w).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const ag = ageing(w);
  const colors = [SERIES[2], SERIES[0], STATUS.warn, STATUS.danger, STATUS.danger];
  return (
    <>
      <PageSection label="Ageing">
        <div className="grid gap-4 md:grid-cols-3">
          <Panel icon={<Banknote size={16} />} title="Open receivables"><KV rows={[['Open', money(arOpen(w))], ['Overdue', money(Object.entries(ag).filter(([k]) => k !== 'Current').reduce((s, [, v]) => s + v, 0))], ['DSO (90-day countback)', `${dso(w)} days`], ['Invoices open', open.length]]} /></Panel>
          <Panel title="Ageing buckets" className="md:col-span-2"><StackBar segments={Object.entries(ag).map(([k, v], i) => ({ label: k, value: v, color: colors[i] }))} /><div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-5">{Object.entries(ag).map(([k, v], i) => <div key={k} className="flex items-center justify-between text-[11px]"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: colors[i] }} />{k}</span><Money v={v} compact /></div>)}</div><ProvenanceNote>Saudi B2B terms are long and PIF and Government cycles longer still; Government invoices run through Etimad and are reminded later.</ProvenanceNote></Panel>
        </div>
      </PageSection>
      <PageSection label="Open invoices">
          <Panel icon={<Receipt size={16} />} title={`${open.length} open invoices`}>
            <Table head={['Invoice', 'Client', 'Description', 'Issued', 'Due', 'Days', 'Gross', 'Dunning', '']} rows={open.map((i) => { const c = clientOf(world, i.clientId); const days = daysBetween(i.dueDate, world.asOf); const dn = world.dunning.find((d) => d.invoiceId === i.id); return [
              <DemoReference>{i.id}</DemoReference>, <span>{c.short} <span className="text-[10px] text-muted-foreground">{c.segment} · {c.channel}</span></span>, <span className="text-[11px] text-muted-foreground">{i.description}</span>, <span className="text-[11px]">{date(i.date)}</span>, <span className="text-[11px]">{date(i.dueDate)}</span>,
              <span className={`font-mono tabular-nums ${days > 60 ? 'text-danger' : days > 0 ? 'text-warn' : 'text-muted-foreground'}`}>{days > 0 ? `+${days}` : days}</span>, <Money v={i.gross} currency={i.currency} />,
              dn ? <Chip tone={dn.status === 'sent' ? 'success' : dn.status === 'held' ? 'muted' : 'warn'}>{dn.status === 'proposed' ? `${dn.proposedStage} proposed` : `${dn.stage} ${dn.status}`}</Chip> : <Chip tone="muted">{ageBucket(days)}</Chip>,
              dn && dn.status === 'proposed' ? <Btn small onClick={() => go('inbox', `dun:${dn.id}`)}>Review</Btn> : null,
            ]; })} />
            <ProvenanceNote>Tahseel stages by segment and channel: Government invoices run through Etimad and are reminded later; private accounts under the auto-dunning limit are sent and reported.</ProvenanceNote>
          </Panel>
      </PageSection>
    </>
  );
}

function ClientsTab({ w }: { w: W }) {
  const { world, setClientLens, clientLens, go } = useApp();
  const margins = marginByClient(world).filter((m) => w.clients.some((c) => c.id === m.client.id));
  const [sel, setSel] = useState<string | null>(clientLens);
  const c = sel ? clientOf(world, sel) : null;
  return (
    <>
      <PageSection label="Accounts">
        <Panel icon={<Building2 size={16} />} title={`${w.clients.length} accounts`}>
          <Table head={['Client', 'Segment', 'KAM', 'POs', 'Revenue YTD', 'Vendor cost', 'Margin', 'Open AR', 'Findings', '']} rows={margins.map((m) => { const pos = world.pos.filter((p) => p.clientId === m.client.id); const ar = openInvoices(world).filter((i) => i.clientId === m.client.id).reduce((s, i) => s + toSAR(i.gross, i.currency), 0); const f = world.findings.filter((x) => x.clientId === m.client.id && !x.acknowledged).length; return [
            <button type="button" className="text-start hover:underline" onClick={() => setSel(m.client.id)}><div>{m.client.short}</div><div className="text-[11px] text-muted-foreground">{m.client.name}</div></button>, <Chip tone={m.client.pif ? 'primary' : 'accent'}>{m.client.segment}</Chip>, <span className="text-[11px]">{m.client.kam}</span>, pos.length, <Money v={m.revenue} compact />, <Money v={m.vendorCost} compact />,
            <span className={`font-mono tabular-nums ${m.marginPct >= GM_TARGET ? 'text-success' : 'text-warn'}`}>{pct(m.marginPct)}</span>, <Money v={ar} compact />, f ? <Chip tone="warn">{f}</Chip> : <span className="text-muted-foreground">—</span>,
            <Btn small tone="ghost" onClick={() => { setClientLens(m.client.id); go('l2c', undefined, 'billing'); }}>Focus</Btn>,
          ]; })} />
        </Panel>
      </PageSection>
      {c ? (
        <PageSection label={`${c.short} — account`} action={<Btn tone="ghost" small onClick={() => setSel(null)}>Close</Btn>}>
          <PageColumns aside={<Panel title="Account"><KV rows={[['Name', c.name], ['Code', c.code], ['Segment', `${c.segment}${c.pif ? ' (PIF)' : ''}`], ['KAM', c.kam], ['Delivery lead', c.deliveryLead], ['VAT no.', c.vatNo ?? <span className="text-danger">missing</span>], ['Terms', `${c.paymentTermsDays} days · ${c.channel}`], ['Currency', c.currency]]} /><div className="mt-3 text-[11px] text-muted-foreground"><ProvenanceChip kind="synthetic" /> Contract and figures invented; the company is real.</div></Panel>}>
            <Panel title="Contracts and POs">{world.contracts.filter((x) => x.clientId === c.id).map((k) => <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 py-1.5 text-xs last:border-0"><span><DemoReference>{k.id}</DemoReference> {k.type}</span><span className="text-muted-foreground">{date(k.start)} – {date(k.end)} · {k.paymentTermsDays} days · CoC {k.cocRequired ? 'required' : 'not required'} · rate card {k.rateCardVersion}</span><Chip tone={k.status === 'expired' ? 'danger' : 'success'}>{k.status}</Chip></div>)}
              {world.pos.filter((p) => p.clientId === c.id).map((p) => { const cons = poConsumption(world, p.id); return <div key={p.id} className="mt-2 rounded-md border border-border/50 p-2 text-xs"><div className="flex justify-between"><DemoReference>{p.id}</DemoReference><Money v={p.value} currency={p.currency} /></div><Meter value={cons.pct} target={0.8} tone={cons.pct > 0.95 ? 'danger' : 'primary'} className="my-1.5" /><div className="text-muted-foreground">{pct(cons.pct)} consumed · invoiced {money(cons.invoiced, p.currency, { compact: true })} · unbilled {money(cons.unbilled, p.currency, { compact: true })}{cons.uncovered ? ` · uncovered ${money(cons.uncovered, p.currency, { compact: true })}` : ''}</div></div>; })}
            </Panel>
            <Panel title="Findings and activity">
              {world.findings.filter((f) => f.clientId === c.id).map((f) => <div key={f.id} className="border-b border-border/30 py-1.5 text-xs last:border-0"><div className="flex justify-between"><span><Chip tone={f.acknowledged ? 'muted' : 'warn'}>{f.kind}</Chip> {f.summary}</span><Money v={f.amount} compact /></div></div>)}
              <div className="mt-3"><Trail entries={world.trail.filter((t) => { const ref = t.recordRef ?? ''; return world.events.some((e) => e.clientId === c.id && (ref === e.id || ref === e.invoiceId)) || world.invoices.some((i) => i.clientId === c.id && ref === i.id) || world.pos.some((p) => p.clientId === c.id && ref === p.id); })} limit={6} /></div>
            </Panel>
          </PageColumns>
        </PageSection>
      ) : null}
    </>
  );
}

export { isInvoiced, lineOf, PanelAction, waterfall };
