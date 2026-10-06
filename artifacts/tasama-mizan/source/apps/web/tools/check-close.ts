import assert from 'node:assert/strict';
import { buildWorld } from '@mizan/domain/world';
import { applyAction } from '@mizan/domain/actions';
import { CLOSE_PROCEDURES, getCloseInstance, closeOverview, addWorkingDays, procedureDeadline, validatePaper, type CloseCommand, type ClosePaper } from '@mizan/domain/close';
import type { World } from '@mizan/domain/types';

let world = buildWorld();
const period = '2026-08', now = '2026-10-06T10:00:00.000Z';
let assertions = 0;
const check = (value: unknown, message: string) => { assert.ok(value, message); assertions++; };
function run(command: CloseCommand, personaId = 'noura') {
  const result = applyAction(world, { type: 'closeWorkspace', command }, { personaId, now });
  if (!result.error) world = result.world;
  return result;
}
const instance = () => getCloseInstance(world, period);
const paper = (n: number) => instance().papers[String(n)];
const failure = (command: CloseCommand, pattern: RegExp, personaId = 'noura') => {
  const before = JSON.stringify(world);
  assert.match(run(command, personaId).error ?? '', pattern); assertions++;
  assert.equal(JSON.stringify(world), before, 'failed actions must leave the world unchanged'); assertions++;
};
function valuesFor(n: number): ClosePaper['values'] {
  const values = Object.fromEntries(CLOSE_PROCEDURES[n - 1].fields.map(f => [f.key,
    f.type === 'number' ? '0' : f.type === 'date' ? '2026-10-06' : f.type === 'select' ? f.options![0] : `TEST external P${n} reference / reviewed nil return`,
  ]));
  Object.assign(values, { provenance: 'Manual external result', currency: 'SAR', sourcePeriod: period, evidenceRef: `TEST-P${n}`, sourceDate: '2026-10-06' });
  if (values.jobState) values.jobState = 'GL posted';
  if ('jobErrors' in values) values.jobErrors = '';
  if (n === 22) values.expectedAccounts = '2';
  return values;
}
function save(n: number, values = valuesFor(n), actor = paper(n).owner) {
  const statements = n === 22 ? [
    { id: 'tb1', account: 'Cash', kind: 'Trial balance' as const, actual: 0, prior: 0, budget: 0, debit: 100, credit: 0, commentary: '', correctionRef: '' },
    { id: 'tb2', account: 'Revenue', kind: 'Trial balance' as const, actual: 0, prior: 0, budget: 0, debit: 0, credit: 100, commentary: '', correctionRef: '' },
    { id: 'bs1', account: 'Cash', kind: 'Balance Sheet' as const, actual: 100, prior: 100, budget: 100, debit: 0, credit: 0, commentary: 'Test cash roll-forward', correctionRef: '' },
    { id: 'pl1', account: 'Revenue', kind: 'P&L' as const, actual: -100, prior: -100, budget: -100, debit: 0, credit: 0, commentary: 'Test signed credit balance', correctionRef: '' },
  ] : [];
  assert.equal(run({ kind: 'save', period, procedure: n, expectedVersion: paper(n).version, values, receipts: [], statements }, actor).error, undefined); assertions++;
}
function submit(n: number, actor = paper(n).owner) {
  assert.equal(run({ kind: 'submit', period, procedure: n, expectedVersion: paper(n).version }, actor).error, undefined); assertions++;
}
function accept(n: number, actor = paper(n).reviewer) {
  assert.equal(run({ kind: 'review', period, procedure: n, expectedVersion: paper(n).version, decision: 'accept', reason: 'Independent TEST evidence review complete.' }, actor).error, undefined); assertions++;
}

check(CLOSE_PROCEDURES.length === 24, 'exactly 24 procedures');
check(new Set(CLOSE_PROCEDURES.map(p => p.number)).size === 24, 'unique procedure numbers');
check(!closeOverview(world).ready, 'legacy checklist cannot bypass new close gate');
assert.equal(addWorkingDays('2026-09-24', 2, { confirmed: true, weekends: [5, 6], holidays: ['2026-09-27'] }), '2026-09-29'); assertions++;
run({ kind: 'initialize', period });
check(!instance().calendar.confirmed, 'calendar suggestion not confirmed');
check(procedureDeadline(instance(), 2) === null, 'unknown payroll anchor is explicit');
failure({ kind: 'calendar', period, expectedVersion: 0, confirmed: true, weekends: [0, 1, 2, 3, 4, 5, 6], holidays: [], materiality: 10000 }, /working day/);
run({ kind: 'calendar', period, expectedVersion: instance().version, confirmed: true, weekends: [5, 6], holidays: [], materiality: 10000 });
failure({ kind: 'close', period, expectedVersion: instance().version }, /blocked/i);
failure({ kind: 'close', period, expectedVersion: instance().version }, /Only the CFO/, 'reem');
save(7);
failure({ kind: 'submit', period, procedure: 7, expectedVersion: paper(7).version }, /Procedure 1/, 'omar');
for (const n of [1, 2, 3, 4, 5]) {
  save(n); submit(n);
  failure({ kind: 'review', period, procedure: n, expectedVersion: paper(n).version, decision: 'accept', reason: 'Self approved test data.' }, /review|reviewer/i, paper(n).owner);
  if (n === 2) {
    assert.equal(run({ kind: 'review', period, procedure: n, expectedVersion: paper(n).version, decision: 'return', reason: 'Please provide clearer payroll evidence.' }, 'reem').error, undefined);
    save(n); submit(n);
  }
  accept(n);
}
check(closeOverview(world, period).inputsReady, 'all inputs accepted');
assert.equal(procedureDeadline(instance(), 6), '2026-10-08'); assertions++;
assert.equal(procedureDeadline(instance(), 2), '2026-10-11'); assertions++;
save(7, { ...valuesFor(7), jobState: 'Error', jobErrors: 'Posting validation failed.' });
failure({ kind: 'submit', period, procedure: 7, expectedVersion: paper(7).version }, /errors|GL posted/, 'omar');
save(7);
const oldVersion = paper(7).version;
save(7);
failure({ kind: 'submit', period, procedure: 7, expectedVersion: oldVersion }, /changed/ , 'omar');
for (let n = 6; n <= 22; n++) { save(n); submit(n); accept(n); }
check(paper(22).statements.length === 4, 'statement rows persisted');
const badStatement = structuredClone(paper(22)); badStatement.statements[2].actual = 101;
check(validatePaper(world, instance(), badStatement).some(e => e.includes('does not tie')), 'statements tie to independent TB');
save(23); submit(23);
failure({ kind: 'review', period, procedure: 23, expectedVersion: paper(23).version, decision: 'accept', reason: 'Final review approved.' }, /CFO sign-off/);
run({ kind: 'pack', period, expectedVersion: instance().version });
save(24); submit(24); accept(24);
check(!closeOverview(world, period).packCurrent, 'new report evidence invalidates prior pack');
run({ kind: 'pack', period, expectedVersion: instance().version });
check(closeOverview(world, period).ready, 'evidence-backed close ready only after all reviews');
run({ kind: 'exception', period, expectedVersion: instance().version, procedure: 11, title: 'TEST critical unresolved posting error', amount: 1, currency: 'SAR', severity: 'critical' });
const critical = instance().exceptions.at(-1)!;
failure({ kind: 'decideException', period, expectedVersion: instance().version, id: critical.id, decision: 'waive', reason: 'Waive for testing only.' }, /non-waivable/);
failure({ kind: 'close', period, expectedVersion: instance().version }, /blocked/i);
run({ kind: 'decideException', period, expectedVersion: instance().version, id: critical.id, decision: 'resolve', reason: 'TEST corrected external posting ref FIX-001.' }, 'reem');
run({ kind: 'pack', period, expectedVersion: instance().version });
const readySnapshot = structuredClone(world);
assert.equal(run({ kind: 'close', period, expectedVersion: instance().version }).error, undefined); assertions++;
check(instance().status === 'closed', 'CFO close locks local snapshot');
check(instance().erpStatus === 'Not requested', 'local close is not ERP closure');
failure({ kind: 'save', period, procedure: 1, expectedVersion: paper(1).version, values: valuesFor(1), receipts: [], statements: [] }, /locked/, 'omar');
failure({ kind: 'reopen', period, expectedVersion: instance().version, reason: 'Reopen for testing.' }, /Only CFO/, 'reem');
run({ kind: 'requestErpClosure', period, expectedVersion: instance().version });
run({ kind: 'confirmErpClosure', period, expectedVersion: instance().version, reference: 'TEST ERP PERIOD CLOSED', evidence: 'TEST external confirmation, no ERP integration' });
check(instance().erpStatus === 'Externally confirmed', 'external closure requires distinct evidence');
run({ kind: 'reopen', period, expectedVersion: instance().version, reason: 'TEST reviewed correction requires local reopen.' });
check(instance().status === 'open' && instance().erpStatus === 'Externally confirmed', 'local reopen does not reopen external ERP');

world = structuredClone(readySnapshot);
save(2);
check(paper(2).state === 'draft', 'replaced payroll evidence needs new review');
check(paper(6).state === 'returned' && !paper(6).acceptedAt, 'changed inputs invalidate dependent reviews');
check(!closeOverview(world, period).ready && !closeOverview(world, period).packCurrent, 'changed evidence invalidates readiness and pack');
assert.equal(run({ kind: 'remind', period, procedure: 2, expectedVersion: paper(2).version, note: 'TEST payroll clarification requested.' }).error, undefined);
failure({ kind: 'remind', period, procedure: 2, expectedVersion: paper(2).version, note: 'TEST payroll clarification requested.' }, /already recorded/);
run({ kind: 'initialize', period: '2026-09' });
const next = getCloseInstance(world, '2026-09');
check(next.papers['2'].state === 'draft' && !next.papers['2'].acceptedAt && !next.papers['2'].values.netPayroll, 'next-month template never carries evidence or approvals');
check(!next.calendar.confirmed, 'calendar must be confirmed for each close period');
const serialized = JSON.parse(JSON.stringify(world)) as World;
check(getCloseInstance(serialized, period).papers['2'].history.length > 0, 'history survives JSON persistence');
check(world.vendorInvoices.length === buildWorld().vendorInvoices.length, 'legacy world preserved');
console.log(`Close workspace: ${assertions} assertions passed; all 24 procedure flows, deadlines, evidence, stale versions, statements, exceptions, close/reopen and period isolation verified.`);
