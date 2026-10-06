import type { World } from './types';
import type { CloseInstance, ClosePaper, CloseException, ProcedureView } from './close-types';
import { CLOSE_PROCEDURES, ACCOUNTING_PROCEDURES, procedureByNumber } from './close-catalogue';
import { bankRec, cashStats, unbilled, deferredBalance } from './derive';
import { procedureDeadline, validDate } from './close-calendar';

export const CLOSE_FINANCE = ['noura', 'reem', 'omar', 'faisal'];
export function makeCloseInstance(period: string): CloseInstance {
  return {
    period, version: 0, calendar: { confirmed: false, weekends: [5, 6], holidays: [] }, materiality: 10000,
    papers: Object.fromEntries(CLOSE_PROCEDURES.map(p => [String(p.number), {
      procedure: p.number, owner: p.owner, reviewer: p.reviewer, version: 0, state: 'draft',
      values: { provenance: 'Demo', currency: 'SAR' }, receipts: [], statements: [], history: [],
    } satisfies ClosePaper])),
    exceptions: [], reminders: [], status: 'open', erpStatus: 'Not requested', history: [],
  };
}
export function getCloseInstance(world: World, period = world.closingPeriod): CloseInstance {
  return world.closeWorkspace?.periods[period] ?? makeCloseInstance(period);
}
export function hashClose(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
function nativeSource(world: World, instance: CloseInstance, number: number) {
  if (instance.period !== world.closingPeriod) return { unavailable: true };
  if (number === 6) return [world.bankAccounts, world.bankLines, world.ledger, world.receipts, world.journals.filter(j => ['Bank charges', 'FX difference'].includes(j.kind))];
  if ([7, 10, 11, 20, 21].includes(number)) return [world.journals, world.events, world.invoices, world.receipts];
  if ([4, 5, 17, 18, 19].includes(number)) return [world.events, world.invoices, world.receipts, world.pos];
  if (number === 8) return [world.vendorInvoices, world.vendorPOs];
  if (number === 22) return [world.budget, world.drivers, world.journals];
  return null;
}
export function paperFingerprint(world: World, instance: CloseInstance, paper: ClosePaper) {
  return hashClose({
    period: instance.period, calendar: instance.calendar, materiality: instance.materiality,
    values: paper.values, receipts: paper.receipts, statements: paper.statements, owner: paper.owner, reviewer: paper.reviewer,
    inputs: paper.procedure > 5 ? [1, 2, 3, 4, 5].map(n => {
      const p = instance.papers[String(n)];
      return [p.state, p.acceptedAt, p.reviewedFingerprint];
    }) : undefined, native: nativeSource(world, instance, paper.procedure),
  });
}
export function closeFingerprint(world: World, instance: CloseInstance) {
  return hashClose({
    period: instance.period, calendar: instance.calendar, materiality: instance.materiality,
    papers: CLOSE_PROCEDURES.filter(p => p.number !== 23).map(p => {
      const paper = instance.papers[String(p.number)];
      return [p.number, paper.values, paper.receipts, paper.statements, paper.owner, paper.reviewer, paper.state, paper.reviewedBy, paper.acceptedAt, nativeSource(world, instance, p.number)];
    }), exceptions: instance.exceptions,
  });
}
export function nativeProcedureEvidence(world: World, instance: CloseInstance, number: number): { evidence: string[]; errors: string[] } {
  const evidence: string[] = [], errors: string[] = [];
  if (number === 10) evidence.push(...instance.papers['3'].receipts.map(r => `Inbound purchasing CoC ${r.cocRef}; supplier ${r.vendor}; PO ${r.poRef}; ${r.currency} ${r.amount}; ${r.invoiceRef ? `invoice ${r.invoiceRef}` : 'uninvoiced — accrual assessment required'}.`));
  if (instance.period !== world.closingPeriod) {
    evidence.push(`Native demo snapshot is ${world.closingPeriod}, not ${instance.period}. Supply and review external evidence for this period.`);
    return { evidence, errors };
  }
  if (number === 6) {
    for (const account of world.bankAccounts) {
      const rec = bankRec(world, account.id, instance.period);
      evidence.push(`${account.id}: ${account.currency} statement ${rec.statementBalance}; ledger ${rec.ledgerBalance}; difference ${rec.difference}; ${rec.unmatchedStatement.length + rec.unmatchedLedger.length} outstanding items. ${account.signedOff ? 'Demo signed off' : 'Review outstanding'}.`);
      if (!account.signedOff) errors.push(`Bank ${account.id} reconciliation has not been signed off.`);
      if (!rec.explained) errors.push(`Bank ${account.id} difference is unexplained.`);
      if (rec.adjustmentsProposed) errors.push(`${rec.adjustmentsProposed} bank adjustment journal(s) remain unposted.`);
    }
  }
  if (number === 8) {
    const pending = world.vendorInvoices.filter(v => !['matched', 'rejected'].includes(v.matchStatus));
    evidence.push(`${world.vendorInvoices.length} vendor invoices in the demo register; ${pending.length} not approved.`);
    if (pending.length) errors.push(`${pending.length} native AP invoice approval(s) unresolved.`);
  }
  if ([17, 19].includes(number)) {
    const invoices = world.invoices.filter(i => i.date.startsWith(instance.period));
    const pending = invoices.filter(i => i.status === 'draft' || i.zatca === 'rejected');
    evidence.push(`${invoices.length} period invoices; ${pending.length} drafts / rejected tax records. Delivery evidence remains separate from inbound purchasing CoCs.`);
    if (number === 17 && pending.length) errors.push(`${pending.length} period invoices are not fully recorded / tax-cleared.`);
    if (number === 19) evidence.push('Client delivery events and the recognition schedule are demo evidence, not an independently posted ERP revenue ledger.');
  }
  if (number === 18) {
    const cash = cashStats(world, instance.period);
    evidence.push(`${cash.applied} receipts applied; ${cash.proposed.length} proposals; ${cash.unapplied.length} unapplied.`);
    if (cash.proposed.length + cash.unapplied.length) errors.push(`${cash.proposed.length + cash.unapplied.length} native receipts still require resolution.`);
  }
  if ([7, 10, 11, 20, 21].includes(number)) {
    const journals = world.journals.filter(j => j.period === instance.period);
    const relevant = number === 20 ? journals.filter(j => ['Unbilled revenue accrual', 'Deferred revenue release'].includes(j.kind))
      : number === 7 ? journals.filter(j => ['Bank charges', 'FX difference'].includes(j.kind)) : journals;
    evidence.push(...relevant.map(j => `${j.id}: ${j.kind}; ${j.status}; ${j.erpRef ?? 'no simulated ERP reference'}`));
    if ([7, 20].includes(number)) {
      const pending = relevant.filter(j => j.status !== 'posted');
      if (pending.length) errors.push(`${pending.length} related native journal(s) are not posted.`);
    }
    if (number === 20) evidence.push(`Demo-derived unbilled ${unbilled(world)} SAR; unearned ${deferredBalance(world)} SAR. Review the external roll-forward.`);
    if (number === 21) evidence.push('The existing AR–GL demo uses the same invoice source on both sides; it is not an independent reconciliation. An independent GL export is mandatory.');
  }
  if (number === 22) evidence.push('Existing budget/reforecast explains demo P&L drivers only. Imported P&L, Balance Sheet and a complete balanced trial balance are required; reforecast acceptance does not complete this review.');
  return { evidence, errors: [...new Set(errors)] };
}
export function validatePaper(world: World, instance: CloseInstance, paper: ClosePaper, today = new Date().toISOString().slice(0, 10)): string[] {
  const procedure = procedureByNumber(paper.procedure)!;
  const v = paper.values, errors: string[] = [];
  const number = (key: string) => Number(v[key]);
  const differs = (a: number, b: number) => Math.abs(a - b) > 0.01;
  if (!instance.calendar.confirmed) errors.push('Confirm the working-day calendar and holidays before submission.');
  for (const field of procedure.fields) {
    const value = v[field.key]?.trim() ?? '';
    if (field.required && !value) errors.push(`${field.label} is required.`);
    if (!value) continue;
    if (field.type === 'number' && !Number.isFinite(Number(value))) errors.push(`${field.label} must be a finite number.`);
    if (field.type === 'date' && !validDate(value)) errors.push(`${field.label} must be a valid date.`);
    if (field.type === 'select' && !field.options?.includes(value)) errors.push(`${field.label} is not a supported value.`);
  }
  if (validDate(v.sourceDate) && v.sourceDate > today) errors.push('Source as-of date cannot be in the future.');
  if (validDate(v.sourceDate) && v.sourceDate < `${instance.period}-01`) errors.push('Source evidence is older than this closing period.');
  if (v.sourcePeriod && v.sourcePeriod !== instance.period) errors.push('Evidence reporting period must match the selected close period.');
  if (instance.period !== world.closingPeriod && v.provenance === 'Demo') errors.push('The native demo has no snapshot for this period; provide a manual or imported external result.');
  if (paper.procedure > 5) {
    for (const n of procedure.prerequisites) {
      const p = instance.papers[String(n)];
      if (p.state !== 'accepted' || p.reviewedFingerprint !== paperFingerprint(world, instance, p)) errors.push(`Procedure ${n} must be accepted with current evidence first.`);
    }
  }
  if (paper.procedure === 2 && ['salaries', 'allowances', 'deductions', 'adjustments', 'settlements', 'netPayroll'].every(k => v[k]?.trim())) {
    if (differs(number('salaries') + number('allowances') - number('deductions') + number('adjustments') + number('settlements'), number('netPayroll'))) errors.push('Aggregate payroll components do not reconcile to net payroll.');
  }
  if (paper.procedure === 3) {
    if (!Number.isInteger(number('expectedReceipts')) || number('expectedReceipts') < 0) errors.push('Expected receipts must be a nonnegative whole count.');
    if (number('expectedReceipts') !== paper.receipts.length) errors.push('Purchasing CoC count does not match expected receipts.');
    if (differs(paper.receipts.reduce((s, r) => s + r.amount, 0), number('sourceTotal'))) errors.push('Purchasing CoC amount does not match the receipt control total.');
    for (const r of paper.receipts) {
      if (!r.vendor?.trim() || !r.poRef?.trim() || !r.cocRef?.trim() || !r.description?.trim()) errors.push(`Purchasing receipt ${r.id}: supplier, PO, inbound CoC and description are mandatory.`);
      if (!validDate(r.receivedDate) || !r.receivedDate.startsWith(instance.period)) errors.push(`Purchasing receipt ${r.id}: receipt date must belong to ${instance.period}.`);
      if (!Number.isFinite(r.amount) || r.amount < 0 || r.currency !== v.currency) errors.push(`Purchasing receipt ${r.id}: valid amount and matching currency are required.`);
    }
    if (new Set(paper.receipts.map(r => r.cocRef)).size !== paper.receipts.length) errors.push('Duplicate inbound purchasing CoC references.');
  }
  if ([4, 5].includes(paper.procedure) && differs(number('sourceTotal'), number('invoicedTotal') + number('unbilledTotal'))) errors.push('Delivered schedule total must reconcile to invoices plus documented unbilled services.');
  if (paper.procedure === 10) {
    const receipts = instance.papers['3'].receipts.filter(r => !r.invoiceRef?.trim());
    const expected = receipts.reduce((sum, r) => sum + r.amount, 0);
    if (receipts.length && instance.papers['3'].values.currency !== v.currency) errors.push('CoC accrual currency must match the accepted purchasing receipt workpaper.');
    if (differs(expected, number('sourceTotal')) || differs(expected, number('amount'))) errors.push('CoC accrual source and journal amounts must reconcile to accepted uninvoiced purchasing receipts.');
    if (receipts.some(r => !v.cocRefs?.includes(r.cocRef))) errors.push('CoC accrual references must include every accepted uninvoiced purchasing CoC.');
  }
  if ([8, 17].includes(paper.procedure) && number('pendingInvoices') !== 0) errors.push('Required invoice approvals / ERP recordings remain unresolved.');
  if ([6, 16, 21].includes(paper.procedure) && differs(number('sourceTotal'), number('glTotal'))) errors.push('Independent source / GL reconciliation has an unresolved difference.');
  if (ACCOUNTING_PROCEDURES.includes(paper.procedure)) {
    if (v.jobState !== 'GL posted') errors.push(`Accounting job is ${v.jobState ?? 'Not run'}; GL posted evidence is mandatory.`);
    if (!v.transferRef?.trim() || !v.postingRef?.trim()) errors.push('GL transfer and posting references are mandatory.');
    if (v.jobErrors?.trim()) errors.push(`Unresolved accounting errors: ${v.jobErrors}`);
    if (differs(number('sourceTotal'), number('accountedTotal'))) errors.push('Accounting source and posted control totals do not reconcile.');
  }
  if (paper.procedure === 12 && differs(number('eligibleTotal'), number('transferredTotal'))) errors.push('AP eligible assets and Mass Additions totals differ.');
  if (paper.procedure === 13 && differs(number('completedCip'), number('capitalized'))) errors.push('Completed CIP and capitalized totals differ.');
  if ([10, 11].includes(paper.procedure) && validDate(v.reversalDate) && v.reversalDate <= `${instance.period}-01`) errors.push('Planned reversal must be after the close period starts; it is a plan, not an executed reversal.');
  if (paper.procedure === 22) {
    const tb = paper.statements.filter(r => r.kind === 'Trial balance');
    if (!Number.isInteger(number('expectedAccounts')) || number('expectedAccounts') <= 0) errors.push('Expected trial-balance account count must be a positive whole number.');
    if (!tb.length || tb.length !== number('expectedAccounts')) errors.push('Trial balance account count is incomplete.');
    if (new Set(tb.map(r => r.account)).size !== tb.length) errors.push('Duplicate trial-balance accounts.');
    if (differs(tb.reduce((s, r) => s + r.debit, 0), tb.reduce((s, r) => s + r.credit, 0))) errors.push('Trial balance debits and credits do not balance.');
    for (const kind of ['P&L', 'Balance Sheet']) {
      if (!paper.statements.some(r => r.kind === kind)) errors.push(`${kind} balances are missing.`);
    }
    const statements = paper.statements.filter(r => r.kind !== 'Trial balance');
    for (const row of tb) {
      const mapping = statements.filter(r => r.account === row.account);
      if (mapping.length !== 1) errors.push(`Trial-balance account ${row.account} must appear exactly once in P&L or Balance Sheet.`);
      else if (differs(mapping[0].actual, row.debit - row.credit)) errors.push(`Statement account ${row.account} does not tie to its trial-balance signed balance (debit positive, credit negative).`);
    }
    if (statements.some(r => !tb.some(t => t.account === r.account))) errors.push('A statement account is missing from the trial balance.');
    for (const r of paper.statements) {
      if (!r.account?.trim() || ![r.actual, r.prior, r.budget, r.debit, r.credit].every(Number.isFinite)) errors.push(`Statement line ${r.id} requires an account and finite balances.`);
      if (r.kind !== 'Trial balance' && (Math.abs(r.actual - r.prior) >= instance.materiality || Math.abs(r.actual - r.budget) >= instance.materiality) && !r.commentary?.trim()) errors.push(`Material variance on ${r.account} requires commentary and a correction reference when correction is needed.`);
    }
  }
  if (paper.procedure === 24 && !instance.pack) errors.push('Generate the evidence-based close pack before submitting report review.');
  errors.push(...nativeProcedureEvidence(world, instance, paper.procedure).errors);
  return [...new Set(errors)];
}
export function closeOverview(world: World, period = world.closingPeriod, personaId?: string, today = new Date().toISOString().slice(0, 10)) {
  const instance = getCloseInstance(world, period);
  const procedures: ProcedureView[] = CLOSE_PROCEDURES.map(procedure => {
    const paper = instance.papers[String(procedure.number)];
    const native = nativeProcedureEvidence(world, instance, procedure.number);
    const errors = validatePaper(world, instance, paper, today);
    if (paper.state === 'accepted' && paper.reviewedFingerprint !== paperFingerprint(world, instance, paper)) errors.push('Evidence changed after review; independent re-review required.');
    const due = procedureDeadline(instance, procedure.number);
    const accepted = paper.state === 'accepted' && errors.length === 0;
    const waiting = !accepted && (paper.state === 'submitted' || (procedure.number > 5 && [1, 2, 3, 4, 5].some(n => instance.papers[String(n)].state !== 'accepted')));
    return { ...procedure, paper, due, overdue: !!due && due < today && !accepted,
      status: accepted ? 'Done' : waiting ? 'Waiting for others' : 'Action needed', errors,
      blockers: errors, evidence: native.evidence } as ProcedureView;
  });
  const exceptions: CloseException[] = [...instance.exceptions, ...procedures.flatMap(p => nativeProcedureEvidence(world, instance, p.number).errors.map((title, i) => ({
    id: `native-${p.number}-${i}`, procedure: p.number, title, amount: 0, currency: 'SAR' as const, severity: 'critical' as const,
    owner: p.paper.owner, source: 'native' as const, nonWaivable: true, status: 'open' as const,
  })))];
  const blockers = procedures.filter(p => p.number !== 23 && p.status !== 'Done').map(p => `P${p.number} ${p.title}: ${p.errors[0] ?? `awaiting ${p.paper.state === 'submitted' ? 'independent review' : 'submission'}`}`);
  if (!instance.calendar.confirmed) blockers.unshift('Working-day calendar is not confirmed.');
  blockers.push(...exceptions.filter(e => e.status === 'open').map(e => `${e.id}: ${e.title}`));
  const packCurrent = !!instance.pack && instance.pack.fingerprint === closeFingerprint(world, instance);
  if (!packCurrent) blockers.push('Generate or refresh the evidence-based close pack.');
  return { instance, procedures, blockers, exceptions, ready: blockers.length === 0, packCurrent,
    done: procedures.filter(p => p.status === 'Done').length, waiting: procedures.filter(p => p.status === 'Waiting for others').length,
    actionNeeded: procedures.filter(p => p.status === 'Action needed').length,
    inputsReady: procedures.filter(p => p.number <= 5).every(p => p.status === 'Done'), personaId };
}
export function generatedClosePack(world: World, instance: CloseInstance): string {
  const overview = closeOverview(world, instance.period);
  return [
    `TASAMA MONTHLY CLOSE PACK — ${instance.period}`, `Local workspace: ${instance.status}; ERP closure: ${instance.erpStatus}`,
    'Demo/native actions are simulated; imported/manual references describe external outcomes. No live ERP integration is claimed.',
    `Calendar: ${instance.calendar.confirmed ? 'confirmed' : 'unconfirmed'}; weekend days ${instance.calendar.weekends.join(', ')}; holidays ${instance.calendar.holidays.join(', ') || 'none'}. Materiality: SAR ${instance.materiality}`,
    `Readiness: ${overview.ready ? 'ready for CFO decision' : `${overview.blockers.length} blockers`}`,
    ...overview.procedures.flatMap(p => {
      const values = p.number === 2 ? Object.fromEntries(Object.entries(p.paper.values).filter(([k]) => !['salaries', 'allowances', 'deductions', 'adjustments', 'settlements', 'netPayroll'].includes(k))) : p.paper.values;
      return [`\nP${p.number} ${p.title} — ${p.status}; owner ${p.paper.owner}; reviewer ${p.paper.reviewer}; due ${p.due ?? 'anchor pending'}`,
        `Source policy automation: ${p.automation}; actual evidence: ${values.provenance ?? 'missing'}`, `Evidence: ${JSON.stringify(values)}`,
        ...p.evidence, ...p.errors.map(e => `BLOCKER: ${e}`),
        ...(p.number === 3 ? p.paper.receipts.map(r => `Inbound supplier CoC ${r.cocRef}; PO ${r.poRef}; ${r.currency} ${r.amount}; received ${r.receivedDate}`) : []),
        ...(p.number === 22 ? p.paper.statements.map(r => `${r.kind} ${r.account}: actual ${r.actual}; prior ${r.prior}; budget ${r.budget}; delta ${r.actual - r.budget}; Dr ${r.debit}; Cr ${r.credit}; ${r.commentary}; correction ${r.correctionRef || 'none'}`) : []),
        ...(p.paper.reviewedBy ? [`Review: ${p.paper.reviewedBy}; ${p.paper.acceptedAt}; ${p.paper.reviewNote}`] : [])];
    }), '\nEXCEPTIONS', ...overview.exceptions.map(e => `${e.id} P${e.procedure} ${e.severity} ${e.status}: ${e.title}; ${e.reason ?? ''}`),
    '\nPLANNED REVERSALS — not executed', ...[10, 11].map(n => { const v = instance.papers[String(n)].values; return `P${n}: ${v.reversalDate ?? 'missing'} ${v.reversalRef ?? 'missing'}; amount ${v.amount ?? 'missing'} ${v.currency ?? ''}`; }),
    '\nSIGN-OFF HISTORY', ...instance.history.map(h => `${h.at} ${h.actor} ${h.event}: ${h.reason}`),
  ].join('\n');
}
