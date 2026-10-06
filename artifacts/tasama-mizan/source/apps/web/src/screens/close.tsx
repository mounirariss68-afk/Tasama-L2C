/**
 * Close — month-end, bank and budget. Checklist · Bank reconciliation ·
 * Budget vs actual · Journals. Every status is derived from the data.
 */
import { useState } from 'react';
import { BookOpenCheck, CalendarCheck, Landmark, Scale, TrendingUp } from 'lucide-react';
import { PageColumns, PageContainer, PageMasthead, PageSection, Panel, StatRow, StatTile } from '@cognirise/atelier/layout';
import { DemoBanner, DemoReference, ProvenanceChip, ProvenanceNote } from '@cognirise/atelier/archetypes';
import { useApp } from '../app/state';
import { AgentMark, Btn, Chip, Delta, KV, Money, PersonMark, Table, Tabs, Trail } from '../app/bits';
import { arOpen, bankRec, budgetByLine, budgetByMonth, closeSummary, deferredBalance, fyTotals, marginByClient, recognisedByClientMonth, unbilled, GM_TARGET } from '@mizan/domain/derive';
import { date, money, monthName, pct, period } from '@mizan/domain/format';
import { BUSINESS_LINE_LABEL, type CloseWorkstream } from '@mizan/domain/types';
import { ERP_LABEL, journalCall } from '@mizan/domain/erp';
import { BarChart, LineChart, Legend, Meter, SERIES, STATUS } from '../lib/viz';

export function CloseScreen() {
  const { world } = useApp();
  const s = closeSummary(world);
  return (
    <>
      <PageMasthead title={`${period(world.closingPeriod)} close`} meta={`Day ${world.closeDay} of 10 · ${s.done} done · ${s.inProgress} in progress · ${s.blocked} blocked · ${s.notStarted} not started${world.flags.periodClosed ? ' · PERIOD CLOSED' : s.readyToClose ? ' · ready for CFO sign-off' : ''}`}
        figures={<><Chip tone="muted">statements due Day 1</Chip><Chip tone="muted">hard close Day 10</Chip><Chip tone="highlight">target Day 5</Chip></>} />
      <PageContainer><DemoBanner>Checklist statuses are derived from the ledger, the schedule and the reconciliations — not ticked by hand. Authored items (reviews, the pack) are marked done by their owner.</DemoBanner></PageContainer>
      <Tabs storageKey="close" tabs={[
        { id: 'checklist', label: 'Checklist', body: () => <Checklist /> },
        { id: 'bank', label: 'Bank reconciliation', body: () => <Bank /> },
        { id: 'budget', label: 'Budget vs actual', body: () => <Budget /> },
        { id: 'journals', label: 'Journals', body: () => <Journals /> },
      ]} />
    </>
  );
}

const WORKSTREAMS: CloseWorkstream[] = ['Revenue & Billing', 'Receivables', 'Cash & Bank', 'Cost of delivery', 'Tax', 'Budget & Forecast', 'Close pack'];

function Checklist() {
  const { world, actions, persona, go } = useApp();
  const s = closeSummary(world);
  const tone = (st: string) => (st === 'done' ? 'success' : st === 'blocked' ? 'danger' : st === 'in_progress' ? 'primary' : 'muted') as 'success' | 'danger' | 'primary' | 'muted';
  const days = Array.from({ length: 12 }, (_, i) => i - 1);
  return (
    <>
      <PageSection label="Progress">
        <StatRow>
          <StatTile label="Done" value={`${s.done} / ${s.total}`} state={pct(s.done / s.total)} />
          <StatTile label="Blocked" value={String(s.blocked)} state={s.blocked ? 'named below' : 'none'} trend={{ direction: s.blocked ? 'down' : 'flat', label: s.items.filter((i) => i.status === 'blocked').map((i) => i.workstream).join(', ') || 'clear', sentiment: s.blocked ? 'bad' : 'good' }} />
          <StatTile label="Unbilled revenue to accrue" value={money(unbilled(world), 'SAR', { compact: true })} state="contract asset" />
          <StatTile label="Deferred revenue" value={money(deferredBalance(world), 'SAR', { compact: true })} state="contract liability" />
          <StatTile label="AR sub-ledger" value={money(arOpen(world), 'SAR', { compact: true })} state="= GL 1200" />
        </StatRow>
      </PageSection>
      <PageContainer className="mb-4">
        <div className="rounded-xl glass-l2 p-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Close calendar — business days</div>
          <div className="grid grid-cols-12 gap-1">{days.map((d) => { const due = s.items.filter((i) => i.dueDay === d); return (
            <div key={d} className={`rounded-md border p-1.5 text-center text-[10px] ${d === world.closeDay ? 'border-primary/60 bg-primary/12' : d < world.closeDay ? 'border-border/40 bg-card/30' : 'border-border/40'}`}>
              <div className="font-mono">{d < 1 ? `D${d}` : `D${d}`}</div>
              {d === 1 ? <div className="text-muted-foreground">statements</div> : d === 5 ? <div className="text-highlight">target</div> : d === 10 ? <div className="text-muted-foreground">hard close</div> : null}
              {due.length ? <div className="mt-1 flex flex-wrap justify-center gap-0.5">{due.map((i) => <span key={i.id} title={i.title} className={`h-1.5 w-1.5 rounded-full ${i.status === 'done' ? 'bg-success' : i.status === 'blocked' ? 'bg-danger' : i.status === 'in_progress' ? 'bg-primary' : 'bg-muted-foreground/50'}`} />)}</div> : null}
            </div>); })}</div>
        </div>
      </PageContainer>
      {WORKSTREAMS.map((ws) => {
        const items = s.items.filter((i) => i.workstream === ws);
        return (
          <PageSection key={ws} label={ws}>
            <Panel title={<span className="flex items-center gap-2">{ws}<Chip tone={items.every((i) => i.status === 'done') ? 'success' : items.some((i) => i.status === 'blocked') ? 'danger' : 'primary'}>{items.filter((i) => i.status === 'done').length}/{items.length}</Chip></span>}>
              {items.map((i) => (
                <div key={i.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-border/30 py-2 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><Chip tone={tone(i.status)}>{i.status.replace('_', ' ')}</Chip><span className="text-sm">{i.title}</span></div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground"><span>Due Day {i.dueDay}</span><PersonMark id={i.owner} />{i.agentId ? <AgentMark id={i.agentId} size={18} /> : null}{i.derivedFrom ? <Chip tone="muted">derived</Chip> : null}</div>
                    {i.blocker ? <div className="mt-1 text-xs text-warn">Blocker: {i.blocker}</div> : null}
                    {i.evidence ? <div className="mt-1 text-xs text-muted-foreground">Evidence: {i.evidence}</div> : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {i.derivedFrom === 'billing' ? <Btn small onClick={() => go('l2c', undefined, 'billing')}>Billing</Btn> : null}
                    {i.derivedFrom === 'bank' || i.derivedFrom === 'ar_tie' ? <Btn small onClick={() => go('close', undefined, 'bank')}>Bank</Btn> : null}
                    {i.derivedFrom === 'journals' ? <Btn small onClick={() => go('close', undefined, 'journals')}>Journals</Btn> : null}
                    {i.derivedFrom === 'budget' ? <Btn small onClick={() => go('close', undefined, 'budget')}>Budget</Btn> : null}
                    {i.derivedFrom === 'zatca' || i.derivedFrom === 'vendor' ? <Btn small onClick={() => go('inbox')}>Inbox</Btn> : null}
                    {!i.derivedFrom && i.status !== 'done' && i.id !== 'c17' && i.id !== 'c15' ? <Btn small tone="primary" disabled={!(i.owner === persona.id || persona.id === 'noura')} onClick={() => actions.completeCloseItem(i.id)}>Mark done</Btn> : null}
                    {i.id === 'c15' && i.status !== 'done' ? <Btn small tone="primary" disabled={persona.id !== 'noura'} onClick={() => actions.acceptReforecast()}>Accept reforecast</Btn> : null}
                    {i.id === 'c17' && i.status !== 'done' ? <Btn small tone="primary" disabled={persona.id !== 'noura' || !s.readyToClose} onClick={() => actions.closePeriod()}>{s.readyToClose ? 'Close the period' : 'Blocked — items open'}</Btn> : null}
                  </div>
                </div>
              ))}
            </Panel>
          </PageSection>
        );
      })}
    </>
  );
}

function Bank() {
  const { world, actions, persona } = useApp();
  const [acct, setAcct] = useState(world.bankAccounts[0].id);
  const rec = bankRec(world, acct);
  const a = rec.account;
  const lines = world.bankLines.filter((b) => b.accountId === acct && b.date.startsWith(world.closingPeriod)).sort((x, y) => x.date.localeCompare(y.date));
  const ledger = world.ledger.filter((l) => l.accountId === acct && l.date.startsWith(world.closingPeriod)).sort((x, y) => x.date.localeCompare(y.date));
  const receiptFor = (id: string) => world.receipts.find((r) => r.bankLineId === id);
  return (
    <>
      <PageContainer className="mb-4"><div className="flex flex-wrap gap-2">{world.bankAccounts.map((b) => { const r = bankRec(world, b.id); return <button key={b.id} type="button" onClick={() => setAcct(b.id)} className={`rounded-xl border px-3 py-2 text-start ${acct === b.id ? 'border-primary/50 bg-primary/10' : 'border-border/60 bg-card/40 hover:bg-card/70'}`}><div className="text-sm">{b.bank} <span className="text-muted-foreground">· {b.label}</span></div><div className="font-mono text-[11px] text-muted-foreground">{b.currency} · diff {money(r.difference, b.currency)} · {r.unmatchedStatement.length + r.unmatchedLedger.length} open · {b.signedOff ? 'signed off' : r.explained ? 'explained' : 'unexplained'}</div></button>; })}</div></PageContainer>
      <PageSection label={`${a.bank} — ${a.label} — ${period(world.closingPeriod)}`}>
        <PageColumns aside={
          <Panel icon={<Landmark size={16} />} title="Proof" action={a.signedOff ? <Chip tone="success">signed off</Chip> : <Chip tone={rec.explained ? 'primary' : 'danger'}>{rec.explained ? 'explained' : 'unexplained'}</Chip>}>
            <KV rows={[['IBAN', <span className="font-mono text-[11px]">{a.iban}</span>], ['Opening (both)', money(a.openingStatement, a.currency)], ['Statement balance', money(rec.statementBalance, a.currency)], ['Ledger balance', money(rec.ledgerBalance, a.currency)], ['Difference', <span className={rec.difference ? 'text-warn' : 'text-success'}>{money(rec.difference, a.currency)}</span>], ['Matched lines', rec.matchedCount], ['Open statement lines', rec.unmatchedStatement.length], ['Open ledger entries', rec.unmatchedLedger.length], ['Adjusting journals pending', rec.adjustmentsProposed], ['Reconciled through', date(a.reconciledThrough)]]} />
            <div className="mt-3 space-y-1 text-xs">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Difference explained by</div>
              {rec.unmatchedStatement.map((b) => <div key={b.id} className="flex justify-between"><span>{b.description} <span className="text-muted-foreground">(on statement, not in ledger{receiptFor(b.id)?.status === 'proposed' ? ' — receipt proposed' : b.type === 'charge' ? ' — journal proposed' : ''})</span></span><Money v={b.amount} currency={a.currency} /></div>)}
              {rec.unmatchedLedger.map((l) => <div key={l.id} className="flex justify-between"><span>{l.description} <span className="text-muted-foreground">(in ledger, not yet on statement — timing)</span></span><Money v={-l.amount} currency={a.currency} /></div>)}
              {rec.unmatchedStatement.length + rec.unmatchedLedger.length === 0 ? <div className="text-muted-foreground">Nothing open.</div> : null}
            </div>
            <div className="mt-3"><Btn tone="primary" small disabled={a.signedOff || !rec.explained || !['reem', 'noura'].includes(persona.id)} onClick={() => actions.signOffBankRec(a.id)}>{a.signedOff ? 'Signed off' : 'Sign off September'}</Btn></div>
            <ProvenanceNote>Sign-off needs the difference to equal the open items. Tasweya proposes the entries; the Accounting Manager signs.</ProvenanceNote>
          </Panel>
        }>
          <Panel title="Statement lines" action={<span className="text-[11px] text-muted-foreground">{lines.length} lines · via CogniDocs</span>}>
            <Table head={['Date', 'Description', 'Type', 'Amount', 'Matched to']} rows={lines.map((b) => { const r = receiptFor(b.id); const le = world.ledger.find((l) => l.id === b.matchedLedgerId); return [
              <span className="text-[11px]">{date(b.date)}</span>, <span className="text-[11px]">{b.description}<div className="font-mono text-[10px] text-muted-foreground">{b.rawDescription}</div></span>, <Chip tone="muted">{b.type}</Chip>, <Money v={b.amount} currency={a.currency} />,
              r ? <span className="text-[11px]"><Chip tone={r.status === 'applied' ? 'success' : r.status === 'proposed' ? 'warn' : 'danger'}>{r.status}</Chip> {r.invoiceIds.join(', ')}{r.shortfall ? ` (−${r.shortfall})` : ''}</span> : le ? <span className="text-[11px]"><Chip tone="success">ledger</Chip> {le.description}</span> : <Chip tone="danger">open</Chip>,
            ]; })} />
          </Panel>
          <Panel title="Ledger entries" action={<span className="text-[11px] text-muted-foreground">{ledger.length} entries · {ERP_LABEL[useApp().settings.erp]}</span>}>
            <Table head={['Date', 'Entry', 'Kind', 'Amount', 'Statement']} rows={ledger.map((l) => [<span className="text-[11px]">{date(l.date)}</span>, <span className="text-[11px]">{l.description}</span>, <Chip tone="muted">{l.kind}</Chip>, <Money v={l.amount} currency={a.currency} />, l.matchedBankLineId ? <Chip tone="success">matched</Chip> : <Chip tone="warn">timing</Chip>])} />
          </Panel>
        </PageColumns>
      </PageSection>
    </>
  );
}

function Budget() {
  const { world, actions, persona } = useApp();
  const m = 9;
  const rows = budgetByLine(world, m).filter((r) => r.budget || r.actual || r.forecast);
  const bm = budgetByMonth(world);
  const fy = fyTotals(world);
  const labels = bm.map((x) => monthName(x.month));
  const byClient = recognisedByClientMonth(world, m);
  const margins = marginByClient(world);
  return (
    <>
      <PageSection label={`${monthName(m)} 2026 — Budget · Target · Forecast · Actual`}>
        <StatRow>
          <StatTile label={`${monthName(m)} actual (recognised)`} value={money(bm[m - 1].actual ?? 0, 'SAR', { compact: true })} state={`budget ${money(bm[m - 1].budget, 'SAR', { compact: true })}`} trend={{ direction: (bm[m - 1].actual ?? 0) >= bm[m - 1].budget ? 'up' : 'down', label: `vs budget ${money((bm[m - 1].actual ?? 0) - bm[m - 1].budget, 'SAR', { compact: true })}`, sentiment: (bm[m - 1].actual ?? 0) >= bm[m - 1].budget ? 'good' : 'bad' }} />
          <StatTile label="YTD actual vs budget" value={money(fy.actualYtd, 'SAR', { compact: true })} state={money(fy.budgetYtd, 'SAR', { compact: true })} trend={{ direction: fy.actualYtd >= fy.budgetYtd ? 'up' : 'down', label: pct(fy.actualYtd / fy.budgetYtd - 1, 1), sentiment: fy.actualYtd >= fy.budgetYtd ? 'good' : 'bad' }} />
          <StatTile label="FY forecast" value={money(fy.forecast, 'SAR', { compact: true })} state={`budget ${money(fy.budget, 'SAR', { compact: true })}`} trend={{ direction: fy.forecast >= fy.budget ? 'up' : 'down', label: `target ${money(fy.target, 'SAR', { compact: true })}`, sentiment: fy.forecast >= fy.budget ? 'good' : 'bad' }} />
          <StatTile label="Reforecast" value={world.flags.reforecastAccepted ? 'Accepted' : 'Proposed'} state="Mizaniya" trend={{ direction: 'flat', label: world.flags.reforecastAccepted ? 'FP&A accepted' : 'awaiting FP&A', sentiment: 'neutral' }} />
        </StatRow>
      </PageSection>
      <PageSection label="By business line — variance explained by driver">
        <Panel icon={<Scale size={16} />} title={`${monthName(m)} by business line`} action={!world.flags.reforecastAccepted ? <Btn small tone="primary" disabled={persona.id !== 'noura'} onClick={() => actions.acceptReforecast()}>Accept reforecast</Btn> : <Chip tone="success">reforecast accepted</Chip>}>
          <Table head={['Business line', 'Budget', 'Target', 'Forecast', 'Actual', 'Var vs budget', 'Var vs forecast (start of month)', 'Explained', 'Unexplained']} rows={rows.map((r) => [
            <span>{BUSINESS_LINE_LABEL[r.businessLine]}</span>, <Money v={r.budget} compact />, <Money v={r.target} compact />, <Money v={r.forecast} compact />, <Money v={r.actual} compact />, <Delta v={r.varBudget} />, <Delta v={r.varForecast} />,
            <span className="font-mono tabular-nums text-muted-foreground">{money(r.drivers.reduce((s, d) => s + d.amount, 0), 'SAR', { compact: true })}</span>, <span className={`font-mono tabular-nums ${Math.abs(r.unexplained) > 5000 ? 'text-warn' : 'text-muted-foreground'}`}>{money(r.unexplained, 'SAR', { compact: true })}</span>,
          ])} />
          <div className="mt-3 space-y-2">
            {world.drivers.map((d, i) => <div key={i} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border/50 p-2 text-xs"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Chip tone={d.amount < 0 ? 'danger' : 'success'}>{d.kind}</Chip><span className="text-muted-foreground">{BUSINESS_LINE_LABEL[d.businessLine]}</span><ProvenanceChip kind={d.provenance} /></div><p className="mt-1 leading-snug">{d.explanation}</p></div><Delta v={d.amount} /></div>)}
          </div>
          <ProvenanceNote>"Unexplained" is reported, not hidden; it is rounding on the budget plus the draw of T&M days. Drivers are written in the words of the contract that caused them.</ProvenanceNote>
        </Panel>
      </PageSection>
      <PageSection label="Full year">
        <PageColumns aside={
          <Panel icon={<TrendingUp size={16} />} title="Pipeline feeding the forecast">
            {world.pipeline.map((p, i) => <div key={i} className="flex justify-between gap-2 border-b border-border/30 py-1.5 text-xs last:border-0"><span>{monthName(p.month)} · {p.label}</span><Money v={p.weighted} compact /></div>)}
            <ProvenanceNote>Weighted pipeline is read from Salesforce (simulated). The forecast is schedule + pipeline; nobody types a forecast number.</ProvenanceNote>
          </Panel>
        }>
          <Panel title="Month by month">
            <LineChart labels={labels} height={200} format={(v) => money(v, 'SAR', { compact: true }).replace('SAR ', '')} marker={{ at: 8, label: 'Sep' }} series={[{ label: 'Budget', color: SERIES[1], points: bm.map((x) => x.budget), dashed: true }, { label: 'Target', color: SERIES[4], points: bm.map((x) => x.target), dashed: true }, { label: 'Forecast', color: SERIES[0], points: bm.map((x) => x.forecast) }, { label: 'Actual', color: SERIES[2], points: bm.map((x) => x.actual ?? NaN), area: true }]} />
            <Legend className="mt-2" items={[{ label: 'Budget', color: SERIES[1], dashed: true }, { label: 'Target', color: SERIES[4], dashed: true }, { label: 'Forecast', color: SERIES[0] }, { label: 'Actual', color: SERIES[2] }]} />
          </Panel>
          <Panel title={`${monthName(m)} recognised revenue by client`}>
            <BarChart rows={Object.entries(byClient).sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ label: world.clients.find((c) => c.id === id)!.short, value: v }))} height={160} format={(v) => money(v, 'SAR', { compact: true })} />
          </Panel>
        </PageColumns>
      </PageSection>
      <PageSection label="Cost of delivery and margin (YTD)">
        <Panel title="Gross margin by client against the 23% target">
          <Table head={['Client', 'Revenue', 'Vendor cost (matched)', 'Internal delivery (illustrative)', 'Gross margin', '%', '']} rows={margins.map((x) => [x.client.short, <Money v={x.revenue} compact />, <Money v={x.vendorCost} compact />, <Money v={x.staffCost} compact />, <Money v={x.margin} compact />, <span className={`font-mono tabular-nums ${x.marginPct >= GM_TARGET ? 'text-success' : 'text-warn'}`}>{pct(x.marginPct)}</span>, <div className="min-w-[6rem]"><Meter value={Math.max(0, x.marginPct)} target={GM_TARGET} tone={x.marginPct >= GM_TARGET ? 'success' : 'warn'} /></div>])} />
          <ProvenanceNote>Vendor cost is what Mawrid matched from invoices; internal delivery cost is an illustrative ratio per business line until Tasama's time and payroll data are connected. The 23% target is the one in Tasama's own finance data model.</ProvenanceNote>
        </Panel>
      </PageSection>
    </>
  );
}

function Journals() {
  const { world, actions, persona, settings } = useApp();
  return (
    <PageSection label="Proposed and posted">
      <PageColumns aside={<Panel icon={<BookOpenCheck size={16} />} title="Posting"><KV rows={[['ERP', ERP_LABEL[settings.erp]], ['Proposed', world.journals.filter((j) => j.status === 'proposed').length], ['Posted', world.journals.filter((j) => j.status === 'posted').length], ['Approver', 'Accounting Manager (Reem) · CFO']]} /><ProvenanceNote>The unbilled accrual is computed at approval from the delivered-not-invoiced events, so it reflects what has been invoiced since it was proposed.</ProvenanceNote><div className="mt-3"><Trail entries={world.trail.filter((t) => t.recordRef?.startsWith('DEMO-JE'))} limit={6} /></div></Panel>}>
        {world.journals.map((j) => { const call = journalCall(settings.erp, j); const total = j.lines.reduce((s, l) => s + l.dr, 0); return (
          <Panel key={j.id} title={<span className="flex items-center gap-2"><DemoReference>{j.id}</DemoReference> {j.kind}</span>} action={<span className="flex items-center gap-2"><AgentMark id={j.proposedBy} size={18} /><Chip tone={j.status === 'posted' ? 'success' : 'warn'}>{j.status}{j.erpRef ? ` · ${j.erpRef}` : ''}</Chip></span>}>
            <p className="text-xs leading-snug text-muted-foreground">{j.description}</p>
            <table className="mt-2 w-full text-xs"><tbody>{j.lines.map((l, i) => <tr key={i} className="border-t border-border/30"><td className="py-1">{l.account}</td><td className="py-1 text-end font-mono tabular-nums">{l.dr ? money(l.dr).replace('SAR ', '') : ''}</td><td className="py-1 text-end font-mono tabular-nums">{l.cr ? money(l.cr).replace('SAR ', '') : ''}</td></tr>)}</tbody></table>
            {j.kind === 'Unbilled revenue accrual' && j.status === 'proposed' ? <p className="mt-1 text-[11px] text-muted-foreground">Current unbilled: {money(unbilled(world))} — this is what will post.</p> : total ? <p className="mt-1 text-[11px] text-muted-foreground">Total {money(total)}</p> : null}
            <details className="mt-2"><summary className="cursor-pointer text-[11px] text-muted-foreground">Posting preview — {call.method} {call.path}</summary><pre className="mt-1 overflow-x-auto rounded-md border border-border/50 bg-card/40 p-2 font-mono text-[10.5px] leading-snug text-muted-foreground">{JSON.stringify(call.body, null, 1)}</pre></details>
            {j.status === 'proposed' ? <div className="mt-2"><Btn small tone="primary" disabled={!['reem', 'noura'].includes(persona.id)} onClick={() => actions.approveJournal(j.id)}>Approve and post</Btn></div> : null}
          </Panel>); })}
      </PageColumns>
    </PageSection>
  );
}

export { CalendarCheck, STATUS };
