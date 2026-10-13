/**
 * Checks on Tasama's 24 closing procedures as Mizan derives them.
 * Run: npm run check:close (or pnpm --filter @workspace/tasama-mizan run check:close)
 */
import { buildWorld } from '@mizan/domain/world';
import { applyAction, type Action } from '@mizan/domain/actions';
import { closeSummary } from '@mizan/domain/derive';
import { SCENARIOS } from '@mizan/domain/scenarios';
import type { World } from '@mizan/domain/types';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failures++; };
const ctx = { personaId: 'noura', now: '2026-10-06T08:00:00.000Z' };
const run = (w: World, actions: Action[]) => actions.reduce((acc, a) => { const r = applyAction(acc, a, ctx); if (r.error) throw new Error(`${a.type}: ${r.error}`); return r.world; }, w);

const w = buildWorld();
const s = closeSummary(w);
const by = (n: number) => s.items.find((i) => i.number === n)!;

check('24 procedures, numbered 1..24 in Tasama\'s order', s.total === 24 && s.items.every((i, k) => i.number === k + 1));
check('inputs are 1–5, finance 6–24', s.items.filter((i) => i.group === 'inputs').map((i) => i.number).join() === '1,2,3,4,5' && s.items.filter((i) => i.group === 'finance').length === 19);
check('Fixed Assets and Leases (12–16) are external, not pretended', [12, 13, 14, 15, 16].every((n) => by(n).status === 'external') && s.external === 5);
check('Tasama\'s automation column is carried verbatim', by(1).tasamaAutomation === 'No' && by(2).tasamaAutomation === 'Check with Department' && by(3).tasamaAutomation === 'Full' && by(11).tasamaAutomation === 'Partial' && by(19).tasamaAutomation === 'No' && by(24).tasamaAutomation === 'No');
check('deadlines are Tasama\'s words', by(1).deadline.startsWith('25th') && by(2).deadline.includes('3 WD') && by(6).deadline.includes('completing 1–5'));
console.log('     Day 4 statuses: ' + s.items.map((i) => `P${i.number}:${i.status.replace('_', ' ')}`).join(' · '));
check('P17 client invoices recorded is blocked on Day 4 (CoC and no-PO events)', by(17).status === 'blocked');
check('P21 AR accounting is blocked by the ZATCA rejection', by(21).status === 'blocked' && /ZATCA/.test(by(21).blocker ?? ''));
check('P6 bank reconciliation in progress with open items named', by(6).status === 'in_progress' && /open item/.test(by(6).blocker ?? ''));
check('P8 AP approvals blocked by the Accenture no-PO invoice', by(8).status === 'blocked' && /Accenture/.test(by(8).blocker ?? ''));
check('P4/P5 delivery schedules derived from the billing events', /evidenced/.test(by(4).evidence ?? '') && /evidenced/.test(by(5).evidence ?? ''));
check('P19/P20 revenue journals not yet posted', by(19).status === 'not_started' && by(20).status === 'not_started');
check('P23 close is blocked while finance procedures are open', by(23).status === 'blocked' && !s.readyToClose);
check('closePeriod is refused on Day 4', !!applyAction(w, { type: 'closePeriod' }, ctx).error);
check('derived procedures cannot be ticked by hand', !!applyAction(w, { type: 'completeCloseItem', id: 'P17' }, ctx).error && !!applyAction(w, { type: 'completeCloseItem', id: 'P12' }, ctx).error);

// Approving the six journals turns P10, P11, P19, P20 green; the reforecast turns P22 green.
const w2 = run(w, [...w.journals.filter((j) => j.status === 'proposed').map((j) => ({ type: 'approveJournal', id: j.id }) as Action), { type: 'acceptReforecast' }]);
const s2 = closeSummary(w2); const by2 = (n: number) => s2.items.find((i) => i.number === n)!;
check('journals approved → P10, P11, P19, P20 done; reforecast → P22 done', [10, 11, 19, 20, 22].every((n) => by2(n).status === 'done'), [10, 11, 19, 20, 22].map((n) => `P${n}:${by2(n).status}`).join(' '));
check('P23 still blocked — the rest of the close is honest', by2(23).status === 'blocked');

// Every scenario can start on the seeded world; its reducer actions apply without error.
for (const sc of SCENARIOS) {
  check(`${sc.key} ${sc.name} can start on the seeded world`, sc.blocked(w) === null, sc.blocked(w) ?? '');
  let cur = w;
  try {
    for (const st of sc.steps) {
      const a = st.action;
      if (a.kind === 'action') cur = run(cur, [a.action]);
      else if (a.kind === 'releaseAllDrafts') cur = run(cur, cur.invoices.filter((i) => i.status === 'draft').map((i) => ({ type: 'releaseInvoice', id: i.id }) as Action));
      else if (a.kind === 'releaseForEvent') { const inv = cur.invoices.find((i) => i.status === 'draft' && i.eventIds.includes(a.eventId)); if (!inv) throw new Error('no draft for ' + a.eventId); cur = run(cur, [{ type: 'releaseInvoice', id: inv.id }]); }
      else if (a.kind === 'applyAllProposed') cur = run(cur, cur.receipts.filter((r) => r.status === 'proposed').map((r) => ({ type: 'applyReceipt', id: r.id }) as Action));
      else if (a.kind === 'approveAllJournals') cur = run(cur, cur.journals.filter((j) => j.status === 'proposed').map((j) => ({ type: 'approveJournal', id: j.id }) as Action));
    }
    check(`${sc.key} steps apply through the reducer (${sc.steps.length} steps, trail +${cur.trail.length - w.trail.length})`, true);
    check(`${sc.key} reports "already run" afterwards`, sc.key === 'S4' ? sc.blocked(cur) === null : sc.blocked(cur) !== null);
  } catch (e) { check(`${sc.key} steps apply through the reducer`, false, (e as Error).message); }
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall close checks passed');
process.exit(failures ? 1 : 0);
