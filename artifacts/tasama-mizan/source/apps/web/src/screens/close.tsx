/**
 * Close — Tasama's own 24 closing procedures (plus the VAT line Cognirise
 * added), with their status read from the data by Iqfal; then the views the
 * procedures point at: bank reconciliation, payroll, VAT, Budget · Target ·
 * Forecast · Actual, journals, and the Day-1 pack.
 */
import { useEffect } from 'react';
import { CalendarCheck, Landmark, Receipt } from 'lucide-react';
import { PageContainer, PageMasthead, PageSection, Panel, StatRow, StatTile } from '@cognirise/atelier/layout';
import { ProvenanceNote } from '@cognirise/atelier/archetypes';
import { useApp } from '../app/state';
import { Body, AgentMark, Btn, Chip, PersonMark, Tabs, type Tone } from '../app/bits';
import { arOpen, closeSummary, deferredBalance, unbilled, workingDaysBetween } from '@mizan/domain/derive';
import { date, money, period } from '@mizan/domain/format';
import type { CloseItem } from '@mizan/domain/types';
import { Bank, Budget, Journals } from './close-views';
import { Payroll, Vat, Reports } from './close-finance';

const STATUS_LABEL: Record<CloseItem['status'], string> = { done: 'done', in_progress: 'in progress', blocked: 'blocked', not_started: 'not started', external: 'ERP job · outside Mizan' };
const STATUS_TONE: Record<CloseItem['status'], Tone> = { done: 'success', in_progress: 'primary', blocked: 'danger', not_started: 'muted', external: 'muted' };
const COVERAGE_LABEL: Record<CloseItem['coverage'], string> = { derived: 'derived from the data', input: 'department input', 'erp-job': 'ERP job, read back', outside: 'outside Mizan' };

export function CloseScreen() {
  const { world } = useApp();
  const s = closeSummary(world);
  return (
    <>
      <PageMasthead title={`${period(world.closingPeriod)} close`} meta={`Day ${world.closeDay} of 10 · ${s.items.filter((i) => i.number <= 24 && i.status === 'done').length} of ${s.tasama} procedures done · ${s.blocked} blocked · VAT return ${s.items.find((i) => i.number === 25)?.status.replace('_', ' ') ?? '—'}`}
        figures={<><Chip tone={s.inputsDone ? 'success' : 'warn'}>inputs 1–5 {s.inputsDone ? 'complete' : 'open'}</Chip><Chip tone={s.blocked ? 'danger' : 'muted'}>{s.blocked} blocked</Chip><Chip tone={world.flags.periodClosed ? 'success' : 'muted'}>{world.flags.periodClosed ? 'period closed' : 'period open'}</Chip></>} />

      <Body>
        <Tabs storageKey="close" tabs={[
        { id: 'checklist', label: 'Checklist', body: () => <Checklist /> },
        { id: 'bank', label: 'Bank', body: () => <Bank /> },
        { id: 'payroll', label: 'Payroll', body: () => <Payroll /> },
        { id: 'vat', label: 'VAT return', body: () => <Vat /> },
        { id: 'budget', label: 'Budget vs actual', body: () => <Budget /> },
        { id: 'journals', label: 'Journals', body: () => <Journals /> },
        { id: 'reports', label: 'Reports', body: () => <Reports /> },
      ]} />
      </Body>
    </>
  );
}

/** Tasama's 24 procedures in their own order and numbering — inputs first, then Finance — and the VAT line Cognirise added. */
function Checklist() {
  const { world, actions, persona, go, highlight, focus } = useApp();
  useEffect(() => { if (focus && /^P\d\d$/.test(focus)) setTimeout(() => document.getElementById(`proc-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150); }, [focus]);
  const s = closeSummary(world);
  const groups: { id: CloseItem['group']; label: string; note: string }[] = [
    { id: 'inputs', label: 'Departmental inputs (1–5) — before Finance starts', note: 'HR, Requesters, Operations and D&T owe the close their inputs; Iqfal issues the calendar on the 25th and chases what is late. Payroll arrives as totals by cost centre and is proven by Rawatib before it is booked. Procedures 4 and 5 are read from the delivery schedule Shahid builds — the departments do not retype what the systems already know.' },
    { id: 'finance', label: 'Finance (6–24) — 2 working days after the inputs', note: 'Each line is Tasama\'s own procedure. Mizan derives the status where it holds the data and reads the ERP accounting jobs back — Fixed Assets and Leases run in the ERP, and show here with their job result and the sub-ledger tie, never as a tick.' },
    { id: 'added', label: 'Added by Cognirise — not in Tasama\'s list', note: 'A KSA VAT-registered business files monthly on the ZATCA portal by the last day of the following month. The return is built from the same ledger: output VAT on cleared invoices, input VAT on posted vendor invoices. It does not block the ERP close.' },
  ];
  const openJobs = world.erpJobs.filter((j) => j.period === world.closingPeriod && j.status !== 'completed').length;
  const link = (i: CloseItem) => {
    switch (i.derivedFrom) {
      case 'payroll': return { label: 'Payroll', run: () => go('close', undefined, 'payroll') };
      case 'erp_job': return { label: 'ERP job', run: () => go('close', undefined, 'checklist') };
      case 'vat': return { label: 'VAT return', run: () => go('close', undefined, 'vat') };
      case 'reports': return { label: 'Reports', run: () => go('close', undefined, 'reports') };
      case 'billing': case 'delivery_ops': case 'delivery_dt': case 'erp_ar': return { label: 'Billing', run: () => go('l2c', undefined, 'billing') };
      case 'bank': case 'cash_applied': return { label: 'Bank', run: () => go('close', undefined, 'bank') };
      case 'ar_tie': return { label: 'Collections', run: () => go('l2c', undefined, 'collections') };
      case 'vendor_coc': case 'vendor_ap': case 'erp_ap': return { label: 'Inbox', run: () => go('inbox') };
      case 'journal_vendor': case 'journal_manual': case 'journal_unbilled': case 'journal_deferred': return { label: 'Journals', run: () => go('close', undefined, 'journals') };
      case 'budget': return { label: 'Budget', run: () => go('close', undefined, 'budget') };
      default: return null;
    }
  };
  return (
    <>
      <PageSection label="Where the close stands">
        <StatRow>
          <StatTile label="Procedures done" value={`${s.items.filter((i) => i.number <= 24 && i.status === 'done').length} / ${s.tasama}`} state={s.inputsDone ? 'inputs complete' : 'inputs 1–5 open'} />
          <StatTile label="Blocked" value={String(s.blocked)} state={s.blocked ? s.items.filter((i) => i.status === 'blocked').map((i) => `P${i.number}`).join(', ') : 'none'} trend={{ direction: s.blocked ? 'down' : 'flat', label: s.blocked ? 'named below, each with an owner' : 'clear', sentiment: s.blocked ? 'bad' : 'good' }} />
          <StatTile label="Unbilled to accrue" value={money(unbilled(world), 'SAR', { compact: true })} state="P19 · P20" />
          <StatTile label="AR sub-ledger" value={money(arOpen(world), 'SAR', { compact: true })} state={`deferred ${money(deferredBalance(world), 'SAR', { compact: true })}`} />
        </StatRow>
      </PageSection>
      {groups.map((g) => {
        const items = s.items.filter((i) => i.group === g.id);
        const doneCount = items.filter((i) => i.status === 'done').length;
        const countable = items.filter((i) => i.status !== 'external').length;
        return (
          <PageSection key={g.id} label={g.label}>
            <Panel icon={g.id === 'inputs' ? <CalendarCheck size={16} /> : g.id === 'added' ? <Receipt size={16} /> : <Landmark size={16} />} title={<span className="flex items-center gap-2">{g.id === 'inputs' ? 'Inputs' : g.id === 'added' ? 'Tax' : 'Finance'}<Chip tone={doneCount === countable ? 'success' : items.some((i) => i.status === 'blocked') ? 'danger' : 'primary'}>{doneCount}/{countable}</Chip></span>}
              action={<span className="text-[11px] text-muted-foreground">Tasama's deadline · their automation today · Mizan</span>}>
              <ol className="divide-y divide-border/30">
                {items.map((i) => {
                  const l = link(i);
                  const hot = highlight.has(i.id) || focus === i.id;
                  const canTick = !i.derivedFrom && i.status !== 'done' && i.status !== 'external' && (i.owner === persona.id || persona.id === 'noura');
                  return (
                    <li key={i.id} id={`proc-${i.id}`} className={`grid gap-x-4 gap-y-1 py-2.5 md:grid-cols-[2.5rem_1fr_auto] ${hot ? 'rounded-lg bg-primary/8 ring-1 ring-primary/30' : ''}`}>
                      <div className="font-mono text-xs text-muted-foreground">P{i.number}</div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip tone={STATUS_TONE[i.status]}>{STATUS_LABEL[i.status]}</Chip>
                          <span className={`text-sm ${i.status === 'external' ? 'text-muted-foreground' : ''}`}>{i.title}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>{i.workstream}</span>
                          <span>· due {i.deadline}</span>
                          <span>· ERP today: {i.tasamaAutomation === 'Not in list' ? 'not in Tasama\'s list' : i.tasamaAutomation.toLowerCase()}</span>
                          <span>· Mizan: {COVERAGE_LABEL[i.coverage]}</span>
                          <PersonMark id={i.owner} />
                          {i.agentId ? <AgentMark id={i.agentId} size={18} /> : null}
                        </div>
                        {i.blocker ? <div className="mt-1 text-xs text-warn">Blocker: {i.blocker}</div> : null}
                        {i.evidence ? <div className="mt-1 text-xs text-muted-foreground">{i.evidence}</div> : null}
                      </div>
                      <div className="flex shrink-0 items-start gap-2">
                        {l && i.derivedFrom !== 'erp_job' ? <Btn small onClick={l.run}>{l.label}</Btn> : null}
                        {i.derivedFrom === 'erp_job' && i.number === 14 && openJobs ? <Btn small tone="primary" disabled={!['omar', 'reem', 'noura'].includes(persona.id)} onClick={() => void actions.readBackErpJobs()}>Read back from the ERP</Btn> : null}
                        {canTick ? <Btn small tone="primary" onClick={() => void actions.completeCloseItem(i.id)}>Record complete</Btn> : null}
                        {i.number === 23 && i.status !== 'done' ? <Btn small tone="primary" disabled={persona.id !== 'noura' || !s.readyToClose} onClick={() => void actions.closePeriod()}>{s.readyToClose ? 'Close the period' : 'Close blocked'}</Btn> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
              {g.id === 'inputs' ? (
                <div className="mt-3 rounded-md border border-border/50 p-2">
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">What each department owes the close — Iqfal's tracker (P1)</div>
                  <table className="w-full text-xs"><thead><tr className="font-mono text-[10px] uppercase text-muted-foreground"><th className="py-1 text-start font-normal">Department</th><th className="py-1 text-start font-normal">Input</th><th className="py-1 text-start font-normal">Via</th><th className="py-1 text-start font-normal">Due</th><th className="py-1 text-start font-normal">Received</th><th className="py-1 text-start font-normal">Reminders</th></tr></thead>
                    <tbody>{world.inputs.map((d) => <tr key={d.id} className="border-t border-border/30 align-top"><td className="py-1"><PersonMark id={d.department} /></td><td className="py-1">{d.what}{d.note ? <div className="text-[11px] text-muted-foreground">{d.note}</div> : null}</td><td className="py-1 text-[11px] text-muted-foreground">{d.via}</td><td className="py-1 whitespace-nowrap">{date(d.dueOn)}</td><td className="py-1 whitespace-nowrap">{d.receivedOn ? <Chip tone="success">{date(d.receivedOn)}</Chip> : <Chip tone="danger">{workingDaysBetween(d.dueOn, world.asOf)} WD late</Chip>}</td><td className="py-1 text-[11px]">{d.reminders.length ? d.reminders.map(date).join(', ') : '—'}</td></tr>)}</tbody></table>
                </div>
              ) : null}
              <ProvenanceNote>{g.note}</ProvenanceNote>
            </Panel>
          </PageSection>
        );
      })}
      <div><p className="text-[11px] text-muted-foreground">Procedures 1–24, their departments, deadlines and today's automation column are Tasama's own "Monthly Closing Procedures"; line 25 was added by Cognirise. Statuses are derived by Iqfal from the ledger, the schedule, the register, the reconciliations and the ERP job results; nobody ticks a box.</p></div>
    </>
  );
}
