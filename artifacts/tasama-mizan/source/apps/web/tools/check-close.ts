/**
 * Checks on Tasama's 24 closing procedures (plus the VAT line) as Mizan derives them,
 * and on every Director scenario through the reducer.
 * Run: npm run check:close (or pnpm --filter @workspace/tasama-mizan run check:close)
 */
import { buildWorld } from '@mizan/domain/world';
import { applyAction, type Action } from '@mizan/domain/actions';
import { closeSummary, marginByClient, monthlyPnl, payrollSummary, vatFigures } from '@mizan/domain/derive';
import { SCENARIOS, type Scenario } from '@mizan/domain/scenarios';
import { SAMPLE_DOCS } from '@mizan/domain/cognidocs';
import type { ParseJob, World } from '@mizan/domain/types';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failures++; };
const ctx = { personaId: 'noura', now: '2026-10-06T08:00:00.000Z' };
const run = (w: World, actions: Action[]) => actions.reduce((acc, a) => { const r = applyAction(acc, a, ctx); if (r.error) throw new Error(`${a.type}: ${r.error}`); return r.world; }, w);

const w = buildWorld();
const s = closeSummary(w);
const by = (n: number, items = s.items) => items.find((i) => i.number === n)!;

check('24 procedures in Tasama\'s order plus line 25 added by Cognirise', s.total === 25 && s.tasama === 24 && s.items.every((i, k) => i.number === k + 1) && by(25).group === 'added');
check('inputs are 1–5, finance 6–24', s.items.filter((i) => i.group === 'inputs').map((i) => i.number).join() === '1,2,3,4,5' && s.items.filter((i) => i.group === 'finance').length === 19);
check('Fixed Assets and Leases (12–16) are ERP jobs read back, not pretended and not "outside"', [12, 13, 14, 15, 16].every((n) => by(n).coverage === 'erp-job') && s.external === 0);
check('Day 4: FA additions, CIP and leases ran; depreciation scheduled; Create Accounting FA not run', by(12).status === 'done' && by(13).status === 'done' && by(15).status === 'done' && by(14).status === 'in_progress' && by(16).status === 'not_started');
check('Tasama\'s automation column is carried verbatim', by(1).tasamaAutomation === 'No' && by(2).tasamaAutomation === 'Check with Department' && by(3).tasamaAutomation === 'Full' && by(11).tasamaAutomation === 'Partial' && by(19).tasamaAutomation === 'No' && by(24).tasamaAutomation === 'No' && by(25).tasamaAutomation === 'Not in list');
check('deadlines are Tasama\'s words', by(1).deadline.startsWith('25th') && by(2).deadline.includes('3 WD') && by(6).deadline.includes('completing 1–5'));
console.log('     Day 4 statuses: ' + s.items.map((i) => `P${i.number}:${i.status.replace('_', ' ')}`).join(' · '));
check('P1 closing coordination is in progress: HR\'s register is late and was chased twice', by(1).status === 'in_progress' && /HR/.test(by(1).blocker ?? '') && /reminded 2×/.test(by(1).blocker ?? ''));
check('P2 payroll is blocked on Day 4: register 4 WD late', by(2).status === 'blocked' && /4 WD late/.test(by(2).blocker ?? ''), by(2).blocker);
check('P11 all costs waits for payroll', by(11).status === 'not_started' && /Payroll/.test(by(11).blocker ?? ''));
check('P17 client invoices recorded is blocked on Day 4 (CoC and no-PO events)', by(17).status === 'blocked');
check('P21 AR accounting is blocked by the ZATCA rejection', by(21).status === 'blocked' && /ZATCA/.test(by(21).blocker ?? ''));
check('P6 bank reconciliation in progress with open items named', by(6).status === 'in_progress' && /open item/.test(by(6).blocker ?? ''));
check('P8 AP approvals blocked by the Accenture no-PO invoice', by(8).status === 'blocked' && /Accenture/.test(by(8).blocker ?? ''));
check('P25 VAT return can be prepared (no September invoice rejected) but names the input VAT it cannot claim', by(25).status === 'not_started' && /not claimable/.test(by(25).blocker ?? ''), by(25).blocker);
check('P23 close is blocked while inputs and finance procedures are open', by(23).status === 'blocked' && !s.readyToClose && /input/.test(by(23).blocker ?? ''));
check('closePeriod is refused on Day 4', !!applyAction(w, { type: 'closePeriod' }, ctx).error);
check('derived procedures cannot be ticked by hand', !!applyAction(w, { type: 'completeCloseItem', id: 'P17' }, ctx).error && !!applyAction(w, { type: 'completeCloseItem', id: 'P12' }, ctx).error);

// Payroll: the register's net pay is the WPS line on the SNB statement; the August run-rate carries the margin until it is in.
const ps = payrollSummary(w)!;
check('September payroll awaited; net pay equals the WPS bank line Tasweya matched', ps.run.status === 'awaited' && !!ps.bankLine && Math.abs(ps.bankLine.amount) === ps.run.netPay, `net ${ps.run.netPay} · bank ${ps.bankLine?.amount}`);
check('register arithmetic ties: gross − employee GOSI − deductions = net; employer cost = gross + employer GOSI + provisions', ps.run.grossPay - ps.run.gosiEmployee - ps.run.otherDeductions === ps.run.netPay && ps.run.grossPay + ps.run.gosiEmployer + ps.run.eosbProvision + ps.run.leaveProvision + ps.run.bonusAccrual === ps.run.employerCost && ps.run.basic + ps.run.allowances + ps.run.overtime === ps.run.grossPay);
check('allocations sum to the employer cost', Math.abs(ps.run.allocations.reduce((x, a) => x + a.cost, 0) - ps.run.employerCost) < 0.01);
check('GOSI August paid on 14 Sep equals the August run\'s GOSI', w.bankLines.some((b) => b.date === '2026-09-14' && Math.abs(b.amount) === 133_800) && w.payrollRuns[0].gosiEmployee + w.payrollRuns[0].gosiEmployer === 133_800);
check('margin by client uses the August run-rate until September is booked', marginByClient(w).estimate && marginByClient(w).payrollPeriod === '2026-08');
const vf = vatFigures(w);
check('VAT August paid on 28 Sep equals the filed August return', w.bankLines.some((b) => b.date === '2026-09-28' && Math.abs(b.amount) === 99_916.54) && w.vatReturns[0].figures?.netPayable === 99_916.54);
check('September VAT: output on cleared September invoices, Accenture input VAT held back', vf.salesCount === 12 && vf.inputVat === 0 && vf.deferredInputVat === 42_000 && vf.netPayable === vf.outputVat, `output ${vf.outputVat} · deferred ${vf.deferredInputVat}`);

const w2 = run(w, [{ type: 'receivePayrollRegister' }, { type: 'approvePayroll', id: 'PR-2026-09' }]);
const r2 = w2.payrollRuns.find((r) => r.period === '2026-09')!;
check('register received: proof passes three ways; two journals proposed', r2.status === 'proved' && !!r2.proof && r2.proof.bankTies && r2.proof.glTies && r2.proof.headcountTies && r2.journalIds.length === 2, r2.proof?.note);
const jp = w2.journals.filter((j) => r2.journalIds.includes(j.id));
check('payroll journals balance', jp.every((j) => Math.abs(j.lines.reduce((x, l) => x + l.dr - l.cr, 0)) < 0.01) && Math.abs(jp.reduce((x, j) => x + j.lines.reduce((y, l) => y + l.dr, 0), 0) - r2.employerCost) < 0.01);
const w3 = run(w2, r2.journalIds.map((id) => ({ type: 'approveJournal', id }) as Action));
const s3 = closeSummary(w3);
check('journals posted → payroll booked, P2 done; margin now from the September register', w3.payrollRuns.find((r) => r.period === '2026-09')!.status === 'posted' && by(2, s3.items).status === 'done' && !marginByClient(w3).estimate);
const pnl = monthlyPnl(w3);
console.log(`     September P&L: revenue ${Math.round(pnl.revenue).toLocaleString()} · vendor ${Math.round(pnl.vendor).toLocaleString()} · delivery payroll ${pnl.delivery.toLocaleString()} · GM ${(pnl.grossMarginPct * 100).toFixed(1)}% · G&A ${pnl.overhead.toLocaleString()} · operating ${Math.round(pnl.operating).toLocaleString()}`);
check('September gross margin is near the 23% target with payroll in (the honest number)', pnl.grossMarginPct > 0.15 && pnl.grossMarginPct < 0.35);
check('REDC shows cost without revenue until its PO cover is recorded', marginByClient(w3).rows.some((r) => r.client.id === 'redc' && r.revenue === 0 && r.staffCost > 0 && r.marginPct === null));

// Approving the six journals turns P10, P19, P20 green; P11 with payroll; the reforecast turns P22 green.
const w4 = run(w3, [...w3.journals.filter((j) => j.status === 'proposed').map((j) => ({ type: 'approveJournal', id: j.id }) as Action), { type: 'acceptReforecast' }]);
const s4 = closeSummary(w4);
check('journals approved → P10, P11, P19, P20 done; reforecast → P22 done', [10, 11, 19, 20, 22].every((n) => by(n, s4.items).status === 'done'), [10, 11, 19, 20, 22].map((n) => `P${n}:${by(n, s4.items).status}`).join(' '));
check('bank charges journal matched the SNB service-charge line', w4.bankLines.filter((b) => b.type === 'charge').every((b) => !!b.matchedLedgerId));
check('P23 still blocked — the rest of the close is honest', by(23, s4.items).status === 'blocked');

// VAT: refuse while an invoice of the period is rejected; prepare freezes; approve posts the settlement.
const rejectedSep = { ...w4, invoices: w4.invoices.map((i) => (i.id === 'DEMO-2026090001' ? { ...i, zatca: 'rejected' as const } : i)) } as World;
check('prepareVatReturn is refused while a September invoice is rejected by ZATCA', !!applyAction(rejectedSep, { type: 'prepareVatReturn' }, ctx).error);
const w5 = run(w4, [{ type: 'prepareVatReturn' }, { type: 'approveVatReturn', id: 'VAT-2026-09' }]);
const vr = w5.vatReturns.find((v) => v.period === '2026-09')!;
check('VAT return prepared and approved; settlement journal posted; P25 done', vr.status === 'approved' && !!vr.figures && !!vr.journalId && w5.journals.find((j) => j.id === vr.journalId)?.status === 'posted' && by(25, closeSummary(w5).items).status === 'done');

// Every scenario can start on the seeded world (S9 after S7); its reducer actions apply without error.
const play = (start: World, sc: Scenario) => {
  let cur = start;
  for (const st of sc.steps) {
    const a = st.action;
    if (a.kind === 'action') cur = run(cur, [a.action]);
    else if (a.kind === 'releaseAllDrafts') cur = run(cur, cur.invoices.filter((i) => i.status === 'draft').map((i) => ({ type: 'releaseInvoice', id: i.id }) as Action));
    else if (a.kind === 'releaseForEvent') { const inv = cur.invoices.find((i) => i.status === 'draft' && i.eventIds.includes(a.eventId)); if (!inv) throw new Error('no draft for ' + a.eventId); cur = run(cur, [{ type: 'releaseInvoice', id: inv.id }]); }
    else if (a.kind === 'applyAllProposed') cur = run(cur, cur.receipts.filter((r) => r.status === 'proposed').map((r) => ({ type: 'applyReceipt', id: r.id }) as Action));
    else if (a.kind === 'approveAllJournals') cur = run(cur, cur.journals.filter((j) => j.status === 'proposed').map((j) => ({ type: 'approveJournal', id: j.id }) as Action));
    else if (a.kind === 'approvePayrollJournals') { const r = cur.payrollRuns.find((x) => x.period === cur.closingPeriod)!; cur = run(cur, r.journalIds.filter((id) => cur.journals.find((j) => j.id === id)?.status === 'proposed').map((id) => ({ type: 'approveJournal', id }) as Action)); }
    else if (a.kind === 'fixZatcaAll') cur = run(cur, cur.invoices.filter((i) => i.zatca === 'rejected').map((i) => ({ type: 'fixZatca', invoiceId: i.id, vatNo: '300455000000003' }) as Action));
    else if (a.kind === 'approveAllVendorMatches') cur = run(cur, cur.vendorInvoices.filter((v) => v.matchStatus === 'proposed').map((v) => ({ type: 'approveVendor', id: v.id }) as Action));
    else if (a.kind === 'signOffAllBankRecs') cur = run(cur, cur.bankAccounts.filter((b) => !b.signedOff).map((b) => ({ type: 'signOffBankRec', accountId: b.id }) as Action));
    else if (a.kind === 'upload') {
      const sample = SAMPLE_DOCS.find((x) => x.id === a.sample)!;
      const job: ParseJob = { id: `JOB-${a.sample}-${cur.jobs.length}`, declaredType: sample.declaredType, detectedType: sample.declaredType, status: 'completed', fileName: sample.fileName, mimeType: 'application/pdf', fileSizeBytes: 1, startedAt: ctx.now, parserPath: 'test', confidence: 97, error: null, aiPromptTokens: 0, aiCompletionTokens: 0, aiCostAmount10k: 0, sandbox: true, result: sample.result(), createdAt: ctx.now, completedAt: ctx.now, mode: 'simulated' };
      cur = run(cur, [{ type: 'addJob', job }, { type: 'routeJob', jobId: job.id }]);
    }
  }
  return cur;
};
const byKey = (k: string) => SCENARIOS.find((x) => x.key === k)!;
const prereq = ['S1', 'S2', 'S3', 'S5', 'S7'].reduce((acc, k) => play(acc, byKey(k)), w);
for (const sc of SCENARIOS) {
  const start = sc.key === 'S8' ? prereq : w;
  check(`${sc.key} ${sc.name} can start on the ${sc.key === 'S8' ? 'world after S1, S2, S3, S5, S7' : 'seeded world'}`, sc.blocked(start) === null, sc.blocked(start) ?? '');
  try {
    const cur = play(start, sc);
    check(`${sc.key} steps apply through the reducer (${sc.steps.length} steps, trail +${cur.trail.length - start.trail.length})`, true);
    check(`${sc.key} reports "already run" afterwards`, sc.key === 'S4' ? sc.blocked(cur) === null : sc.blocked(cur) !== null);
    if (sc.key === 'S8') { const cs = closeSummary(cur); check('S8 ends with September closed: procedures 1–24 done, pack issued', cur.flags.periodClosed && cs.items.filter((i) => i.number <= 24).every((i) => i.status === 'done'), cs.items.filter((i) => i.number <= 24 && i.status !== 'done').map((i) => `P${i.number}:${i.status}`).join(' ')); }
  } catch (e) { check(`${sc.key} steps apply through the reducer`, false, (e as Error).message); }
}
check('S8 close-out is blocked on the seeded world until S7 has run', /S7/.test(byKey('S8').blocked(w) ?? ''));
check('S8 is blocked after S7 alone until S1, S2, S3 and S5 have run', /S1, S2, S3, S5/.test(byKey('S8').blocked(play(w, byKey('S7'))) ?? ''), byKey('S8').blocked(play(w, byKey('S7'))) ?? '');
// All nine in order on one world, the way the room runs them.
let all = w; for (const sc of SCENARIOS) all = play(all, sc);
const csAll = closeSummary(all);
check('S1 → S9 on one world: period closed, VAT approved, every Tasama procedure done', all.flags.periodClosed && csAll.items.every((i) => i.status === 'done'), csAll.items.filter((i) => i.status !== 'done').map((i) => `P${i.number}:${i.status}`).join(' '));
const vrAll = all.vatReturns.find((v) => v.period === '2026-09')!;
check('the September return prepared after the close claims the Masterworks input VAT and names the Accenture VAT it cannot', vrAll.figures!.inputVat === 40_500 && vrAll.figures!.purchaseRefs.length === 1 && vrAll.figures!.excluded.some((x) => /ACN-SA-26-0533/.test(x.ref)), `input ${vrAll.figures!.inputVat} · excluded ${vrAll.figures!.excluded.map((x) => x.ref).join(', ')}`);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall close checks passed');
process.exit(failures ? 1 : 0);
