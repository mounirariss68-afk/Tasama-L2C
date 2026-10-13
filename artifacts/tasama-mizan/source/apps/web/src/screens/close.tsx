/**
 * Close — Tasama's own 24 closing procedures, with their status read from
 * the data by Iqfal; then the three views the procedures point at: bank
 * reconciliation, Budget · Target · Forecast · Actual, journals.
 */
import { CalendarCheck, Landmark } from 'lucide-react';
import { PageContainer, PageMasthead, PageSection, Panel, StatRow, StatTile } from '@cognirise/atelier/layout';
import { ProvenanceNote } from '@cognirise/atelier/archetypes';
import { useApp } from '../app/state';
import { Body, AgentMark, Btn, Chip, PersonMark, Tabs, type Tone } from '../app/bits';
import { arOpen, closeSummary, deferredBalance, unbilled } from '@mizan/domain/derive';
import { money, period } from '@mizan/domain/format';
import type { CloseItem } from '@mizan/domain/types';
import { Bank, Budget, Journals } from './close-views';

const STATUS_LABEL: Record<CloseItem['status'], string> = { done: 'done', in_progress: 'in progress', blocked: 'blocked', not_started: 'not started', external: 'ERP job · outside Mizan' };
const STATUS_TONE: Record<CloseItem['status'], Tone> = { done: 'success', in_progress: 'primary', blocked: 'danger', not_started: 'muted', external: 'muted' };
const COVERAGE_LABEL: Record<CloseItem['coverage'], string> = { derived: 'derived from the data', input: 'department input', 'erp-job': 'ERP job, read back', outside: 'outside Mizan' };

export function CloseScreen() {
  const { world } = useApp();
  const s = closeSummary(world);
  const inMizan = s.total - s.external;
  return (
    <>
      <PageMasthead title={`${period(world.closingPeriod)} close`} meta={`Day ${world.closeDay} of 10 · ${s.done} of ${inMizan} procedures done · ${s.blocked} blocked · ${s.external} outside Mizan`}
        figures={<><Chip tone={s.inputsDone ? 'success' : 'warn'}>inputs 1–5 {s.inputsDone ? 'complete' : 'open'}</Chip><Chip tone={s.blocked ? 'danger' : 'muted'}>{s.blocked} blocked</Chip><Chip tone={world.flags.periodClosed ? 'success' : 'muted'}>{world.flags.periodClosed ? 'period closed' : 'period open'}</Chip></>} />

      <Body>
        <Tabs storageKey="close" tabs={[
        { id: 'checklist', label: 'Checklist', body: () => <Checklist /> },
        { id: 'bank', label: 'Bank reconciliation', body: () => <Bank /> },
        { id: 'budget', label: 'Budget vs actual', body: () => <Budget /> },
        { id: 'journals', label: 'Journals', body: () => <Journals /> },
      ]} />
      </Body>
    </>
  );
}

/** Tasama's 24 procedures in their own order and numbering. Inputs first, then Finance. */
function Checklist() {
  const { world, actions, persona, go, highlight } = useApp();
  const s = closeSummary(world);
  const groups: { id: CloseItem['group']; label: string; note: string }[] = [
    { id: 'inputs', label: 'Departmental inputs (1–5) — before Finance starts', note: 'HR, Requesters, Operations and D&T owe the close their inputs; Iqfal follows them up. Procedures 4 and 5 are read from the delivery schedule Shahid builds — the departments do not retype what the systems already know.' },
    { id: 'finance', label: 'Finance (6–24) — 2 working days after the inputs', note: 'Each line is Tasama\'s own procedure. Mizan derives the status where it holds the data, reads back the ERP accounting jobs, and shows Fixed Assets and Leases for what they are: outside this platform.' },
  ];
  const link = (i: CloseItem) => {
    switch (i.derivedFrom) {
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
          <StatTile label="Procedures done" value={`${s.done} / ${s.total - s.external}`} state={`+${s.external} outside Mizan`} />
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
            <Panel icon={g.id === 'inputs' ? <CalendarCheck size={16} /> : <Landmark size={16} />} title={<span className="flex items-center gap-2">{g.id === 'inputs' ? 'Inputs' : 'Finance'}<Chip tone={doneCount === countable ? 'success' : items.some((i) => i.status === 'blocked') ? 'danger' : 'primary'}>{doneCount}/{countable}</Chip></span>}
              action={<span className="text-[11px] text-muted-foreground">Tasama's deadline · their automation today · Mizan</span>}>
              <ol className="divide-y divide-border/30">
                {items.map((i) => {
                  const l = link(i);
                  const hot = highlight.has(i.id);
                  const canTick = !i.derivedFrom && i.status !== 'done' && i.status !== 'external' && (i.owner === persona.id || persona.id === 'noura');
                  return (
                    <li key={i.id} className={`grid gap-x-4 gap-y-1 py-2.5 md:grid-cols-[2.5rem_1fr_auto] ${hot ? 'rounded-lg bg-primary/8 ring-1 ring-primary/30' : ''}`}>
                      <div className="font-mono text-xs text-muted-foreground">P{i.number}</div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip tone={STATUS_TONE[i.status]}>{STATUS_LABEL[i.status]}</Chip>
                          <span className={`text-sm ${i.status === 'external' ? 'text-muted-foreground' : ''}`}>{i.title}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>{i.workstream}</span>
                          <span>· due {i.deadline}</span>
                          <span>· ERP today: {i.tasamaAutomation.toLowerCase()}</span>
                          <span>· Mizan: {COVERAGE_LABEL[i.coverage]}</span>
                          <PersonMark id={i.owner} />
                          {i.agentId ? <AgentMark id={i.agentId} size={18} /> : null}
                        </div>
                        {i.blocker ? <div className="mt-1 text-xs text-warn">Blocker: {i.blocker}</div> : null}
                        {i.evidence ? <div className="mt-1 text-xs text-muted-foreground">{i.evidence}</div> : null}
                      </div>
                      <div className="flex shrink-0 items-start gap-2">
                        {l ? <Btn small onClick={l.run}>{l.label}</Btn> : null}
                        {canTick ? <Btn small tone="primary" onClick={() => void actions.completeCloseItem(i.id)}>Record complete</Btn> : null}
                        {i.number === 23 && i.status !== 'done' ? <Btn small tone="primary" disabled={persona.id !== 'noura' || !s.readyToClose} onClick={() => void actions.closePeriod()}>{s.readyToClose ? 'Close the period' : 'Close blocked'}</Btn> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
              <ProvenanceNote>{g.note}</ProvenanceNote>
            </Panel>
          </PageSection>
        );
      })}
      <div><p className="text-[11px] text-muted-foreground">The 24 procedures, their departments, deadlines and today's automation column are Tasama's own "Monthly Closing Procedures". Statuses are derived by Iqfal from the ledger, the schedule and the reconciliations; nobody ticks a box.</p></div>
    </>
  );
}
