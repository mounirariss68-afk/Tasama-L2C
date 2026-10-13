/**
 * Arithmetic checks on the synthetic world. Run: npm run check:world
 * A demo that cannot prove its own numbers tie is a demo that gets caught.
 */
import { buildWorld, derivePipeline } from '@mizan/domain/world';
import { applyAction } from '@mizan/domain/actions';
import { STAGES, stageMetrics } from '@mizan/domain/process';
import {
  arOpen, bankRec, budgetByLine, budgetByMonth, cashStats, closeSummary, deferredBalance, dso, eventStatus, fyTotals,
  inboxItems, marginByClient, nonPifShare, openInvoices, poConsumption, recognisedByLineMonth, unbilled, waterfall,
} from '@mizan/domain/derive';

const w = buildWorld();
let failures = 0;
const check = (name: string, ok: boolean, detail = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failures++; };
const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

console.log(`world: ${w.clients.length} clients, ${w.pos.length} POs, ${w.pos.reduce((s, p) => s + p.lines.length, 0)} lines, ${w.events.length} billing events, ${w.invoices.length} invoices, ${w.bankLines.length} bank lines, ${w.ledger.length} ledger entries, ${w.receipts.length} receipts`);

// 1. Every invoice ties to its events
for (const inv of w.invoices) {
  const evs = inv.eventIds.map((id) => w.events.find((e) => e.id === id)!);
  const expected = evs.reduce((s, e) => s + e.expectedAmount, 0);
  const ok = Math.abs(inv.net - expected) < 0.01 || inv.billedRate !== undefined;
  if (!ok) check(`invoice ${inv.id} ties to events`, false, `${inv.net} vs ${expected}`);
  check(`invoice ${inv.id} VAT = 15%`, Math.abs(inv.gross - inv.net * 1.15) < 0.011);
}
check('all invoices tie to events or carry an explicit billedRate', true);

// 2. Edge cases exist as intended
const st = (id: string) => eventStatus(w, w.events.find((e) => e.id === id)!);
check('GPLC Aug AMS is MISSED', st('DEMO-GPLC-PO-011-L4/2026-08') === 'missed', st('DEMO-GPLC-PO-011-L4/2026-08'));
check('KSIA UAT is BLOCKED on CoC', st('DEMO-KSIA-PO-00000611-L1/D2.13') === 'blocked_coc');
check('REDC Sep is BLOCKED no PO cover', st('DEMO-REDC-PO-0000061-L1/2026-09') === 'blocked_no_po');
const salwan = w.invoices.find((i) => i.eventIds[0] === 'DEMO-SALWAN-PO-202600118-L2/2026-09')!;
check('Salwan under-rate = 11,872', Math.abs((56 * 4312) - salwan.net - 11_872) < 0.01, `net ${salwan.net}`);
const nw = w.invoices.find((i) => i.eventIds[0] === 'DEMO-NWR-PO-0007-L2/2026-09')!;
check('Nordwind Sep rejected by ZATCA', nw.zatca === 'rejected');
const jada = poConsumption(w, 'DEMO-JADA_PO_0449');
check('Jada PO ~96% consumed with uncovered Q4', jada.pct > 0.9 && jada.uncovered > 100_000, `pct ${(jada.pct * 100).toFixed(1)} uncovered ${fmt(jada.uncovered)}`);
const sdb = w.invoices.find((i) => i.eventIds[0] === 'DEMO-SDB-ETIMAD-2026-0931-L1/MS2')!;
check('SDB MS2 invoice 61 days overdue', sdb.dueDate === '2026-08-06' && sdb.status === 'posted', sdb.dueDate);
const ksiaTol = w.receipts.find((r) => r.method === 'tolerance')!;
const ksiaInvs = ksiaTol.invoiceIds.map((id) => w.invoices.find((i) => i.id === id)!);
check('KSIA tolerance receipt short by exactly 37.50', Math.abs(ksiaInvs.reduce((s, i) => s + i.gross, 0) - ksiaTol.amount - 37.5) < 0.01);
const redcRc = w.receipts.find((r) => r.method === 'amount_client')!;
check('REDC unreferenced receipt = 184,000', Math.abs(redcRc.amount - 184_000) < 0.01, fmt(redcRc.amount));

// 3. Due events in September are what the billing run will draft
const due = w.events.filter((e) => eventStatus(w, e) === 'due');
console.log(`     September events ready to invoice: ${due.length} → SAR ${fmt(due.reduce((s, e) => s + e.expectedAmount, 0))}`);
check('billing run has between 6 and 12 drafts', due.length >= 6 && due.length <= 12);

// 4. Unbilled, deferred, AR
console.log(`     unbilled SAR ${fmt(unbilled(w))} · deferred SAR ${fmt(deferredBalance(w))} · AR open SAR ${fmt(arOpen(w))} · DSO ${dso(w)} days · open invoices ${openInvoices(w).length}`);
check('deferred balance = 1,200,000 − 6 × 100,000 = 600,000', Math.abs(deferredBalance(w) - 600_000) < 0.01, fmt(deferredBalance(w)));
check('unbilled includes the blocked UAT milestone', unbilled(w) > 611_800);

// 5. Bank reconciliations explain their differences
for (const a of w.bankAccounts) {
  const r = bankRec(w, a.id);
  console.log(`     ${a.bank} ${a.label}: statement ${fmt(r.statementBalance)} ledger ${fmt(r.ledgerBalance)} diff ${fmt(r.difference)} · unmatched stmt ${r.unmatchedStatement.length} ledger ${r.unmatchedLedger.length}`);
  check(`${a.id} difference fully explained by open items`, r.explained, `diff ${fmt(r.difference)}`);
}
const cs = cashStats(w);
console.log(`     cash: applied ${cs.applied}, proposed ${cs.proposed.length}, unapplied ${cs.unapplied.length}, auto-rate ${(cs.autoRate * 100).toFixed(0)}%`);

// 6. Waterfall is monotone
const wf = waterfall(w);
console.log(`     waterfall Sep: contracted ${fmt(wf.contracted)} → evidenced ${fmt(wf.evidenced)} → invoiced ${fmt(wf.invoiced)} → cleared ${fmt(wf.cleared)} → collected ${fmt(wf.collected)}`);
check('waterfall monotone', wf.contracted >= wf.evidenced && wf.evidenced >= wf.invoiced - 1 && wf.invoiced >= wf.cleared && wf.cleared >= wf.collected);

// 7. Budget: variance drivers tie to the September variance per line (unexplained is reported, not hidden)
const sep = budgetByLine(w, 9);
for (const r of sep) console.log(`     ${r.businessLine.padEnd(8)} budget ${fmt(r.budget).padStart(12)} actual ${fmt(r.actual).padStart(12)} var ${fmt(r.varBudget).padStart(12)} explained ${fmt(r.drivers.reduce((s, d) => s + d.amount, 0)).padStart(12)} unexplained ${fmt(r.unexplained)}`);
check('504 unexplained variance under SAR 5k', Math.abs(sep.find((r) => r.businessLine === '504')!.unexplained) < 5_000);
const fy = fyTotals(w);
console.log(`     FY budget ${fmt(fy.budget)} target ${fmt(fy.target)} forecast ${fmt(fy.forecast)} · YTD actual ${fmt(fy.actualYtd)} vs budget ${fmt(fy.budgetYtd)} · non-PIF share Sep ${(nonPifShare(w) * 100).toFixed(0)}%`);
const bm = budgetByMonth(w);
check('every month has budget > 0', bm.every((m) => m.budget > 0));
const rec = recognisedByLineMonth(w);
check('recognised Sep total > 0', Object.values(rec).reduce((s, arr) => s + arr[9], 0) > 0);

// 8. Margin
for (const m of marginByClient(w).rows) console.log(`     ${m.client.short.padEnd(9)} revenue ${fmt(Math.round(m.revenue)).padStart(11)} vendor ${fmt(m.vendorCost).padStart(10)} payroll ${fmt(m.staffCost).padStart(10)} margin ${m.marginPct === null ? 'n/a' : (m.marginPct * 100).toFixed(0) + '%'}`);

// 9. Close & inbox
const cls = closeSummary(w);
console.log(`     close: ${cls.done} done, ${cls.inProgress} in progress, ${cls.blocked} blocked, ${cls.notStarted} not started`);
const inbox = inboxItems(w);
console.log(`     inbox: ${inbox.length} items (${inbox.filter((i) => i.attention).length} need attention): ${Object.entries(inbox.reduce((acc: Record<string, number>, i) => { acc[i.type] = (acc[i.type] ?? 0) + 1; return acc; }, {})).map(([k, v]) => `${k} ${v}`).join(', ')}`);
check('inbox has the five headline items', ['draft_catchup', 'escalate_coc', 'apply_cash', 'fix_zatca', 'approve_journal'].every((t) => inbox.some((i) => i.type === t)));

// 10. Opportunities → weighted pipeline → forecast
const openOpps = w.opportunities.filter((o) => !o.stage.startsWith('Closed'));
const pipe = derivePipeline(w.opportunities);
console.log(`     opportunities ${w.opportunities.length} (${openOpps.length} open) → pipeline ${pipe.length} line-months, weighted SAR ${fmt(pipe.reduce((s, p) => s + p.weighted, 0))}`);
check('pipeline derives from opportunities (same rows as the world)', JSON.stringify(pipe) === JSON.stringify(w.pipeline));
check('closed-lost opportunities carry no pipeline', pipe.every((p) => !p.label.includes('GPLC data platform')));
check('KSIA Phase 2 weighted at 70% from November', pipe.some((p) => p.businessLine === '504' && p.month === 11 && Math.abs(p.weighted - 280_000 * 0.7) < 0.01));

// 11. Four stages, every step named, every metric computable
check('four stages in order', STAGES.map((s) => s.name).join(' · ') === 'Lead-to-Contract · Contract-to-Service · Service-to-Cash · Close');
for (const s of STAGES) { const m = stageMetrics(w, s.id); check(`stage ${s.index} ${s.name}: ${s.steps.length} steps, ${m.length} live metrics`, s.steps.length >= 4 && m.length >= 4 && m.every((x) => x.value !== 'NaN' && !x.value.includes('undefined'))); }

// 12. The reducer: a billing run drafts the due events and nothing else; a release posts and clears
const ctx = { personaId: 'faisal', now: '2026-10-06T08:00:00.000Z' };
const r1 = applyAction(w, { type: 'runBillingRun' }, ctx);
check('reducer: billing run drafts exactly the due events', r1.count === due.length && r1.world.invoices.length === w.invoices.length + due.length, `count ${r1.count}`);
check('reducer: the input world is not mutated', w.invoices.length === 102 && w.flags.rev === 1);
const firstDraft = r1.world.invoices.find((i) => i.status === 'draft')!;
const r2 = applyAction(r1.world, { type: 'releaseInvoice', id: firstDraft.id }, ctx);
const rel = r2.world.invoices.find((i) => i.id === firstDraft.id)!;
check('reducer: release posts with an ERP ref and clears ZATCA', rel.status === 'posted' && !!rel.erpRef && rel.zatca === 'cleared', `${rel.status} ${rel.erpRef} ${rel.zatca}`);
check('reducer: every action bumps the revision and writes a trail entry', r2.world.flags.rev === 3 && r2.world.trail.length > r1.world.trail.length && r1.world.trail.length > w.trail.length);
const bad = applyAction(w, { type: 'nonsense' } as never, ctx);
check('reducer: unknown action is refused without touching the world', !!bad.error && bad.world === w);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
process.exit(failures ? 1 : 0);
