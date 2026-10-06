/** Close workspace: Overview · My work · Inputs · Procedures · Exceptions · Reports · supporting views. */
import { useEffect, useMemo, useState } from 'react';
import { PageContainer, PageSection, Panel } from '@cognirise/atelier/layout';
import { useApp } from '../../app/state';
import { Btn, Chip, Empty, KV, Money, PersonMark, Table } from '../../app/bits';
import { date, period as periodLabel } from '@mizan/domain/format';
import { closeOverview, followingPeriod, validPeriod, type CloseCommand, type CloseInstance, type ProcedureView } from '@mizan/domain/close';
import type { Action } from '@mizan/domain/actions';
import { Field, Workpaper, inputCls, statusTone, type Run } from './workpaper';
import { Bank, Budget, Checklist, Journals } from './legacy';

const TABS = [
  ['overview', 'Overview'], ['mywork', 'My work'], ['inputs', 'Inputs'], ['procedures', 'Procedures'], ['exceptions', 'Exceptions'], ['reports', 'Reports'],
  ['bank', 'Bank'], ['budget', 'Budget'], ['journals', 'Journals'], ['checklist', 'Supporting controls'],
] as const;
const INPUT_PERSONAS = ['hr', 'requester', 'operations', 'technology', 'dina'];
const NATIVE_TABS = ['bank', 'budget', 'journals', 'checklist'];
const FINANCE = ['noura', 'faisal', 'reem', 'omar'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CloseWorkspace() {
  const { world, persona, dispatch, tab: requested, closePeriodContext, setClosePeriodContext } = useApp();
  const [period, setPeriod] = useState(closePeriodContext);
  const [periodInput, setPeriodInput] = useState(closePeriodContext);
  const [view, setView] = useState<string>(() => (requested && TABS.some(([id]) => id === requested) ? requested : persona.id === 'noura' ? 'overview' : INPUT_PERSONAS.includes(persona.id) ? 'inputs' : 'mywork'));
  const [selected, setSelected] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { setView(persona.id === 'noura' ? 'overview' : INPUT_PERSONAS.includes(persona.id) ? 'inputs' : 'mywork'); setSelected(null); }, [persona.id]);
  useEffect(() => { if (requested && TABS.some(([id]) => id === requested)) setView(requested); }, [requested]);

  const ov = useMemo(() => closeOverview(world, period, persona.id), [world, period, persona.id]);
  const instance = ov.instance;
  const persisted = !!world.closeWorkspace?.periods?.[period];
  const closed = instance.status === 'closed';
  const run: Run = async (command: CloseCommand) => {
    const r = await dispatch({ type: 'closeWorkspace', command });
    setNotice(r.error ?? null);
    return r.error ?? null;
  };
  const open = (n: number) => { setSelected(n); setView('procedures'); };
  const changePeriod = (p: string) => { setPeriod(p); setClosePeriodContext(p); setPeriodInput(p); setSelected(null); setNotice(null); };
  const mine = ov.procedures.filter((p) => p.paper.owner === persona.id || p.paper.reviewer === persona.id || (persona.id === 'noura' && p.status === 'Action needed'));

  return (
    <>
      <PageContainer className="mb-3">
        <header className="flex flex-wrap items-end justify-between gap-3 pt-1">
          <div>
            <h1 className="font-display text-xl text-primary">{periodLabel(period)} close</h1>
            <p className="text-xs text-muted-foreground">
              {closed ? 'Closed locally' : 'Open'} · ERP: {instance.erpStatus} · calendar {instance.calendar.confirmed ? 'confirmed' : 'unconfirmed (suggestion only)'} · demo data, not live ERP
            </p>
          </div>
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (validPeriod(periodInput)) changePeriod(periodInput); }}>
            <Field id="cw-period" label="Period (YYYY-MM)"><input id="cw-period" className={`${inputCls} w-28`} value={periodInput} onChange={(e) => setPeriodInput(e.target.value)} pattern="\d{4}-\d{2}" aria-invalid={!validPeriod(periodInput)} /></Field>
            <Btn small disabled={!validPeriod(periodInput) || periodInput === period} onClick={() => changePeriod(periodInput)}>Switch</Btn>
            <Btn small onClick={() => changePeriod(followingPeriod(period))}>Next month</Btn>
            {!persisted ? <Btn small tone="primary" onClick={() => void run({ kind: 'initialize', period })}>Initialize {period}</Btn> : null}
          </form>
        </header>
        {!persisted ? <p className="mt-2 text-[11px] text-muted-foreground">This period has not been started. It is shown from the template (nothing carried over from earlier periods); initialize to begin saving.</p> : null}
        <div role="alert" aria-live="assertive">{notice ? <p className="mt-2 flex items-start justify-between gap-2 rounded-lg border border-danger/40 bg-danger/10 p-2 text-xs text-danger"><span>{notice}</span><button type="button" className="underline" onClick={() => setNotice(null)}>Dismiss</button></p> : null}</div>
        <nav aria-label="Close views" className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map(([id, label]) => <button key={id} type="button" aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)} className={`shrink-0 rounded-full border px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${view === id ? 'border-primary/50 bg-primary/12 text-primary' : 'border-border/60 bg-card/40 text-muted-foreground hover:bg-card/70 hover:text-foreground'}`}>{label}{id === 'exceptions' && ov.exceptions.length ? ` (${ov.exceptions.length})` : ''}</button>)}
        </nav>
      </PageContainer>

      {NATIVE_TABS.includes(view) && period !== world.closingPeriod ? (
        <PageContainer><Empty>Native finance screens hold {periodLabel(world.closingPeriod)} data only. Nothing is available for {periodLabel(period)} yet, and {periodLabel(world.closingPeriod)} figures are not reused here.</Empty></PageContainer>
      ) : view === 'bank' ? <Bank /> : view === 'budget' ? <Budget /> : view === 'journals' ? <Journals /> : view === 'checklist' ? <SupportingControls /> : (
        <PageContainer>
          {view === 'overview' ? <Overview ov={ov} open={open} run={run} readonly={closed} setView={setView} /> : null}
          {view === 'mywork' ? <Cards title="Waiting on you" empty="Nothing is assigned to you for this period." items={mine} open={open} /> : null}
          {view === 'inputs' ? <Inputs persona={persona.id} procs={ov.procedures.filter((p) => p.number <= 5)} open={open} run={run} readonly={closed} instance={instance} /> : null}
          {view === 'procedures' ? <Procedures procs={ov.procedures} selected={selected} open={open} instance={instance} run={run} readonly={closed} onClose={() => setSelected(null)} onView={setView} /> : null}
          {view === 'exceptions' ? <Exceptions ov={ov} run={run} readonly={closed} open={open} /> : null}
          {view === 'reports' ? <Reports ov={ov} run={run} /> : null}
        </PageContainer>
      )}
    </>
  );
}

function SupportingControls() {
  return <><PageContainer className="mb-3"><p className="text-xs text-muted-foreground">The original 17 close controls, retained for traceability (VAT, bad-debt and margin review among them). Mark done actions here act on the shared demo world, not on the per-period close instance.</p></PageContainer><Checklist /></>;
}

type Ov = ReturnType<typeof closeOverview>;

function Overview({ ov, open, run, readonly, setView }: { ov: Ov; open: (n: number) => void; run: Run; readonly: boolean; setView: (v: string) => void }) {
  const i = ov.instance;
  return (
    <div className="space-y-4">
      <Panel title="What holds up close" action={<Chip tone={ov.ready ? 'success' : 'warn'}>{ov.ready ? 'ready for sign-off' : 'not ready'}</Chip>}>
        {ov.blockers.length ? <ol className="space-y-1 text-sm">{ov.blockers.slice(0, 8).map((b, k) => <li key={k} className="flex gap-2"><span className="font-mono text-warn">{k + 1}</span><span>{b}</span></li>)}</ol> : <p className="text-sm text-success">No blockers recorded for this period.</p>}
        {ov.blockers.length > 8 ? <p className="mt-1 text-[11px] text-muted-foreground">+{ov.blockers.length - 8} more in Procedures.</p> : null}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[['Done', ov.done, 'success'], ['Action needed', ov.actionNeeded, 'warn'], ['Waiting for others', ov.waiting, 'muted']].map(([l, v, t]) => <div key={l as string} className="rounded-lg border border-border/60 bg-card/40 p-2"><div className="font-mono text-lg">{v as number}</div><Chip tone={t as 'success'}>{l as string}</Chip></div>)}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Completion never implies readiness while a critical blocker remains. Inputs {ov.inputsReady ? 'accepted' : 'not yet accepted'} · close pack {ov.packCurrent ? 'current' : 'missing or out of date'}.</p>
      </Panel>
      <Calendar key={i.period} instance={i} run={run} readonly={readonly} />
      <Panel title="Departments and owners">
        <Table head={['#', 'Procedure', 'Owner', 'Due', 'Status']} rows={ov.procedures.filter((p) => p.number <= 5).map((p) => [`P${p.number}`, <button type="button" className="text-start text-primary underline-offset-2 hover:underline" onClick={() => open(p.number)}>{p.title}</button>, <PersonMark id={p.paper.owner} />, p.due ? <span className={p.overdue ? 'text-danger' : ''}>{date(p.due)}</span> : 'anchor missing', <Chip tone={statusTone(p.status)}>{p.status}</Chip>])} />
        <div className="mt-2"><Btn small onClick={() => setView('inputs')}>Go to Inputs</Btn></div>
      </Panel>
      <SignOff ov={ov} run={run} />
    </div>
  );
}

function Calendar({ instance, run, readonly }: { instance: CloseInstance; run: Run; readonly: boolean }) {
  const { persona } = useApp();
  const canConfigure = ['noura', 'reem'].includes(persona.id);
  const c = instance.calendar;
  const [weekends, setWeekends] = useState(c.weekends);
  const [holidays, setHolidays] = useState(c.holidays.join('\n'));
  const [mat, setMat] = useState(String(instance.materiality));
  const [confirmed, setConfirmed] = useState(c.confirmed);
  const [err, setErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [baseVersion, setBaseVersion] = useState(instance.version);
  const calendarKey = JSON.stringify([c, instance.materiality]);
  useEffect(() => {
    if (dirty) { setConflict(true); return; }
    setWeekends(c.weekends); setHolidays(c.holidays.join('\n')); setMat(String(instance.materiality)); setConfirmed(c.confirmed);
  }, [calendarKey]);
  useEffect(() => { if (!dirty) setBaseVersion(instance.version); }, [dirty, instance.version]);
  const hol = holidays.split(/[\s,;]+/).filter(Boolean);
  const badHol = hol.filter((h) => !/^\d{4}-\d{2}-\d{2}$/.test(h));
  const saveCalendar = () => void run({ kind: 'calendar', period: instance.period, expectedVersion: baseVersion, weekends, holidays: hol, confirmed, materiality: Number(mat) || 0 }).then(error => {
    setErr(error);
    if (!error) { setDirty(false); setConflict(false); }
    else if (error.includes('changed')) setConflict(true);
  });
  return (
    <Panel title="Close calendar and policy" action={<Chip tone={c.confirmed ? 'success' : 'warn'}>{c.confirmed ? 'confirmed' : 'unconfirmed'}</Chip>}>
      <p className="mb-2 text-[11px] text-muted-foreground">Deadlines: coordination by the 25th; payroll output 3 working days after payment; requester, Operations and D&T inputs 2 working days after month-end; finance procedures 2 working days after procedures 1–5. Friday/Saturday weekend is a suggestion until confirmed.</p>
      {conflict ? <p role="alert" className="mb-2 text-xs text-warn">Calendar or period data changed. Your entries are preserved. <button type="button" className="underline" onClick={() => { setBaseVersion(instance.version); setConflict(false); setErr(null); }}>Keep edits and reconcile latest</button></p> : null}
      {!canConfigure ? <p className="mb-2 text-xs text-muted-foreground">Only CFO or Accounting Manager may configure the calendar.</p> : null}
      <form className="grid gap-3 md:grid-cols-3" onChange={() => setDirty(true)} onSubmit={(e) => { e.preventDefault(); if (!badHol.length && canConfigure && !conflict) saveCalendar(); }}>
        <fieldset disabled={readonly}><legend className="mb-1 text-xs text-muted-foreground">Weekend days</legend><div className="flex flex-wrap gap-2">{DOW.map((d, k) => <label key={d} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={weekends.includes(k)} onChange={(e) => setWeekends((w) => (e.target.checked ? [...w, k].sort() : w.filter((x) => x !== k)))} />{d}</label>)}</div></fieldset>
        <Field id="cw-hol" label="Holidays (YYYY-MM-DD, one per line)" error={badHol.length ? `Invalid: ${badHol.join(', ')}` : undefined}><textarea id="cw-hol" rows={3} disabled={readonly} className={inputCls} value={holidays} onChange={(e) => setHolidays(e.target.value)} /></Field>
        <div className="space-y-2">
          <Field id="cw-mat" label="Materiality (SAR)"><input id="cw-mat" type="number" min="0" disabled={readonly} className={inputCls} value={mat} onChange={(e) => setMat(e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" disabled={readonly} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />Calendar and weekend/holiday inputs are confirmed</label>
          <Btn small tone="primary" disabled={readonly || !canConfigure || conflict || !!badHol.length} onClick={saveCalendar}>Save calendar</Btn>
          {err ? <p role="alert" className="text-[11px] text-danger">{err}</p> : null}
        </div>
      </form>
    </Panel>
  );
}

function Cards({ title, items, open, empty }: { title: string; items: ProcedureView[]; open: (n: number) => void; empty: string }) {
  return (
    <PageSection label={title}>
      {items.length ? <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">{items.map((p) => (
        <li key={p.number} className="rounded-xl border border-border/60 bg-card/40 p-3">
          <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-primary">P{p.number}</span><Chip tone={statusTone(p.status)}>{p.status}</Chip><Chip tone={statusTone(p.paper.state)}>{p.paper.state}</Chip></div>
          <div className="mt-1 text-sm">{p.title}</div>
          <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground"><PersonMark id={p.paper.owner} /><span>{p.due ? `Due ${date(p.due)}` : 'No anchor date'}{p.overdue ? ' · overdue' : ''}</span></div>
          {p.blockers[0] ? <p className="mt-1 text-xs text-warn">{p.blockers[0]}</p> : null}
          <div className="mt-2"><Btn small tone="primary" onClick={() => open(p.number)}>Open workpaper</Btn></div>
        </li>))}</ul> : <Empty>{empty}</Empty>}
    </PageSection>
  );
}

function Inputs({ persona, procs, open, run, readonly, instance }: { persona: string; procs: ProcedureView[]; open: (n: number) => void; run: Run; readonly: boolean; instance: CloseInstance }) {
  const dept = INPUT_PERSONAS.includes(persona);
  const ownIds = procs.filter((p) => p.paper.owner === persona || p.paper.reviewer === persona);
  const others = procs.filter((p) => !ownIds.includes(p));
  return (
    <div className="space-y-3">
      <Cards title={dept ? 'Your submissions' : 'Departmental submissions (procedures 1–5)'} items={dept ? ownIds : procs} open={open} empty="Nothing here is assigned to you." />
      {dept && others.length ? <Panel title="Other departments (status only)"><Table head={['#', 'Procedure', 'Owner', 'Due', 'Status']} rows={others.map((p) => [`P${p.number}`, p.title, <PersonMark id={p.paper.owner} />, p.due ? date(p.due) : '—', <Chip tone={statusTone(p.status)}>{p.status}</Chip>])} /></Panel> : null}
      <Panel title="Follow-up queue">
        {instance.reminders.length ? <ul className="space-y-1 text-xs">{[...instance.reminders].reverse().map((r) => <li key={r.key}><span className="font-mono">{date(r.at)}</span> · P{r.procedure} · {r.actor}: {r.note}</li>)}</ul> : <p className="text-xs text-muted-foreground">No reminders sent. In-app only; no email is delivered.</p>}
        <div className="mt-2 flex flex-wrap gap-2">{procs.filter((p) => p.overdue && p.paper.state !== 'accepted' && FINANCE.includes(persona)).map((p) => <Btn key={p.number} small disabled={readonly} onClick={() => void run({ kind: 'remind', period: instance.period, procedure: p.number, expectedVersion: p.paper.version, note: `P${p.number} ${p.title} is overdue; please submit.` })}>Remind P{p.number}</Btn>)}</div>
      </Panel>
    </div>
  );
}

function Procedures({ procs, selected, open, instance, run, readonly, onClose, onView }: { onView: (v: string) => void; procs: ProcedureView[]; selected: number | null; open: (n: number) => void; instance: CloseInstance; run: Run; readonly: boolean; onClose: () => void }) {
  const sel = procs.find((p) => p.number === selected);
  return (
    <div className="space-y-3">
      {sel ? <Workpaper key={`${instance.period}-${sel.number}`} proc={sel} instance={instance} run={run} readonly={readonly} onClose={onClose} onView={onView} /> : null}
      <Panel title="All 24 procedures">
        <Table head={['#', 'Procedure', 'Dept', 'Owner', 'Source automation', 'Mizan execution', 'Due', 'Status']} rows={procs.map((p) => [
          `P${p.number}`, <button type="button" className="text-start text-primary hover:underline" onClick={() => open(p.number)}>{p.title}</button>, <span className="text-[11px]">{p.department}</span>, <PersonMark id={p.paper.owner} />,
          <Chip tone="muted">{p.automation}</Chip>, <Chip tone={p.coverage === 'Strong demo' ? 'success' : p.coverage === 'Partial / adjacent' ? 'primary' : 'warn'}>{p.coverage}</Chip>,
          p.due ? <span className={p.overdue ? 'text-danger' : ''}>{date(p.due)}</span> : '—', <Chip tone={statusTone(p.status)}>{p.status}</Chip>])} />
      </Panel>
    </div>
  );
}

function Exceptions({ ov, run, readonly, open }: { ov: Ov; run: Run; readonly: boolean; open: (n: number) => void }) {
  const { persona } = useApp();
  const i = ov.instance;
  const canResolve = FINANCE.includes(persona.id);
  const canWaive = persona.id === 'noura';
  const ownable = ov.procedures.filter((p) => p.paper.owner === persona.id || persona.id === 'noura');
  const [f, setF] = useState({ procedure: String(ov.procedures.find((p) => p.paper.owner === persona.id)?.number ?? 6), title: '', amount: '', currency: 'SAR', severity: 'material' });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const jobErrs = ov.procedures.filter((p) => p.paper.values.jobState === 'Error' || (p.paper.values.jobErrors ?? '').trim());
  const validation = ov.procedures.filter((p) => p.errors.length && !jobErrs.includes(p));
  const natives = ov.exceptions.filter((x) => x.source === 'native');
  const manual = i.exceptions;
  return (
    <div className="space-y-3">
      <Panel title="Accounting job errors">
        {jobErrs.length ? <ul className="space-y-2 text-xs">{jobErrs.map((p) => <li key={p.number} className="rounded-lg border border-danger/40 bg-danger/10 p-2"><button type="button" className="text-primary underline" onClick={() => open(p.number)}>P{p.number} {p.title}</button> <Chip tone="danger">{p.paper.values.jobState || 'Error'}</Chip>{p.paper.values.runRef ? <span className="ms-2 font-mono">{p.paper.values.runRef}</span> : null}<p className="mt-1 whitespace-pre-wrap text-danger">{p.paper.values.jobErrors}</p></li>)}</ul> : <p className="text-xs text-muted-foreground">No job errors recorded. Job outcomes are externally recorded; Mizan did not run an ERP job.</p>}
      </Panel>
      <Panel title="Validation queue" action={<Chip tone="muted">{validation.length}</Chip>}>
        {validation.length ? <ul className="space-y-1 text-xs">{validation.map((p) => <li key={p.number}><button type="button" className="text-primary underline" onClick={() => open(p.number)}>P{p.number} {p.title}</button> <span className="text-muted-foreground">{p.errors.length} missing or invalid: {p.errors[0]}</span></li>)}</ul> : <p className="text-xs text-muted-foreground">No validation gaps.</p>}
      </Panel>
      <Panel title="Native source exceptions" action={<Chip tone="muted">{natives.length}</Chip>}>
        {natives.length ? <ul className="space-y-1 text-xs">{natives.map((x) => <li key={x.id} className="flex flex-wrap items-center gap-2"><Chip tone={x.severity === 'critical' ? 'danger' : 'warn'}>{x.severity}</Chip><span className="font-mono">P{x.procedure}</span><span>{x.title}</span><Money v={x.amount} currency={x.currency} /><Chip tone="muted">resolve at source only</Chip><Btn small onClick={() => open(x.procedure)}>Open</Btn></li>)}</ul> : <p className="text-xs text-muted-foreground">None. These clear when the underlying record is fixed, and cannot be resolved or waived here.</p>}
      </Panel>
      <Panel title="Recorded exceptions">
        {manual.length ? <ul className="space-y-2">{manual.map((x) => (
          <li key={x.id} className="rounded-lg border border-border/60 bg-card/40 p-2 text-xs">
            <div className="flex flex-wrap items-center gap-2"><Chip tone={x.severity === 'critical' ? 'danger' : x.severity === 'material' ? 'warn' : 'muted'}>{x.severity}</Chip><Chip tone={x.status === 'open' ? 'warn' : 'success'}>{x.status}</Chip>{x.nonWaivable ? <Chip tone="danger">non-waivable</Chip> : null}<span className="font-mono">P{x.procedure}</span><span>{x.title}</span><Money v={x.amount} currency={x.currency} /><PersonMark id={x.owner} /></div>
            {x.status !== 'open' ? <p className="mt-1 text-muted-foreground">{x.status} by {x.decidedBy} {x.decidedAt ? date(x.decidedAt) : ''}: {x.reason}</p> : (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <div className="min-w-[12rem] flex-1"><Field id={`xr-${x.id}`} label="Reason / justification"><input id={`xr-${x.id}`} className={inputCls} value={reasons[x.id] ?? ''} onChange={(e) => setReasons((r) => ({ ...r, [x.id]: e.target.value }))} /></Field></div>
                <Btn small disabled={readonly || !canResolve || !(reasons[x.id] ?? '').trim()} onClick={() => void run({ kind: 'decideException', period: i.period, expectedVersion: i.version, id: x.id, decision: 'resolve', reason: reasons[x.id] }).then(setErr)}>Resolve</Btn>
                <Btn small tone="danger" disabled={readonly || !canWaive || x.nonWaivable || !(reasons[x.id] ?? '').trim()} onClick={() => { if (window.confirm(`Waive "${x.title}"? Your name and justification are recorded.`)) void run({ kind: 'decideException', period: i.period, expectedVersion: i.version, id: x.id, decision: 'waive', reason: reasons[x.id] }).then(setErr); }}>Waive</Btn>
                <span className="text-[11px] text-muted-foreground">{!canResolve ? 'Finance resolves exceptions. ' : ''}{!canWaive ? 'Only the CFO can waive. ' : ''}{x.nonWaivable ? 'Cannot be waived (posting error or missing mandatory evidence).' : ''}</span>
              </div>)}
          </li>))}</ul> : <Empty>No manual exceptions recorded for this period.</Empty>}
      </Panel>
      <Panel title="Add exception">
        <form className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => { e.preventDefault(); void run({ kind: 'exception', period: i.period, expectedVersion: i.version, procedure: Number(f.procedure), title: f.title, amount: Number(f.amount) || 0, currency: f.currency as 'SAR', severity: f.severity as 'minor' }).then((er) => { setErr(er); if (!er) setF({ ...f, title: '', amount: '' }); }); }}>
          <Field id="xe-p" label="Procedure"><select id="xe-p" className={inputCls} value={f.procedure} onChange={(e) => setF({ ...f, procedure: e.target.value })}>{ownable.map((p) => <option key={p.number} value={p.number}>P{p.number} {p.title}</option>)}</select></Field>
          <Field id="xe-t" label="Title" required><input id="xe-t" required className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field id="xe-a" label="Amount"><input id="xe-a" type="number" step="any" className={inputCls} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field id="xe-c" label="Currency / severity"><div className="flex gap-1"><select aria-label="Currency" className={inputCls} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}><option>SAR</option><option>USD</option></select><select aria-label="Severity" className={inputCls} value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })}><option>minor</option><option>material</option><option>critical</option></select></div></Field>
          <div className="flex items-end"><button type="submit" disabled={readonly || !ownable.length || !f.title.trim()} className="rounded-lg border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">Add exception</button></div>
        </form>
        {!ownable.length ? <p className="mt-1 text-[11px] text-muted-foreground">You can add exceptions only to procedures you own.</p> : null}
        {err ? <p role="alert" className="mt-2 text-xs text-danger">{err}</p> : null}
        <p className="mt-2 text-[11px] text-muted-foreground">Materiality policy: {i.materiality ? `SAR ${i.materiality.toLocaleString()}` : 'not set'}. Reminder and escalation history is on Inputs.</p>
      </Panel>
    </div>
  );
}

function Reports({ ov, run }: { ov: Ov; run: Run }) {
  const { persona } = useApp();
  const i = ov.instance;
  const [err, setErr] = useState<string | null>(null);
  const pack = i.pack;
  const copy = () => { if (pack) void navigator.clipboard?.writeText(pack.content); };
  const download = () => { if (!pack) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([pack.content], { type: 'text/plain' })); a.download = `close-pack-${i.period}.txt`; a.click(); URL.revokeObjectURL(a.href); };
  return (
    <div className="space-y-3">
      {i.snapshots?.length ? <Panel title="Signed close snapshots"><div className="space-y-2">{i.snapshots.map((snapshot, index) => <details key={`${snapshot.closedAt}-${index}`} className="rounded-lg border border-border/60 p-2"><summary className="cursor-pointer text-xs">Sign-off {index + 1} · {date(snapshot.closedAt)} · {snapshot.closedBy}</summary><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-[11px]">{snapshot.content}</pre></details>)}</div></Panel> : null}
      <Panel title="Close pack" action={<Chip tone={ov.packCurrent ? 'success' : 'warn'}>{pack ? (ov.packCurrent ? 'current' : 'out of date') : 'not generated'}</Chip>}>
        <p className="text-[11px] text-muted-foreground">Generated from the recorded procedure and workpaper evidence. It is a demo summary, not posted ERP output.</p>
        <div className="mt-2 flex flex-wrap gap-2"><Btn small tone="primary" disabled={i.status === 'closed' || !FINANCE.includes(persona.id)} onClick={() => void run({ kind: 'pack', period: i.period, expectedVersion: i.version }).then(setErr)}>{pack ? 'Regenerate pack' : 'Generate pack'}</Btn><Btn small disabled={!pack} onClick={copy}>Copy text</Btn><Btn small disabled={!pack} onClick={download}>Download .txt</Btn></div>
        {!FINANCE.includes(persona.id) ? <p className="mt-1 text-[11px] text-muted-foreground">Only Finance can generate the pack.</p> : null}
        {err ? <p role="alert" className="mt-2 text-xs text-danger">{err}</p> : null}
        {pack ? <><p className="mt-2 text-[11px] text-muted-foreground">Generated {date(pack.generatedAt)} by {pack.generatedBy}</p><pre tabIndex={0} className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border/60 bg-card/40 p-3 font-mono text-[11px] leading-snug">{pack.content}</pre></> : <div className="mt-2"><Empty>No pack yet. Generate one once evidence is in.</Empty></div>}
      </Panel>
      <SignOff ov={ov} run={run} />
      <Panel title="Period history"><ul className="space-y-1 text-[11px] text-muted-foreground">{i.history.length ? [...i.history].reverse().map((h, k) => <li key={k}><span className="font-mono">{date(h.at)}</span> · {h.actor} · {h.event}{h.reason ? ` — ${h.reason}` : ''}</li>) : <li>No period-level history.</li>}</ul></Panel>
    </div>
  );
}

function SignOff({ ov, run }: { ov: Ov; run: Run }) {
  const { persona } = useApp();
  const i = ov.instance;
  const [ref, setRef] = useState('');
  const [ev, setEv] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const cfo = persona.id === 'noura';
  const closed = i.status === 'closed';
  const finalPaper = i.papers['23'];
  const why = !cfo ? 'Only the CFO can sign off.' : closed ? 'Already closed locally.' : !ov.ready ? 'Blocked: resolve the blockers listed on Overview.' : !ov.packCurrent ? 'Generate a current close pack first.' : finalPaper.state !== 'submitted' ? 'Submit P23 final review with approval evidence first.' : finalPaper.preparedBy === 'noura' ? 'Another preparer must submit P23 for independent CFO sign-off.' : '';
  const go = (kind: 'close' | 'requestErpClosure', msg: string) => { if (window.confirm(msg)) void run({ kind, period: i.period, expectedVersion: i.version }).then(setErr); };
  return (
    <Panel title="CFO sign-off and closure" action={<Chip tone={closed ? 'success' : 'warn'}>{closed ? 'closed locally' : 'open'}</Chip>}>
      <KV rows={[['Local demo closure', closed ? `Closed ${i.closedAt ? date(i.closedAt) : ''} by ${i.closedBy ?? ''}` : 'Not closed'], ['ERP closure', i.erpStatus], ['ERP reference', i.erpReference ?? '—']]} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn tone="primary" disabled={!!why} onClick={() => go('close', `Close ${i.period} locally? This locks the reviewed snapshot in this demo only. It does not close any ERP.`)}>Close locally (demo)</Btn>
        <Btn disabled={!closed || !cfo || i.erpStatus !== 'Not requested'} onClick={() => go('requestErpClosure', `Record that ERP closure for ${i.period} has been requested? Mizan does not close the ERP itself.`)}>Record ERP closure requested</Btn>
      </div>
      {why ? <p className="mt-1 text-[11px] text-muted-foreground">{why}</p> : null}
      <form className="mt-3 grid gap-2 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); void run({ kind: 'confirmErpClosure', period: i.period, expectedVersion: i.version, reference: ref, evidence: ev }).then(setErr); }}>
        <Field id="erp-ref" label="ERP closure reference"><input id="erp-ref" className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        <Field id="erp-ev" label="Evidence reference"><input id="erp-ev" className={inputCls} value={ev} onChange={(e) => setEv(e.target.value)} /></Field>
        <div className="flex items-end"><button type="submit" disabled={!cfo || i.erpStatus !== 'Closure requested' || !ref.trim() || !ev.trim()} className="rounded-lg border border-border/70 bg-card/50 px-3 py-1.5 text-xs disabled:opacity-50">Record external confirmation</button></div>
      </form>
      {closed ? <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border/40 pt-3"><div className="min-w-[14rem] flex-1"><Field id="reopen" label="Reopen reason (local demo only; the ERP is not reopened)"><input id="reopen" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div><Btn tone="danger" disabled={!cfo || !reason.trim()} onClick={() => { if (window.confirm(`Reopen ${i.period} locally? The locked snapshot is released and the reason is recorded.`)) void run({ kind: 'reopen', period: i.period, expectedVersion: i.version, reason }).then(setErr); }}>Reopen period</Btn></div> : null}
      {err ? <p role="alert" className="mt-2 text-xs text-danger">{err}</p> : null}
    </Panel>
  );
}
