/**
 * Close — the aspects Tasama asked for beyond lead-to-cash: payroll as
 * Finance receives it (procedure 2), the monthly VAT return (line 25, added
 * by Cognirise), and the Day-1 pack (procedure 24). Every figure here is
 * derived in the domain; these views read.
 */
import { Banknote, FileCheck2, Receipt, Users } from 'lucide-react';
import { PageColumns, PageSection, Panel, StatRow, StatTile } from '@cognirise/atelier/layout';
import { DemoReference, ProvenanceNote } from '@cognirise/atelier/archetypes';
import { useApp } from '../app/state';
import { AgentMark, Btn, Chip, KV, Money, PostingPreview, Table, Trail, type Tone } from '../app/bits';
import { ageing, arOpen, bankRec, closeSummary, deferredBalance, marginByClient, monthlyPnl, payrollForClose, payrollRun, payrollSummary, unbilled, vatForPeriod, GM_TARGET } from '@mizan/domain/derive';
import { date, money, pct, period } from '@mizan/domain/format';
import { BUSINESS_LINE_LABEL } from '@mizan/domain/types';
import { ERP_LABEL, journalCall } from '@mizan/domain/erp';
import { BarChart, Meter } from '../lib/viz';

const RUN_LABEL: Record<string, string> = { awaited: 'awaited from HR', received: 'received · proof run', proved: 'proof signed', posted: 'booked' };
const RUN_TONE: Record<string, Tone> = { awaited: 'danger', received: 'warn', proved: 'primary', posted: 'success' };

/* ------------------------------------------------------------ payroll */

export function Payroll() {
  const { world, actions, persona, settings } = useApp();
  const ps = payrollSummary(world);
  if (!ps) return <p className="text-sm text-muted-foreground">No payroll run for {period(world.closingPeriod)}.</p>;
  const { run } = ps;
  const prior = payrollRun(world, '2026-08');
  // Until HR sends the register, Finance has last month's figures and this month's bank line — nothing else.
  const awaited = run.status === 'awaited';
  const shown = awaited && prior ? prior : run;
  const canReceive = run.status === 'awaited' && ['omar', 'reem', 'noura'].includes(persona.id);
  const canSign = run.status === 'received' && ['reem', 'noura'].includes(persona.id);
  const line = (label: string, cur: number, prev?: number): [string, React.ReactNode] => [label, <span className="font-mono tabular-nums"><Money v={cur} />{prev !== undefined ? <span className="text-muted-foreground"> · Aug {money(prev).replace('SAR ', '')}</span> : null}</span>];
  const checks = run.proof ? [
    ['Net pay = WPS payment on the bank statement', run.proof.bankTies, ps.bankLine ? `${date(ps.bankLine.date)} · ${ps.bankLine.rawDescription}` : 'no payroll line on the statement'],
    ['Net pay = GL payroll clearing', run.proof.glTies, 'ledger entry of the pay-out day'],
    ['Headcount = prior month + joiners − leavers', run.proof.headcountTies, prior ? `${prior.headcount} + ${run.joiners} − ${run.leavers} = ${run.headcount}` : ''],
  ] as const : [];
  return (
    <>
      <PageSection label={`${period(run.period)} payroll — as Finance receives it`}>
        <StatRow>
          <StatTile label="Register" value={RUN_LABEL[run.status]} state={run.receivedOn ? `received ${date(run.receivedOn)}` : `due ${date(run.dueOn)} · ${ps.late} WD late`} trend={{ direction: 'flat', label: run.status === 'awaited' ? `Iqfal reminded HR ${ps.reminders.length}×` : 'from the HR payroll system', sentiment: run.status === 'awaited' ? 'bad' : run.status === 'posted' ? 'good' : 'neutral' }} />
          <StatTile label="Headcount" value={awaited ? `${shown.headcount} (Aug)` : String(run.headcount)} state={awaited ? 'September movement unknown until the register is in' : `+${run.joiners} joiners · −${run.leavers} leavers`} />
          <StatTile label="Net pay (WPS)" value={money(ps.bankLine ? Math.abs(ps.bankLine.amount) : run.netPay, 'SAR', { compact: true })} state={awaited ? `on the SNB statement ${ps.bankLine ? date(ps.bankLine.date) : ''} — register to prove it` : `paid ${date(run.paidOn)}`} trend={{ direction: 'flat', label: run.proof ? (run.proof.bankTies ? 'ties to the bank' : 'does not tie') : 'proof pending', sentiment: run.proof ? (run.proof.bankTies ? 'good' : 'bad') : 'neutral' }} />
          <StatTile label="Employer cost" value={`${money(shown.employerCost, 'SAR', { compact: true })}${awaited ? ' (Aug)' : ''}`} state={awaited ? 'August run-rate carried until September is booked' : `delivery ${money(ps.delivery, 'SAR', { compact: true })} · G&A ${money(ps.overhead, 'SAR', { compact: true })}`} />
        </StatRow>
      </PageSection>
      <PageSection label="The register, the proof, the journals">
        <PageColumns aside={
          <Panel icon={<FileCheck2 size={16} />} title="Rawatib's proof" action={<Chip tone={RUN_TONE[run.status]}>{RUN_LABEL[run.status]}</Chip>}>
            {run.proof ? (
              <div className="space-y-2 text-xs">
                {checks.map(([label, ok, detail]) => <div key={label} className="flex items-start gap-2"><span className={ok ? 'text-success' : 'text-danger'}>{ok ? '✓' : '✗'}</span><div><div>{label}</div><div className="text-[11px] text-muted-foreground">{detail}</div></div></div>)}
                <p className="text-[11px] text-muted-foreground">{run.proof.note}</p>
              </div>
            ) : <p className="text-xs text-muted-foreground">The proof runs the moment the register is read: net pay against the WPS batch Tasweya matched on the SNB statement ({ps.bankLine ? money(Math.abs(ps.bankLine.amount)) : '—'}, {ps.bankLine ? date(ps.bankLine.date) : ''}), against the GL, and the headcount against last month's.</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {run.status === 'awaited' ? <Btn small tone="primary" disabled={!canReceive} onClick={() => void actions.receivePayrollRegister()}>Read the register from HR</Btn> : null}
              {run.status === 'received' ? <Btn small tone="primary" disabled={!canSign} onClick={() => void actions.approvePayroll(run.id)}>Sign the proof</Btn> : null}
            </div>
            <KV rows={awaited ? [['Source', run.source], ['WPS batch', <span className="font-mono text-[11px]">{run.wpsBatchRef}</span>], ['Due', `${date(run.dueOn)} — 3 WD after pay-out`], ['Reminders', ps.reminders.map(date).join(', ') || '—']] : [['Source', run.source], ['WPS batch', <span className="font-mono text-[11px]">{run.wpsBatchRef}</span>], ['GOSI payable', `${money(ps.gosiTotal)} · due ${date(run.gosiDueOn)}`], ['Final settlements', `${money(run.finalSettlements)} · ${run.leavers} leaver(s), included in gross`]]} />
            <ProvenanceNote>Mizan holds totals by cost centre — no employee, salary or IBAN enters the platform. HR runs payroll in its own system; Finance receives, proves and books the output. That is Tasama's procedure 2 as written.</ProvenanceNote>
          </Panel>
        }>
          <Panel icon={<Banknote size={16} />} title={awaited ? 'Register totals — August (last received)' : 'Register totals'} action={<span className="text-[11px] text-muted-foreground">{awaited ? 'September not yet received' : 'September against August'}</span>}>
            {awaited ? <p className="mb-2 text-xs text-muted-foreground">September's register has not reached Finance. What is known: the WPS payment of {ps.bankLine ? money(Math.abs(ps.bankLine.amount)) : '—'} on the SNB statement. The totals below are August's, carried as the run-rate for the margin and the P&L until the register is proven.</p> : null}
            <KV rows={awaited ? [
              line('Basic salaries', shown.basic), line('Allowances (housing, transport)', shown.allowances), line('Overtime', shown.overtime), line('Gross pay', shown.grossPay),
              line('GOSI — employee share', -shown.gosiEmployee), line('Other deductions (loans, absence)', -shown.otherDeductions), line('Net pay (WPS)', shown.netPay),
              line('GOSI — employer share', shown.gosiEmployer), line('End-of-service provision', shown.eosbProvision), line('Leave provision', shown.leaveProvision), line('Bonus accrual', shown.bonusAccrual), line('Employer cost', shown.employerCost),
            ] : [
              line('Basic salaries', run.basic, prior?.basic), line('Allowances (housing, transport)', run.allowances, prior?.allowances), line('Overtime', run.overtime, prior?.overtime), line('Gross pay', run.grossPay, prior?.grossPay),
              line('GOSI — employee share', -run.gosiEmployee, prior ? -prior.gosiEmployee : undefined), line('Other deductions (loans, absence)', -run.otherDeductions, prior ? -prior.otherDeductions : undefined), line('Net pay (WPS)', run.netPay, prior?.netPay),
              line('GOSI — employer share', run.gosiEmployer, prior?.gosiEmployer), line('End-of-service provision', run.eosbProvision, prior?.eosbProvision), line('Leave provision', run.leaveProvision, prior?.leaveProvision), line('Bonus accrual', run.bonusAccrual, prior?.bonusAccrual), line('Employer cost', run.employerCost, prior?.employerCost),
            ]} />
          </Panel>
          <Panel icon={<Users size={16} />} title={awaited ? 'Cost by cost centre and engagement — August' : 'Cost by cost centre and engagement'} action={<span className="text-[11px] text-muted-foreground">timesheet share · {shown.allocations.filter((a) => a.clientId).length} engagements</span>}>
            <Table head={['Cost centre', 'Business line', 'Engagement', 'FTE', 'Employer cost', '']} rows={shown.allocations.map((a) => [
              <span className="font-mono text-[11px]">{a.costCentre}</span>, <span className="text-[11px]">{a.businessLine === 'G&A' ? 'G&A — overhead' : BUSINESS_LINE_LABEL[a.businessLine]}</span>, a.clientId ? world.clients.find((c) => c.id === a.clientId)?.short : <span className="text-muted-foreground">not allocated</span>, <span className="font-mono tabular-nums">{a.fte}</span>, <Money v={a.cost} />, <span className="text-[11px] text-muted-foreground">{a.note ?? ''}</span>,
            ])} />
          </Panel>
          {ps.journals.length ? ps.journals.map((j) => (
            <Panel key={j.id} title={<span className="flex items-center gap-2"><DemoReference>{j.id}</DemoReference> {j.kind}</span>} action={<span className="flex items-center gap-2"><AgentMark id={j.proposedBy} size={18} /><Chip tone={j.status === 'posted' ? 'success' : 'warn'}>{j.status}{j.erpRef ? ` · ${j.erpRef}` : ''}</Chip></span>}>
              <p className="text-xs leading-snug text-muted-foreground">{j.description}</p>
              <table className="mt-2 w-full text-xs"><tbody>{j.lines.map((l, i) => <tr key={i} className="border-t border-border/30"><td className="py-1">{l.account}</td><td className="py-1 text-end font-mono tabular-nums">{l.dr ? money(l.dr).replace('SAR ', '') : ''}</td><td className="py-1 text-end font-mono tabular-nums">{l.cr ? money(l.cr).replace('SAR ', '') : ''}</td></tr>)}</tbody></table>
              <div className="mt-2"><PostingPreview call={journalCall(settings.erp, j)} erp={settings.erp} compact /></div>
              {j.status === 'proposed' ? <div className="mt-2"><Btn small tone="primary" disabled={run.status !== 'proved' || !['reem', 'noura'].includes(persona.id)} onClick={() => void actions.approveJournal(j.id)}>{run.status === 'proved' ? 'Approve and post' : 'Sign the proof first'}</Btn></div> : null}
            </Panel>
          )) : null}
          <div><Trail entries={world.trail.filter((t) => t.recordRef === run.id)} limit={8} /></div>
        </PageColumns>
      </PageSection>
    </>
  );
}

/* ---------------------------------------------------------------- VAT */

const VAT_LABEL: Record<string, string> = { open: 'open — live from the ledger', prepared: 'prepared — figures frozen', approved: 'approved — ready to file', filed: 'filed' };
const VAT_TONE: Record<string, Tone> = { open: 'muted', prepared: 'warn', approved: 'success', filed: 'success' };

export function Vat() {
  const { world, actions, persona, settings } = useApp();
  const v = vatForPeriod(world);
  const f = v.figures; const ret = v.ret;
  const prior = world.vatReturns.find((x) => x.period === '2026-08');
  const journal = ret?.journalId ? world.journals.find((j) => j.id === ret.journalId) : undefined;
  const sales = world.invoices.filter((i) => i.date.startsWith(world.closingPeriod) && !i.creditNoteOf);
  const purchases = world.vendorInvoices.filter((x) => x.issueDate.startsWith(world.closingPeriod));
  const canPrepare = v.canPrepare && ['reem', 'omar', 'noura'].includes(persona.id);
  const canApprove = ret?.status === 'prepared' && persona.id === 'noura';
  return (
    <>
      <PageSection label={`VAT return — ${period(world.closingPeriod)} · ZATCA monthly filing, due ${ret ? date(ret.filingDueOn) : '—'}`}>
        <StatRow>
          <StatTile label="Return" value={ret ? ret.status.replace('_', ' ') : '—'} state={ret ? VAT_LABEL[ret.status] : ''} trend={{ direction: 'flat', label: v.rejected.length ? `${v.rejected.length} invoice(s) rejected by ZATCA` : 'every invoice of the month cleared', sentiment: v.rejected.length ? 'bad' : 'good' }} />
          <StatTile label="Output VAT" value={money(f.outputVat, 'SAR', { compact: true })} state={`${f.salesCount} cleared invoice(s) · sales ${money(f.standardRatedSales, 'SAR', { compact: true })}`} />
          <StatTile label="Input VAT" value={money(f.inputVat, 'SAR', { compact: true })} state={`${f.purchaseCount} posted vendor invoice(s)${f.deferredInputVat ? ` · ${money(f.deferredInputVat, 'SAR', { compact: true })} not claimable yet` : ''}`} trend={f.deferredInputVat ? { direction: 'down', label: 'held back', sentiment: 'bad' } : undefined} />
          <StatTile label="Net payable to ZATCA" value={money(f.netPayable, 'SAR', { compact: true })} state={prior?.figures ? `Aug ${money(prior.figures.netPayable, 'SAR', { compact: true })} paid 28 Sep` : ''} />
        </StatRow>
      </PageSection>
      <PageSection label="The return and what stands behind each box">
        <PageColumns aside={
          <Panel icon={<Receipt size={16} />} title="Return" action={ret ? <Chip tone={VAT_TONE[ret.status]}>{ret.status}</Chip> : null}>
            <KV rows={[
              ['Box 1 · Standard-rated sales (15%)', <span className="font-mono tabular-nums"><Money v={f.standardRatedSales} /> → VAT <Money v={f.outputVat} /></span>],
              ['Box 2 · Zero-rated / exports', <Money v={f.zeroRatedSales} />],
              ['Box 7 · Standard-rated purchases', <span className="font-mono tabular-nums"><Money v={f.standardRatedPurchases} /> → VAT <Money v={f.inputVat} /></span>],
              ['Adjustments', <Money v={f.adjustments} />],
              ['Net VAT payable', <span className="font-mono text-base tabular-nums"><Money v={f.netPayable} /></span>],
            ]} />
            {f.deferredInputVat ? <p className="mt-2 text-[11px] text-warn">Not claimable this period: {f.deferredNote}. Claim it in the period the invoice is approved and posted.</p> : null}
            {f.excluded.length ? <div className="mt-2 text-[11px] text-danger">Excluded: {f.excluded.map((x) => `${x.ref} — ${x.reason}`).join('; ')}</div> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {ret?.status === 'open' ? <Btn small tone="primary" disabled={!canPrepare} onClick={() => void actions.prepareVatReturn()}>{v.rejected.length ? 'Clear the rejection first' : 'Prepare the return'}</Btn> : null}
              {ret?.status === 'prepared' ? <Btn small tone="primary" disabled={!canApprove} onClick={() => void actions.approveVatReturn(ret.id)}>Approve for filing (CFO)</Btn> : null}
              {ret?.status === 'approved' ? <Chip tone="success">file on the ZATCA portal and pay by SADAD by {date(ret.filingDueOn)}</Chip> : null}
            </div>
            <ProvenanceNote>Output VAT counts only invoices ZATCA cleared; input VAT only vendor invoices posted to AP. Filing and payment happen on the ZATCA portal and SADAD — outside Mizan; the payment lands on the next bank statement for Tasweya to match. This line is not in Tasama's list of 24; Cognirise added it.</ProvenanceNote>
          </Panel>
        }>
          <Panel title="Sales — tax invoices dated in the period" action={<span className="text-[11px] text-muted-foreground">{sales.length} invoices · {ERP_LABEL[settings.erp]} ↔ ZATCA</span>}>
            <Table head={['Invoice', 'Client', 'Date', 'Net', 'VAT', 'ZATCA']} rows={sales.map((i) => [<DemoReference>{i.id}</DemoReference>, world.clients.find((c) => c.id === i.clientId)?.short, <span className="text-[11px]">{date(i.date)}</span>, <Money v={i.net} currency={i.currency} />, <Money v={i.vat} currency={i.currency} />, <Chip tone={i.zatca === 'cleared' ? 'success' : i.zatca === 'rejected' ? 'danger' : 'muted'}>{i.zatca}{ret?.figures && i.zatca === 'cleared' && !f.salesRefs.includes(i.id) ? ' · after the return' : ''}</Chip>])} />
          </Panel>
          <Panel title="Purchases — vendor invoices dated in the period" action={<span className="text-[11px] text-muted-foreground">{purchases.length} invoice(s)</span>}>
            <Table head={['Vendor', 'Reference', 'Date', 'Net', 'VAT', 'In the return?']} rows={purchases.map((x) => [x.vendorName, <span className="font-mono text-[11px]">{x.invoiceRef}</span>, <span className="text-[11px]">{date(x.issueDate)}</span>, <Money v={x.net} />, <Money v={x.vat} />, f.purchaseRefs.includes(x.id) ? <Chip tone="success">posted — claimed</Chip> : x.matchStatus === 'matched' ? <Chip tone="warn">posted after the return — claim next period</Chip> : x.matchStatus === 'rejected' ? <Chip tone="muted">returned to vendor — no input VAT</Chip> : <Chip tone="warn">{x.matchStatus === 'no_po' ? 'no PO — not claimable yet' : 'match pending'}</Chip>])} />
            {!purchases.length ? <p className="text-xs text-muted-foreground">No vendor invoice dated in the period yet.</p> : null}
          </Panel>
          {journal ? <Panel title={<span className="flex items-center gap-2"><DemoReference>{journal.id}</DemoReference> {journal.kind}</span>} action={<Chip tone="success">{journal.status}{journal.erpRef ? ` · ${journal.erpRef}` : ''}</Chip>}>
            <table className="w-full text-xs"><tbody>{journal.lines.map((l, i) => <tr key={i} className="border-t border-border/30"><td className="py-1">{l.account}</td><td className="py-1 text-end font-mono tabular-nums">{l.dr ? money(l.dr).replace('SAR ', '') : ''}</td><td className="py-1 text-end font-mono tabular-nums">{l.cr ? money(l.cr).replace('SAR ', '') : ''}</td></tr>)}</tbody></table>
            <div className="mt-2"><PostingPreview call={journalCall(settings.erp, journal)} erp={settings.erp} compact /></div>
          </Panel> : null}
          <div><Trail entries={world.trail.filter((t) => ret && t.recordRef === ret.id)} limit={6} /></div>
        </PageColumns>
      </PageSection>
    </>
  );
}

/* ------------------------------------------------------------ reports */

export function Reports() {
  const { world } = useApp();
  const closed = world.flags.periodClosed;
  const pnl = monthlyPnl(world);
  const m = marginByClient(world);
  const s = closeSummary(world);
  const pay = payrollForClose(world);
  const age = ageing(world);
  const recs = world.bankAccounts.map((a) => bankRec(world, a.id));
  const cash = recs.reduce((x, r) => x + (r.account.currency === 'USD' ? r.ledgerBalance * 3.75 : r.ledgerBalance), 0);
  const apOpen = world.vendorInvoices.filter((v) => v.matchStatus === 'matched' && v.dueDate >= world.asOf).reduce((x, v) => x + v.total, 0);
  // Accrued liabilities (2100), deductions payable (2130) and the provisions (25xx). Payroll clearing (2110) is settled by the WPS payment; GOSI (2120) is shown on its own line.
  const accrued = world.journals.filter((j) => j.period === world.closingPeriod && j.status === 'posted').flatMap((j) => j.lines).filter((l) => /^(2100|2130|25)/.test(l.account)).reduce((x, l) => x + l.cr - l.dr, 0);
  const vat = world.vatReturns.find((v) => v.period === world.closingPeriod);
  const gosi = pay && !pay.estimate ? pay.run.gosiEmployee + pay.run.gosiEmployer : 0;
  const row = (label: string, v: number, bold = false): [React.ReactNode, React.ReactNode] => [<span className={bold ? 'font-semibold' : ''}>{label}</span>, <span className={`font-mono tabular-nums ${bold ? 'font-semibold' : ''}`}>{money(v)}</span>];
  return (
    <>
      <PageSection label={closed ? `Day-1 pack — ${period(world.closingPeriod)} · issued` : `Day-1 pack — ${period(world.closingPeriod)} · draft, period open`}>
        <StatRow>
          <StatTile label="Revenue recognised" value={money(pnl.revenue, 'SAR', { compact: true })} state={`${pnl.byLine.length} business lines`} />
          <StatTile label="Gross margin" value={pct(pnl.grossMarginPct, 1)} state={`${money(pnl.grossMargin, 'SAR', { compact: true })} · target ${pct(GM_TARGET)}`} trend={{ direction: pnl.grossMarginPct >= GM_TARGET ? 'up' : 'down', label: pnl.payrollEstimate ? 'payroll at August run-rate' : 'September payroll in', sentiment: pnl.grossMarginPct >= GM_TARGET ? 'good' : 'bad' }} />
          <StatTile label="Operating result" value={money(pnl.operating, 'SAR', { compact: true })} state={pnl.depreciationRun ? 'after depreciation and lease interest' : 'before depreciation (ERP job not yet run)'} />
          <StatTile label="Procedures" value={`${s.items.filter((i) => i.number <= 24 && i.status === 'done').length} / ${s.tasama}`} state={closed ? 'period closed' : `${s.blocked} blocked`} trend={{ direction: 'flat', label: closed ? 'issued by Iqfal' : 'issues when P23 closes', sentiment: closed ? 'good' : 'neutral' }} />
        </StatRow>
      </PageSection>
      <PageSection label="Profit and loss, balance sheet, cash">
        <PageColumns aside={
          <Panel title="Balance sheet — the close's own lines">
            <KV rows={[row('Cash at bank (ledger)', cash), row('Trade receivables', arOpen(world)), row('Unbilled receivables (contract asset)', unbilled(world)), row('Deferred revenue (contract liability)', -deferredBalance(world)), row('Trade payables (open, matched)', -apOpen), row('Accrued liabilities and provisions', -accrued), row('GOSI payable', -gosi), row('VAT payable to ZATCA', -(vat?.figures?.netPayable ?? 0))]} />
            <ProvenanceNote>Same figures as the Bank, Collections, Journals, Payroll and VAT tabs — the pack is not re-keyed. Fixed Assets and Leases carry the ERP job results read back (procedures 12–16).</ProvenanceNote>
          </Panel>
        }>
          <Panel title={`${period(world.closingPeriod)} P&L`} action={<span className="text-[11px] text-muted-foreground">{pnl.payrollEstimate ? 'payroll: August run-rate until the register is booked' : 'payroll: September register'}</span>}>
            <KV rows={[
              row('Revenue recognised', pnl.revenue, true),
              row('Vendor cost of delivery (matched and accrued)', -pnl.vendor), row('Staff cost of delivery (payroll, timesheet share)', -pnl.delivery),
              row('Gross margin', pnl.grossMargin, true),
              row('G&A staff cost', -pnl.overhead), row('Bank charges', -pnl.bankCharges), row('FX differences', pnl.fx), row('Depreciation and amortisation (ERP)', -pnl.depreciation), row('Lease interest (ERP)', -pnl.leaseInterest),
              row('Operating result', pnl.operating, true),
            ]} />
            <div className="mt-3"><BarChart rows={pnl.byLine.sort((a, b) => b.revenue - a.revenue).map((x) => ({ label: BUSINESS_LINE_LABEL[x.businessLine].split(' · ')[1] ?? x.businessLine, value: x.revenue }))} height={150} format={(v) => money(v, 'SAR', { compact: true })} /></div>
          </Panel>
          <Panel title="Cash and receivables">
            <Table head={['Account', 'Ledger balance', 'Statement', 'Difference', 'Signed']} rows={recs.map((r) => [`${r.account.bank} · ${r.account.label}`, <Money v={r.ledgerBalance} currency={r.account.currency} />, <Money v={r.statementBalance} currency={r.account.currency} />, <Money v={r.difference} currency={r.account.currency} />, <Chip tone={r.account.signedOff ? 'success' : 'warn'}>{r.account.signedOff ? 'signed' : 'open'}</Chip>])} />
            <div className="mt-3"><Table head={['AR ageing', 'Current', '1–30', '31–60', '61–90', '90+']} rows={[['Open receivables', <Money v={age.Current} compact />, <Money v={age['1–30']} compact />, <Money v={age['31–60']} compact />, <Money v={age['61–90']} compact />, <Money v={age['90+']} compact />]]} /></div>
          </Panel>
        </PageColumns>
      </PageSection>
      <PageSection label="Margin by client and headcount">
        <Panel title={`Gross margin by client — ${period(world.closingPeriod)} against the ${pct(GM_TARGET)} target`}>
          <Table head={['Client', 'Revenue', 'Vendor cost', 'Payroll (FTE)', 'Gross margin', '%', '']} rows={m.rows.map((x) => [x.client.short, <Money v={x.revenue} compact />, <Money v={x.vendorCost} compact />, <span className="font-mono tabular-nums"><Money v={x.staffCost} compact /> <span className="text-muted-foreground">({x.fte})</span></span>, <Money v={x.margin} compact />, <span className={`font-mono tabular-nums ${x.marginPct === null ? 'text-muted-foreground' : x.marginPct >= GM_TARGET ? 'text-success' : 'text-warn'}`}>{x.marginPct === null ? 'no revenue' : pct(x.marginPct)}</span>, <div className="min-w-[6rem]"><Meter value={Math.max(0, x.marginPct ?? 0)} target={GM_TARGET} tone={(x.marginPct ?? 0) >= GM_TARGET ? 'success' : 'warn'} /></div>])} />
        </Panel>
        {pay ? <Panel title={`Headcount and cost by cost centre — ${period(pay.run.period)}${pay.estimate ? ' (run-rate; September register not yet booked)' : ''}`}>
          <Table head={['Cost centre', 'FTE', 'Employer cost', 'Share']} rows={Object.values(pay.run.allocations.reduce((acc, a) => { const r = (acc[a.costCentre] ??= { cc: a.costCentre, fte: 0, cost: 0 }); r.fte += a.fte; r.cost += a.cost; return acc; }, {} as Record<string, { cc: string; fte: number; cost: number }>)).map((r) => [<span className="font-mono text-[11px]">{r.cc}</span>, <span className="font-mono tabular-nums">{r.fte}</span>, <Money v={r.cost} />, <span className="font-mono tabular-nums text-muted-foreground">{pct(r.cost / pay.run.employerCost, 1)}</span>])} />
        </Panel> : null}
      </PageSection>
    </>
  );
}
