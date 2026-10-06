/** A procedure workpaper: bound fields, receipts (3), statements (22), lifecycle actions. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '@cognirise/atelier/layout';
import { useApp } from '../../app/state';
import { Btn, Chip, KV, PersonMark, type Tone } from '../../app/bits';
import { PERSONAS } from '@mizan/domain/personas';
import { date, money } from '@mizan/domain/format';
import { paperFingerprint, validatePaper, type ClosePaper, type CloseCommand, type CloseInstance, type ProcedureView, type StatementLine, type SupplierReceipt } from '@mizan/domain/close';

export type Run = (c: CloseCommand) => Promise<string | null>;
export const inputCls = 'w-full rounded-lg border border-border/70 bg-background/70 px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40';
export const statusTone = (s: string): Tone => (s === 'Done' || s === 'accepted' ? 'success' : s === 'Action needed' || s === 'returned' ? 'warn' : s === 'submitted' ? 'primary' : 'muted');

export function Field({ id, label, required, error, children }: { id: string; label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label htmlFor={id} className="block text-xs text-muted-foreground">{label}{required ? <span className="text-danger"> *</span> : null}</label>{children}{error ? <p role="alert" className="text-[11px] text-danger">{error}</p> : null}</div>;
}

const newReceipt = (): SupplierReceipt => ({ id: `R${Date.now().toString(36)}`, vendor: '', poRef: '', cocRef: '', receivedDate: '', amount: 0, currency: 'SAR', invoiceRef: '', description: '' });
const newLine = (kind: StatementLine['kind']): StatementLine => ({ id: `S${Date.now().toString(36)}`, account: '', kind, actual: 0, prior: 0, budget: 0, debit: 0, credit: 0, commentary: '', correctionRef: '' });

type Draft = { values: Record<string, string>; receipts: SupplierReceipt[]; statements: StatementLine[]; base: number };
const draftKey = (period: string, n: number, who: string) => `cw-draft:${period}:${n}:${who}`;
const readDraft = (k: string): Draft | null => { try { const r = sessionStorage.getItem(k); return r ? (JSON.parse(r) as Draft) : null; } catch { return null; } };
const writeDraft = (k: string, d: Draft | null) => { try { if (d) sessionStorage.setItem(k, JSON.stringify(d)); else sessionStorage.removeItem(k); } catch { /* private mode */ } };

export function Workpaper({ proc, instance, run, readonly, onClose, onView }: { proc: ProcedureView; instance: CloseInstance; run: Run; readonly: boolean; onClose: () => void; onView: (v: string) => void }) {
  const { world, persona, go } = useApp();
  const paper = proc.paper;
  const dKey = draftKey(instance.period, proc.number, persona.id);
  const stored = useMemo(() => readDraft(dKey), [dKey]);
  const [values, setValues] = useState<Record<string, string>>(stored?.values ?? paper.values);
  const [receipts, setReceipts] = useState<SupplierReceipt[]>(stored?.receipts ?? paper.receipts);
  const [statements, setStatements] = useState<StatementLine[]>(stored?.statements ?? paper.statements);
  const [dirty, setDirty] = useState(!!stored);
  const baseRef = useRef(stored?.base ?? paper.version);
  const [conflict, setConflict] = useState(!!stored && stored.base !== paper.version);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [owner, setOwner] = useState(paper.owner);
  const [reviewer, setReviewer] = useState(paper.reviewer);
  const seen = useRef(paper.version);
  const selfSave = useRef(false);
  const latest = useRef(paper.version);
  latest.current = paper.version;
  useEffect(() => {
    if (paper.version === seen.current) return;
    seen.current = paper.version;
    if (selfSave.current) { selfSave.current = false; baseRef.current = paper.version; return; }
    if (dirty) { setConflict(true); return; }
    baseRef.current = paper.version;
    setValues(paper.values); setReceipts(paper.receipts); setStatements(paper.statements); setOwner(paper.owner); setReviewer(paper.reviewer);
  }, [paper, dirty]);
  useEffect(() => { writeDraft(dKey, dirty ? { values, receipts, statements, base: baseRef.current } : null); }, [dKey, dirty, values, receipts, statements]);
  const discard = () => { if (!window.confirm('Discard your local edits and load the current saved record?')) return; baseRef.current = paper.version; setValues(paper.values); setReceipts(paper.receipts); setStatements(paper.statements); setDirty(false); setConflict(false); setError(null); };
  const reconcile = () => { baseRef.current = paper.version; setConflict(false); setError(null); };
  const close = () => { if (dirty && !window.confirm('You have unsaved changes. They stay in this browser session and are restored when you reopen this workpaper. Close it?')) return; onClose(); };

  const draft: ClosePaper = useMemo(() => ({ ...paper, values, receipts, statements }), [paper, values, receipts, statements]);
  const problems = useMemo(() => { try { return validatePaper(world, instance, draft); } catch { return ['Validation could not run. Reload the current record before submitting.']; } }, [world, instance, draft]);
  const mine = persona.id === paper.owner || persona.id === 'noura';
  const isReviewer = persona.id === paper.reviewer || persona.id === 'noura';
  const sameHand = !!paper.preparedBy && paper.preparedBy === persona.id;
  const editLock = readonly ? 'Period is closed; only the CFO can reopen it.' : paper.state === 'submitted' ? 'Submitted for review. Return it to edit.' : paper.state === 'accepted' ? 'Accepted. Use Replace accepted evidence to create a new draft and invalidate affected reviews.' : !mine ? `Only ${PERSONAS.find((p) => p.id === paper.owner)?.name ?? paper.owner} (owner) or the CFO can edit.` : '';
  const submitLock = editLock || (conflict ? 'Reconcile with the changed record first.' : '') || (problems.length ? `${problems.length} validation issue(s) to fix first.` : '');
  const reviewLock = readonly ? 'Period is closed.' : paper.state !== 'submitted' ? 'Nothing submitted to review.' : !isReviewer ? 'Only the assigned reviewer or CFO can review.' : sameHand ? 'The preparer cannot review their own paper.' : dirty ? 'Unsaved edits exist.' : '';
  const stale = paper.reviewedFingerprint && paper.state === 'accepted' && paper.reviewedFingerprint !== paperFingerprint(world, instance, paper);

  const go2 = async (c: CloseCommand) => { setBusy(true); const e = await run(c); setBusy(false); setError(e); return e; };
  const save = async () => {
    if (conflict) { setError('The record changed while you were editing. Reconcile or discard first.'); return 'conflict'; }
    selfSave.current = true;
    const e = await go2({ kind: 'save', period: instance.period, procedure: proc.number, expectedVersion: baseRef.current, values, receipts, statements });
    if (e) selfSave.current = false; else { setDirty(false); writeDraft(dKey, null); }
    return e;
  };
  const submit = async () => {
    if (dirty && (await save())) return;
    await new Promise((r) => setTimeout(r, 0));
    await go2({ kind: 'submit', period: instance.period, procedure: proc.number, expectedVersion: dirty ? latest.current : baseRef.current });
  };
  const setV = (k: string, v: string) => { setValues((x) => ({ ...x, [k]: v })); setDirty(true); };
  const total = receipts.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const tb = statements.reduce((s, l) => ({ d: s.d + (Number(l.debit) || 0), c: s.c + (Number(l.credit) || 0) }), { d: 0, c: 0 });
  const nativeGo = () => { const n = proc.native; if (n === 'bank' || n === 'journals' || n === 'budget') onView(n); else if (n === 'billing') go('l2c', undefined, 'billing'); else if (n === 'collections') go('l2c', undefined, 'collections'); else if (n === 'inbox') go('inbox'); };
  const people = PERSONAS.filter((p) => p.nav.includes('close') || ['hr', 'requester', 'operations', 'technology', 'dina'].includes(p.id));

  return (
    <Panel title={<span className="flex flex-wrap items-center gap-2"><span className="font-mono text-primary">P{proc.number}</span>{proc.title}<Chip tone={statusTone(paper.state)}>{paper.state}</Chip>{stale ? <Chip tone="danger">review invalidated</Chip> : null}</span>}
      action={<span className="flex gap-2">{proc.native ? <Btn small onClick={nativeGo}>Open native screen</Btn> : null}<Btn small tone="ghost" onClick={close}>Close</Btn></span>}>
      <p className="text-xs leading-snug text-muted-foreground">{proc.description}</p>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <KV rows={[['Department', proc.department], ['Owner / preparer', <PersonMark id={paper.owner} />], ['Reviewer', <PersonMark id={paper.reviewer} />], ['Due', proc.due ? `${date(proc.due)}${proc.overdue ? ' (overdue)' : ''}` : 'Needs anchor date'], ['Version', `v${paper.version}`]]} />
        <KV rows={[['Source document automation', <Chip tone="muted">{proc.automation}</Chip>], ['Mizan execution mode', <Chip tone={proc.coverage === 'Strong demo' ? 'success' : proc.coverage === 'Partial / adjacent' ? 'primary' : 'warn'}>{proc.coverage}</Chip>], ['Prerequisites', proc.prerequisites.length ? proc.prerequisites.map((n) => `P${n}`).join(', ') : 'none'], ['Reviewed by', paper.reviewedBy ? <PersonMark id={paper.reviewedBy} /> : 'not reviewed']]} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">The automation column is from the uploaded procedure document. Mizan execution mode is what this demo actually does. Manually recorded external results are not Mizan running an ERP job.</p>
      {(() => { const seenT = new Set<string>(); const uniq = (l: string[]) => l.filter((x) => (seenT.has(x) ? false : (seenT.add(x), true))); const bl = uniq(dirty ? [] : proc.blockers), er = uniq(dirty ? [] : proc.errors), va = uniq(problems); const n = bl.length + er.length + va.length;
        return n ? <details className="mt-2 rounded-lg border border-warn/40 bg-warn/10 p-2 text-xs"><summary className="cursor-pointer text-warn">{n} open item(s): {bl.length} blocker, {er.length} error, {va.length} validation. First: {(bl[0] ?? er[0] ?? va[0])}</summary>
          {([['Blockers', bl], ['Errors', er], ['Validation before submission', va]] as const).map(([t, l]) => l.length ? <div key={t} className="mt-1"><div className="font-mono text-[10px] uppercase text-muted-foreground">{t}</div><ul className="list-disc ps-5">{l.map((x, k) => <li key={k}>{x}</li>)}</ul></div> : null)}</details> : <p className="mt-2 text-xs text-success">No blockers; passes submission validation.</p>; })()}
      {conflict ? <div role="alert" className="mt-2 rounded-lg border border-danger/40 bg-danger/10 p-2 text-xs text-danger"><p>This record changed (now v{paper.version}) while you were editing from v{baseRef.current}. Your local edits are kept.</p><div className="mt-1 flex flex-wrap gap-2"><Btn small tone="primary" onClick={reconcile}>Reconcile latest (keep my edits)</Btn><Btn small tone="danger" onClick={discard}>Discard local edits</Btn></div></div> : null}
      {paper.reviewNote ? <p className="mt-2 rounded-lg border border-border/60 bg-card/40 p-2 text-xs">Reviewer note: {paper.reviewNote}</p> : null}
      {paper.state === 'accepted' && !readonly && mine ? <div className="mt-3"><Btn small disabled={busy} onClick={() => {
        if (window.confirm(`Replace accepted P${proc.number} evidence for ${instance.period}? This starts a new draft and invalidates this acceptance and affected dependent reviews.`)) void go2({ kind: 'save', period: instance.period, procedure: proc.number, expectedVersion: paper.version, values: paper.values, receipts: paper.receipts, statements: paper.statements });
      }}>Replace accepted evidence</Btn></div> : null}

      <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); void save(); }} aria-label={`Workpaper ${proc.number} ${proc.title}`}>
        <fieldset disabled={!!editLock || busy} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {proc.fields.map((f) => { const id = `f-${proc.number}-${f.key}`; const miss = f.required && !(values[f.key] ?? '').trim(); const common = { id, value: values[f.key] ?? '', 'aria-required': f.required, className: inputCls, onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement>) => setV(f.key, e.target.value) };
            return <div key={f.key} className={f.type === 'textarea' ? 'md:col-span-2' : ''}><Field id={id} label={f.label} required={f.required} error={dirty && miss ? 'Required' : undefined}>
              {f.type === 'textarea' ? <textarea {...common} rows={3} /> : f.type === 'select' ? <select {...common}><option value="">Select…</option>{f.options?.map((o) => <option key={o}>{o}</option>)}</select> : <input {...common} type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} step={f.type === 'number' ? 'any' : undefined} inputMode={f.type === 'number' ? 'decimal' : undefined} />}
            </Field></div>; })}
        </fieldset>

        {proc.number === 3 ? (
          <fieldset disabled={!!editLock || busy} className="space-y-2">
            <legend className="text-xs text-primary">Inbound supplier / service receipts (purchasing CoCs, not client delivery CoCs)</legend>
            {receipts.map((r, i) => { const up = (k: keyof SupplierReceipt, v: string) => { setReceipts((x) => x.map((y, j) => (j === i ? { ...y, [k]: k === 'amount' ? Number(v) : v } : y))); setDirty(true); };
              return <div key={r.id} className="grid grid-cols-1 gap-2 rounded-lg border border-border/60 p-2 sm:grid-cols-2 lg:grid-cols-4">
                {([['vendor', 'Supplier'], ['poRef', 'PO ref'], ['cocRef', 'CoC ref'], ['invoiceRef', 'Invoice ref'], ['description', 'Description']] as const).map(([k, l]) => <Field key={k} id={`r-${r.id}-${k}`} label={l}><input id={`r-${r.id}-${k}`} className={inputCls} value={r[k]} onChange={(e) => up(k, e.target.value)} /></Field>)}
                <Field id={`r-${r.id}-d`} label="Received"><input id={`r-${r.id}-d`} type="date" className={inputCls} value={r.receivedDate} onChange={(e) => up('receivedDate', e.target.value)} /></Field>
                <Field id={`r-${r.id}-a`} label="Amount"><input id={`r-${r.id}-a`} type="number" step="any" className={inputCls} value={r.amount} onChange={(e) => up('amount', e.target.value)} /></Field>
                <Field id={`r-${r.id}-c`} label="Currency"><select id={`r-${r.id}-c`} className={inputCls} value={r.currency} onChange={(e) => up('currency', e.target.value)}><option>SAR</option><option>USD</option></select></Field>
                <div className="flex items-end"><Btn small tone="danger" onClick={() => { setReceipts((x) => x.filter((_, j) => j !== i)); setDirty(true); }}>Remove receipt</Btn></div>
              </div>; })}
            <div className="flex flex-wrap items-center gap-3"><Btn small onClick={() => { setReceipts((x) => [...x, newReceipt()]); setDirty(true); }}>Add receipt</Btn><span className="text-xs text-muted-foreground">{receipts.length} receipts · entered total {money(total)} vs control {money(Number(values.sourceTotal) || 0)}</span></div>
          </fieldset>
        ) : null}

        {proc.number === 22 ? (
          <fieldset disabled={!!editLock || busy} className="space-y-2">
            <legend className="text-xs text-primary">Financial statement workpaper (trial balance, P&amp;L, balance sheet)</legend>
            {statements.map((l, i) => { const up = (k: keyof StatementLine, v: string) => { setStatements((x) => x.map((y, j) => (j === i ? { ...y, [k]: ['actual', 'prior', 'budget', 'debit', 'credit'].includes(k) ? Number(v) : v } : y))); setDirty(true); };
              return <div key={l.id} className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 p-2 md:grid-cols-4 lg:grid-cols-6">
                <Field id={`s-${l.id}-ac`} label="Account"><input id={`s-${l.id}-ac`} className={inputCls} value={l.account} onChange={(e) => up('account', e.target.value)} /></Field>
                <Field id={`s-${l.id}-k`} label="Statement"><select id={`s-${l.id}-k`} className={inputCls} value={l.kind} onChange={(e) => up('kind', e.target.value)}><option>P&amp;L</option><option>Balance Sheet</option><option>Trial balance</option></select></Field>
                {(['actual', 'prior', 'budget', 'debit', 'credit'] as const).map((k) => <Field key={k} id={`s-${l.id}-${k}`} label={k[0].toUpperCase() + k.slice(1)}><input id={`s-${l.id}-${k}`} type="number" step="any" className={inputCls} value={l[k]} onChange={(e) => up(k, e.target.value)} /></Field>)}
                <div className="font-mono text-[11px] text-muted-foreground self-end">vs prior {money(l.actual - l.prior, 'SAR', { compact: true })}<br />vs budget {money(l.actual - l.budget, 'SAR', { compact: true })}</div>
                <div className="col-span-2 md:col-span-2"><Field id={`s-${l.id}-cm`} label="Commentary"><input id={`s-${l.id}-cm`} className={inputCls} value={l.commentary} onChange={(e) => up('commentary', e.target.value)} /></Field></div>
                <Field id={`s-${l.id}-cr`} label="Correction journal ref"><input id={`s-${l.id}-cr`} className={inputCls} value={l.correctionRef} onChange={(e) => up('correctionRef', e.target.value)} /></Field>
                <div className="flex items-end"><Btn small tone="danger" onClick={() => { setStatements((x) => x.filter((_, j) => j !== i)); setDirty(true); }}>Delete line</Btn></div>
              </div>; })}
            <div className="flex flex-wrap items-center gap-3"><Btn small onClick={() => { setStatements((x) => [...x, newLine('Trial balance')]); setDirty(true); }}>Add account line</Btn><span className="text-xs text-muted-foreground">{statements.length} lines (expected {values.expectedAccounts || '?'}) · debits {money(tb.d)} · credits {money(tb.c)} · {Math.abs(tb.d - tb.c) < 0.005 ? 'balanced' : `out by ${money(tb.d - tb.c)}`}</span></div>
          </fieldset>
        ) : null}
        {proc.number === 2 ? <p className="text-[11px] text-muted-foreground">Payroll workpaper holds aggregate totals only. Do not enter individual employee salary data.</p> : null}

        <div role="status" aria-live="polite" className="text-xs">
          {error ? <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-danger">{error} Your unsaved input has been kept.</p> : null}
          <span className={dirty ? 'text-warn' : 'text-success'}>{busy ? 'Working…' : dirty ? 'Unsaved changes' : `Saved${paper.updatedAt ? ` · ${date(paper.updatedAt)}` : ''}`}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={!!editLock || busy || !dirty} className="rounded-lg border border-border/70 bg-card/50 px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50">Save draft</button>
          <Btn tone="primary" disabled={!!submitLock || busy} onClick={() => { if (window.confirm(`Submit P${proc.number} ${proc.title} for review by ${paper.reviewer}? Evidence for ${instance.period} becomes read-only until reviewed.`)) void submit(); }}>{paper.state === 'returned' ? 'Resubmit' : 'Submit for review'}</Btn>
          {submitLock ? <span className="text-[11px] text-muted-foreground">{submitLock}</span> : null}
        </div>
      </form>

      <div className="mt-4 grid gap-3 border-t border-border/40 pt-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-xs text-primary">Review</div>
          <Field id={`rn-${proc.number}`} label="Reason / note (required to return)"><textarea id={`rn-${proc.number}`} className={inputCls} rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <div className="flex flex-wrap gap-2">
            {proc.number === 23 ? <Btn small tone="primary" onClick={() => onView('reports')}>Accepted via CFO sign-off in Reports</Btn> : <Btn small tone="primary" disabled={!!reviewLock || busy} onClick={() => { if (window.confirm(`Accept P${proc.number}? This records you as independent reviewer for v${paper.version}.`)) void go2({ kind: 'review', period: instance.period, procedure: proc.number, expectedVersion: paper.version, decision: 'accept', reason: note }); }}>Accept</Btn>}
            <Btn small tone="danger" disabled={!!reviewLock || busy || !note.trim()} onClick={() => void go2({ kind: 'review', period: instance.period, procedure: proc.number, expectedVersion: paper.version, decision: 'return', reason: note })}>Return with reason</Btn>
          </div>
          {proc.number === 23 ? <p className="text-[11px] text-muted-foreground">Final approval is not accepted through normal review; the CFO signs off in Reports. Return remains available to the reviewer.</p> : null}
          {reviewLock ? <p className="text-[11px] text-muted-foreground">{reviewLock}</p> : null}
          <div className="flex flex-wrap gap-2"><Btn small disabled={readonly || busy || !note.trim()} onClick={() => void go2({ kind: 'remind', period: instance.period, procedure: proc.number, expectedVersion: paper.version, note })}>Send in-app reminder</Btn></div>
          <p className="text-[11px] text-muted-foreground">Reminders are in-app only; no email is sent. Duplicate reminders on the same day are collapsed. {!note.trim() ? 'Enter a note to enable.' : ''}</p>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-primary">Delegate ownership</div>
          <Field id={`ow-${proc.number}`} label="Owner (preparer)"><select id={`ow-${proc.number}`} className={inputCls} value={owner} onChange={(e) => setOwner(e.target.value)}>{people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}</select></Field>
          <Field id={`rv-${proc.number}`} label="Reviewer (must differ)"><select id={`rv-${proc.number}`} className={inputCls} value={reviewer} onChange={(e) => setReviewer(e.target.value)}>{people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}</select></Field>
          <Btn small disabled={readonly || busy || !['noura', 'reem'].includes(persona.id) || !note.trim() || owner === reviewer || !['noura', 'reem', 'faisal'].includes(reviewer) || (owner === paper.owner && reviewer === paper.reviewer)} onClick={() => void go2({ kind: 'delegate', period: instance.period, procedure: proc.number, expectedVersion: paper.version, owner, reviewer, reason: note })}>Delegate</Btn>
          <p className="text-[11px] text-muted-foreground">{owner === reviewer ? 'Preparer and reviewer must be different people. ' : ''}Uses the note above as the reason.</p>
        </div>
      </div>
      <details className="mt-3"><summary className="cursor-pointer text-xs text-muted-foreground">History ({paper.history.length})</summary>
        <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">{[...paper.history].reverse().map((h, i) => <li key={i}><span className="font-mono">{date(h.at)}</span> · v{h.version} · {h.actor} · {h.event}{h.detail ? ` — ${h.detail}` : ''}</li>)}</ul></details>
    </Panel>
  );
}
