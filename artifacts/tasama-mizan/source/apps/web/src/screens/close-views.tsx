/**
 * Close — supporting views: bank reconciliation per account, Budget · Target ·
 * Forecast · Actual with variance drivers, and the journals with their ERP
 * posting previews. The checklist itself is in close.tsx.
 */
import { useEffect, useState } from 'react';
import { BookOpenCheck, Landmark, Scale, TrendingUp } from 'lucide-react';
import { PageColumns, PageContainer, PageSection, Panel, StatRow, StatTile } from '@cognirise/atelier/layout';
import { DemoReference, ProvenanceChip, ProvenanceNote } from '@cognirise/atelier/archetypes';
import { useApp } from '../app/state';
import { AgentMark, Btn, Chip, Delta, KV, Money, PersonMark, PostingPreview, Table, Trail } from '../app/bits';
import { arOpen, bankRec, budgetByLine, budgetByMonth, deferredBalance, fyTotals, marginByClient, recognisedByClientMonth, unbilled, GM_TARGET } from '@mizan/domain/derive';
import { date, money, monthName, pct, period } from '@mizan/domain/format';
import { BUSINESS_LINE_LABEL } from '@mizan/domain/types';
import { ERP_LABEL, journalCall } from '@mizan/domain/erp';
import { BarChart, LineChart, Legend, Meter, SERIES, STATUS } from '../lib/viz';

export function Bank() {
  const { world, actions, persona } = useApp();
  const [acct, setAcct] = useState(world.bankAccounts[0].id);
  const rec = bankRec(world, acct);
  const a = rec.account;
  const lines = world.bankLines.filter((b) => b.accountId === acct && b.date.startsWith(world.closingPeriod)).sort((x, y) => x.date.localeCompare(y.date));
  const ledger = world.ledger.filter((l) => l.accountId === acct && l.date.startsWith(world.closingPeriod)).sort((x, y) => x.date.localeCompare(y.date));
  const receiptFor = (id: string) => world.receipts.find((r) => r.bankLineId === id);
  return (
    <>
      <div><div className="flex flex-wrap gap-2">{world.bankAccounts.map((b) => { const r = bankRec(world, b.id); return <button key={b.id} type="button" onClick={() => setAcct(b.id)} className={`rounded-xl border px-3 py-2 text-start ${acct === b.id ? 'border-primary/50 bg-primary/10' : 'border-border/60 bg-card/40 hover:bg-card/70'}`}><div className="text-sm">{b.bank} <span className="text-muted-foreground">· {b.label}</span></div><div className="font-mono text-[11px] text-muted-foreground">{b.currency} · diff {money(r.difference, b.currency)} · {r.unmatchedStatement.length + r.unmatchedLedger.length} open · {b.signedOff ? 'signed off' : r.explained ? 'explained' : 'unexplained'}</div></button>; })}</div></div>
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

export function Budget() {
  const { world, actions, persona, focus } = useApp();
  useEffect(() => { if (focus === 'margin') setTimeout(() => document.getElementById('margin-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); }, [focus]);
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
      <div id="margin-section" className="scroll-mt-4" />
      <PageSection label={`Cost of delivery and margin — ${monthName(m)}`}>
        <Panel title={`Gross margin by client against the ${pct(GM_TARGET)} target`} action={<Chip tone={margins.estimate ? 'warn' : 'success'}>{margins.estimate ? `payroll at ${period(margins.payrollPeriod)} run-rate — September register not yet booked` : 'September payroll from the register'}</Chip>}>
          <Table head={['Client', 'Revenue', 'Vendor cost (matched, accrued)', 'Payroll (timesheet share)', 'FTE', 'Gross margin', '%', '']} rows={margins.rows.map((x) => [x.client.short, <Money v={x.revenue} compact />, <Money v={x.vendorCost} compact />, <Money v={x.staffCost} compact />, <span className="font-mono tabular-nums">{x.fte}</span>, <Money v={x.margin} compact />, <span className={`font-mono tabular-nums ${x.marginPct === null ? 'text-muted-foreground' : x.marginPct >= GM_TARGET ? 'text-success' : 'text-warn'}`}>{x.marginPct === null ? 'no revenue' : pct(x.marginPct)}</span>, <div className="min-w-[6rem]"><Meter value={Math.max(0, x.marginPct ?? 0)} target={GM_TARGET} tone={(x.marginPct ?? 0) >= GM_TARGET ? 'success' : 'warn'} /></div>])} />
          <div className="mt-2 space-y-1">{margins.rows.filter((x) => x.notes.length).map((x) => <p key={x.client.id} className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">{x.client.short}</span> — {x.notes.join('; ')}</p>)}</div>
          <ProvenanceNote>Vendor cost is what Mawrid matched from invoices dated in the month, plus the vendor accrual where the invoice has not arrived. Payroll is the delivery cost Rawatib allocated from the HR register by timesheet share; overhead stays in G&A. The 23% target is the one in Tasama's own finance data model.</ProvenanceNote>
        </Panel>
      </PageSection>
    </>
  );
}

export function Journals() {
  const { world, actions, persona, settings } = useApp();
  return (
    <PageSection label="Proposed and posted">
      <PageColumns aside={<Panel icon={<BookOpenCheck size={16} />} title="Posting"><KV rows={[['ERP', ERP_LABEL[settings.erp]], ['Proposed', world.journals.filter((j) => j.status === 'proposed').length], ['Posted', world.journals.filter((j) => j.status === 'posted').length], ['Approver', 'Accounting Manager (Reem) · CFO']]} /><ProvenanceNote>The unbilled accrual is computed at approval from the delivered-not-invoiced events, so it reflects what has been invoiced since it was proposed.</ProvenanceNote><div className="mt-3"><Trail entries={world.trail.filter((t) => t.recordRef?.startsWith('DEMO-JE'))} limit={6} /></div></Panel>}>
        {world.journals.map((j) => { const call = journalCall(settings.erp, j); const total = j.lines.reduce((s, l) => s + l.dr, 0); return (
          <Panel key={j.id} title={<span className="flex items-center gap-2"><DemoReference>{j.id}</DemoReference> {j.kind}</span>} action={<span className="flex items-center gap-2"><AgentMark id={j.proposedBy} size={18} /><Chip tone={j.status === 'posted' ? 'success' : 'warn'}>{j.status}{j.erpRef ? ` · ${j.erpRef}` : ''}</Chip></span>}>
            <p className="text-xs leading-snug text-muted-foreground">{j.description}</p>
            <table className="mt-2 w-full text-xs"><tbody>{j.lines.map((l, i) => <tr key={i} className="border-t border-border/30"><td className="py-1">{l.account}</td><td className="py-1 text-end font-mono tabular-nums">{l.dr ? money(l.dr).replace('SAR ', '') : ''}</td><td className="py-1 text-end font-mono tabular-nums">{l.cr ? money(l.cr).replace('SAR ', '') : ''}</td></tr>)}</tbody></table>
            {j.kind === 'Unbilled revenue accrual' && j.status === 'proposed' ? <p className="mt-1 text-[11px] text-muted-foreground">Current unbilled: {money(unbilled(world))} — this is what will post.</p> : total ? <p className="mt-1 text-[11px] text-muted-foreground">Total {money(total)}</p> : null}
            <div className="mt-2"><PostingPreview call={call} erp={settings.erp} compact /></div>
            {j.status === 'proposed' ? <div className="mt-2"><Btn small tone="primary" disabled={!['reem', 'noura'].includes(persona.id)} onClick={() => actions.approveJournal(j.id)}>Approve and post</Btn></div> : null}
          </Panel>); })}
      </PageColumns>
    </PageSection>
  );
}
