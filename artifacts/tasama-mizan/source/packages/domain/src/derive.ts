/**
 * Everything a screen shows about status, exposure, variance or readiness
 * comes from here. Screens read; they never compute.
 */
import type {
  BankAccount, BankLine, BillingEvent, BusinessLine, CashReceipt, Client, CloseItem, ErpJob, Invoice, LedgerEntry,
  PayrollRun, POLine, VatFigures, VatReturn, World,
} from './types';
import { USD_SAR, monthOf } from './world';

export const GM_TARGET = 0.23;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000);
}
export const toSAR = (amount: number, currency: string) => (currency === 'USD' ? amount * USD_SAR : amount);

export function lineOf(world: World, lineId: string): POLine {
  for (const p of world.pos) for (const l of p.lines) if (l.id === lineId) return l;
  throw new Error('no line ' + lineId);
}
export const clientOf = (world: World, id: string): Client => world.clients.find((c) => c.id === id)!;
export const poOf = (world: World, id: string) => world.pos.find((p) => p.id === id)!;
export const invoiceOf = (world: World, id: string | undefined) => world.invoices.find((i) => i.id === id);

/* --------------------------------------------------------- billing */

export type EventStatus =
  | 'scheduled' | 'due' | 'missed' | 'blocked_coc' | 'blocked_evidence' | 'blocked_no_po'
  | 'drafted' | 'released' | 'cleared' | 'rejected' | 'paid';

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  scheduled: 'Scheduled', due: 'Due — ready to invoice', missed: 'Missed', blocked_coc: 'Blocked — CoC unsigned',
  blocked_evidence: 'Blocked — evidence missing', blocked_no_po: 'Blocked — no PO cover', drafted: 'Draft invoice',
  released: 'Released to ERP', cleared: 'Invoiced · cleared', rejected: 'Invoice rejected (ZATCA)', paid: 'Invoiced · paid',
};

export function cocRequired(e: BillingEvent) { return e.coc !== 'not_required'; }
export function evidenceComplete(e: BillingEvent) {
  return e.evidenceRequired.every((k) => e.evidence.some((ev) => ev.kind === k));
}

export function eventStatus(world: World, e: BillingEvent): EventStatus {
  const inv = invoiceOf(world, e.invoiceId);
  if (inv) {
    if (inv.status === 'paid' || inv.status === 'part_paid') return 'paid';
    if (inv.zatca === 'rejected') return 'rejected';
    if (inv.status === 'draft') return 'drafted';
    if (inv.status === 'released') return 'released';
    return 'cleared';
  }
  if (e.dueDate > world.asOf) return 'scheduled';
  if (e.noPoCover) return 'blocked_no_po';
  if (!evidenceComplete(e)) return 'blocked_evidence';
  if (cocRequired(e) && e.coc !== 'signed') return 'blocked_coc';
  return e.period < world.closingPeriod ? 'missed' : 'due';
}

export const isBlocked = (s: EventStatus) => s.startsWith('blocked');
export const isInvoiced = (s: EventStatus) => ['drafted', 'released', 'cleared', 'rejected', 'paid'].includes(s);

/** Delivered + evidenced + not invoiced, in SAR. The contract asset the close must accrue. */
export function unbilled(world: World) {
  return world.events
    .filter((e) => { const s = eventStatus(world, e); return s === 'due' || s === 'missed' || s === 'blocked_coc'; })
    .reduce((sum, e) => sum + toSAR(e.expectedAmount, e.currency), 0);
}
export function unbilledEvents(world: World) {
  return world.events.filter((e) => { const s = eventStatus(world, e); return s === 'due' || s === 'missed' || s === 'blocked_coc'; });
}

/** Invoiced ahead of delivery (advance fees), less what has been released, in SAR. */
export function deferredBalance(world: World, asOfMonth = monthOf(world.asOf) - 1) {
  let bal = 0;
  for (const e of world.events) {
    const line = lineOf(world, e.lineId);
    if (line.pricingModel !== 'advance' || !e.invoiceId) continue;
    const m0 = monthOf(line.start);
    const releasedMonths = Math.max(0, Math.min(12, asOfMonth - m0 + 1));
    const released = (e.expectedAmount / 12) * releasedMonths;
    bal += toSAR(e.expectedAmount - released, e.currency);
  }
  return r2(bal);
}

/** Recognised revenue by line × month (SAR). Month index 1..12. */
export function recognisedByLineMonth(world: World): Record<BusinessLine, number[]> {
  const lines: BusinessLine[] = ['502', '504', '506', 'SES-FIN', 'SES-HR', 'SES-PROC', 'BES', 'EVAS'];
  const out = Object.fromEntries(lines.map((l) => [l, Array(13).fill(0)])) as Record<BusinessLine, number[]>;
  for (const e of world.events) {
    const l = lineOf(world, e.lineId);
    if (l.pricingModel === 'advance') {
      const m0 = monthOf(l.start);
      for (let m = m0; m <= 12; m++) out[l.businessLine][m] += toSAR(e.expectedAmount / 12, e.currency);
      continue;
    }
    if (e.noPoCover) continue;
    if (e.dueDate > world.asOf) continue; // not delivered yet
    if (!evidenceComplete(e)) continue;
    out[l.businessLine][monthOf(e.dueDate)] += toSAR(e.expectedAmount, e.currency);
  }
  return out;
}

/** Recognised revenue by client, January to the closing month. */
export function revenueByClientYtd(world: World): Record<string, number> {
  const out: Record<string, number> = {};
  for (let m = 1; m <= monthOf(world.closingPeriod); m++) for (const [c, v] of Object.entries(recognisedByClientMonth(world, m))) out[c] = (out[c] ?? 0) + v;
  return out;
}

export function recognisedByClientMonth(world: World, m: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of world.events) {
    const l = lineOf(world, e.lineId);
    let amt = 0;
    if (l.pricingModel === 'advance') { if (m >= monthOf(l.start)) amt = e.expectedAmount / 12; }
    else if (!e.noPoCover && e.dueDate <= world.asOf && evidenceComplete(e) && monthOf(e.dueDate) === m) amt = e.expectedAmount;
    if (amt) out[e.clientId] = (out[e.clientId] ?? 0) + toSAR(amt, e.currency);
  }
  return out;
}

/** The month's lead-to-cash waterfall, in SAR. */
export function waterfall(world: World, period = world.closingPeriod) {
  const evs = world.events.filter((e) => e.period === period && !(lineOf(world, e.lineId).pricingModel === 'advance' && e.period !== period));
  const contracted = evs.reduce((s, e) => s + toSAR(e.expectedAmount, e.currency), 0);
  const evidenced = evs.filter((e) => evidenceComplete(e) && !e.noPoCover).reduce((s, e) => s + toSAR(e.expectedAmount, e.currency), 0);
  const invoicedEvs = evs.filter((e) => isInvoiced(eventStatus(world, e)));
  const invoiced = invoicedEvs.reduce((s, e) => s + toSAR(invoiceOf(world, e.invoiceId)!.net, e.currency), 0);
  const cleared = invoicedEvs.filter((e) => invoiceOf(world, e.invoiceId)!.zatca === 'cleared').reduce((s, e) => s + toSAR(invoiceOf(world, e.invoiceId)!.net, e.currency), 0);
  const collected = invoicedEvs.filter((e) => invoiceOf(world, e.invoiceId)!.status === 'paid').reduce((s, e) => s + toSAR(invoiceOf(world, e.invoiceId)!.net, e.currency), 0);
  return { contracted, evidenced, invoiced, cleared, collected, count: evs.length };
}

export function poConsumption(world: World, poId: string) {
  const po = poOf(world, poId);
  const invoiced = world.invoices.filter((i) => i.poId === poId && i.status !== 'credited').reduce((s, i) => s + i.net, 0);
  const unb = world.events.filter((e) => e.poId === poId && ['due', 'missed', 'blocked_coc'].includes(eventStatus(world, e))).reduce((s, e) => s + e.expectedAmount, 0);
  const remainingTerm = world.events.filter((e) => e.poId === poId && eventStatus(world, e) === 'scheduled' && !e.noPoCover).reduce((s, e) => s + e.expectedAmount, 0);
  return { value: po.value, invoiced, unbilled: unb, committed: invoiced + unb, pct: (invoiced + unb) / po.value, remainingTerm, uncovered: Math.max(0, invoiced + unb + remainingTerm - po.value) };
}

/* ------------------------------------------------------- receivables */

export type AgeBucket = 'Current' | '1–30' | '31–60' | '61–90' | '90+';
export function ageBucket(days: number): AgeBucket {
  if (days <= 0) return 'Current';
  if (days <= 30) return '1–30';
  if (days <= 60) return '31–60';
  if (days <= 90) return '61–90';
  return '90+';
}
export function openInvoices(world: World) {
  return world.invoices.filter((i) => ['posted', 'released', 'part_paid'].includes(i.status) && i.zatca !== 'rejected');
}
export function arOpen(world: World) { return openInvoices(world).reduce((s, i) => s + toSAR(i.gross, i.currency), 0); }
export function overdue(world: World) {
  return openInvoices(world).filter((i) => i.dueDate < world.asOf).map((i) => ({ invoice: i, days: daysBetween(i.dueDate, world.asOf) }));
}
export function ageing(world: World) {
  const buckets: Record<AgeBucket, number> = { Current: 0, '1–30': 0, '31–60': 0, '61–90': 0, '90+': 0 };
  for (const i of openInvoices(world)) buckets[ageBucket(daysBetween(i.dueDate, world.asOf))] += toSAR(i.gross, i.currency);
  return buckets;
}
/** Countback DSO over the trailing 90 days of invoicing. */
export function dso(world: World) {
  const since = new Date(Date.parse(world.asOf + 'T00:00:00Z') - 90 * 86_400_000).toISOString().slice(0, 10);
  const billed = world.invoices.filter((i) => i.date >= since && i.zatca !== 'rejected').reduce((s, i) => s + toSAR(i.gross, i.currency), 0);
  return billed ? Math.round(arOpen(world) / (billed / 90)) : 0;
}
export function dsoBySegment(world: World) {
  const out: Record<string, { ar: number; dso: number | null }> = {};
  for (const seg of ['PIF', 'Government', 'Private', 'International']) {
    const cl = new Set(world.clients.filter((c) => c.segment === seg).map((c) => c.id));
    if (!cl.size) continue;
    const since = new Date(Date.parse(world.asOf + 'T00:00:00Z') - 90 * 86_400_000).toISOString().slice(0, 10);
    const billed = world.invoices.filter((i) => cl.has(i.clientId) && i.date >= since && i.zatca !== 'rejected').reduce((s, i) => s + toSAR(i.gross, i.currency), 0);
    const ar = openInvoices(world).filter((i) => cl.has(i.clientId)).reduce((s, i) => s + toSAR(i.gross, i.currency), 0);
    out[seg] = { ar, dso: billed ? Math.round(ar / (billed / 90)) : null };
  }
  return out;
}

/* ------------------------------------------------------------ cash */

export function cashStats(world: World, period = world.closingPeriod) {
  const inPeriod = (r: CashReceipt) => world.bankLines.find((b) => b.id === r.bankLineId)?.date.startsWith(period);
  const rs = world.receipts.filter(inPeriod);
  const applied = rs.filter((r) => r.status === 'applied');
  const proposed = rs.filter((r) => r.status === 'proposed');
  const unapplied = rs.filter((r) => r.status === 'unapplied');
  const auto = applied.filter((r) => r.method === 'reference');
  return {
    appliedAmount: applied.reduce((s, r) => s + toSAR(r.amount, world.bankLines.find((b) => b.id === r.bankLineId)!.accountId === 'sab-usd' ? 'USD' : 'SAR'), 0),
    applied: applied.length, proposed, unapplied, autoRate: rs.length ? auto.length / rs.length : 0,
  };
}

export type BankRec = {
  account: BankAccount;
  statementBalance: number; ledgerBalance: number; difference: number;
  unmatchedStatement: BankLine[]; unmatchedLedger: LedgerEntry[];
  matchedCount: number; adjustmentsProposed: number; explained: boolean;
};
export function bankRec(world: World, accountId: string, period = world.closingPeriod): BankRec {
  const account = world.bankAccounts.find((a) => a.id === accountId)!;
  const bl = world.bankLines.filter((b) => b.accountId === accountId && b.date.startsWith(period));
  const le = world.ledger.filter((l) => l.accountId === accountId && l.date.startsWith(period));
  const statementBalance = r2(account.openingStatement + bl.reduce((s, b) => s + b.amount, 0));
  const ledgerBalance = r2(account.openingLedger + le.reduce((s, l) => s + l.amount, 0));
  const appliedReceipt = (b: BankLine) => { const r = world.receipts.find((x) => x.bankLineId === b.id); return r && r.status === 'applied'; };
  const unmatchedStatement = bl.filter((b) => !b.matchedLedgerId && !appliedReceipt(b));
  const unmatchedLedger = le.filter((l) => !l.matchedBankLineId);
  const matchedCount = bl.length - unmatchedStatement.length;
  const adj = world.journals.filter((j) => (j.kind === 'Bank charges' || j.kind === 'FX difference') && j.status !== 'posted').length;
  const difference = r2(statementBalance - ledgerBalance);
  const explainedBy = r2(unmatchedStatement.reduce((s, b) => s + b.amount, 0) - unmatchedLedger.reduce((s, l) => s + l.amount, 0));
  return { account, statementBalance, ledgerBalance, difference, unmatchedStatement, unmatchedLedger, matchedCount, adjustmentsProposed: adj, explained: Math.abs(difference - explainedBy) < 0.01 };
}

/* -------------------------------------------------------- vendors */

/* ------------------------------------------------------- payroll */

/** Working days between two dates, KSA week (Friday and Saturday off): the days after `a` up to and including `b`. */
export function workingDaysBetween(a: string, b: string) {
  let n = 0; const t = new Date(a + 'T00:00:00Z'); const end = Date.parse(b + 'T00:00:00Z');
  while (t.getTime() < end) { t.setUTCDate(t.getUTCDate() + 1); const dow = t.getUTCDay(); if (dow !== 5 && dow !== 6) n++; }
  return n;
}

export const payrollRun = (world: World, period = world.closingPeriod): PayrollRun | undefined => world.payrollRuns.find((r) => r.period === period);

/** The payroll figures the close can use this month: the closing month's run once it is in, otherwise the prior month as a run-rate, labelled as such. */
export function payrollForClose(world: World): { run: PayrollRun; estimate: boolean } | null {
  const cur = payrollRun(world);
  if (cur && cur.status !== 'awaited') return { run: cur, estimate: false };
  const prior = [...world.payrollRuns].filter((r) => r.period < world.closingPeriod).sort((a, b) => b.period.localeCompare(a.period))[0];
  return prior ? { run: prior, estimate: true } : null;
}

export function payrollSummary(world: World) {
  const run = payrollRun(world);
  if (!run) return null;
  const late = run.receivedOn ? 0 : world.asOf > run.dueOn ? workingDaysBetween(run.dueOn, world.asOf) : 0;
  const input = world.inputs.find((i) => i.procedure === 2);
  const bankLine = world.bankLines.find((b) => b.type === 'payroll' && b.date.startsWith(run.period));
  const journals = run.journalIds.map((id) => world.journals.find((j) => j.id === id)).filter(Boolean) as World['journals'];
  const delivery = run.allocations.filter((a) => a.clientId).reduce((s, a) => s + a.cost, 0);
  const overhead = run.allocations.filter((a) => !a.clientId).reduce((s, a) => s + a.cost, 0);
  const gosiTotal = r2(run.gosiEmployee + run.gosiEmployer);
  return { run, late, reminders: input?.reminders ?? [], bankLine, journals, delivery, overhead, gosiTotal, journalsPosted: journals.length > 0 && journals.every((j) => j.status === 'posted') };
}

/** Delivery payroll allocated to each client for the month, from the register's timesheet allocation. */
export function payrollCostByClient(world: World): { byClient: Record<string, { cost: number; fte: number; notes: string[] }>; estimate: boolean; period: string } {
  const p = payrollForClose(world);
  const byClient: Record<string, { cost: number; fte: number; notes: string[] }> = {};
  if (!p) return { byClient, estimate: true, period: world.closingPeriod };
  for (const a of p.run.allocations) {
    if (!a.clientId) continue;
    const row = (byClient[a.clientId] ??= { cost: 0, fte: 0, notes: [] });
    row.cost += a.cost; row.fte += a.fte; if (a.note) row.notes.push(a.note);
  }
  return { byClient, estimate: p.estimate, period: p.run.period };
}

/* -------------------------------------------------------- vendors */

/** Vendor cost of the closing month by client: matched or proposed vendor invoices dated in the month, plus the vendor accrual where the invoice has not arrived. */
export function vendorCostByClient(world: World, period = world.closingPeriod): Record<string, number> {
  const out: Record<string, number> = {};
  const clientOfLine = (lineId: string | undefined) => lineId ? world.pos.find((p) => p.lines.some((l) => l.id === lineId))?.clientId : undefined;
  for (const v of world.vendorInvoices) {
    if (!v.issueDate.startsWith(period) || !['matched', 'proposed'].includes(v.matchStatus)) continue;
    const c = clientOfLine(v.clientPOLineId); if (c) out[c] = (out[c] ?? 0) + v.net;
  }
  // The vendor accrual stands in for the Masterworks invoice until it is on file (then the invoice carries the cost and the accrual reverses).
  const accrual = world.journals.find((j) => j.kind === 'Vendor accrual' && j.period === period);
  if (accrual) {
    const po = world.vendorPOs.find((p) => p.vendor === 'Masterworks');
    const invoiced = world.vendorInvoices.some((v) => v.vendorName === 'Masterworks' && v.issueDate.startsWith(period) && ['matched', 'proposed'].includes(v.matchStatus));
    const c = po ? clientOfLine(po.clientPOLineId) : undefined;
    if (c && !invoiced) out[c] = (out[c] ?? 0) + accrual.lines.reduce((s, l) => s + l.dr, 0);
  }
  return out;
}

/** Gross margin by client for the closing month: recognised revenue less vendor cost less delivery payroll allocated from timesheets. */
export function marginByClient(world: World) {
  const m = monthOf(world.closingPeriod);
  const revenue = recognisedByClientMonth(world, m);
  const vendor = vendorCostByClient(world);
  const pay = payrollCostByClient(world);
  const rows: { client: Client; revenue: number; vendorCost: number; staffCost: number; fte: number; margin: number; marginPct: number | null; notes: string[] }[] = [];
  for (const c of world.clients) {
    const rev = revenue[c.id] ?? 0; const vc = vendor[c.id] ?? 0; const pc = pay.byClient[c.id]?.cost ?? 0;
    if (!rev && !vc && !pc) continue;
    const margin = rev - vc - pc;
    rows.push({ client: c, revenue: rev, vendorCost: vc, staffCost: pc, fte: pay.byClient[c.id]?.fte ?? 0, margin, marginPct: rev ? margin / rev : null, notes: pay.byClient[c.id]?.notes ?? [] });
  }
  return { rows: rows.sort((a, b) => b.revenue - a.revenue), estimate: pay.estimate, payrollPeriod: pay.period };
}

/** The month's P&L as the close pack reports it, from the same figures the screens use. */
export function monthlyPnl(world: World) {
  const m = monthOf(world.closingPeriod);
  const rec = recognisedByLineMonth(world);
  const revenue = Object.values(rec).reduce((s, a) => s + a[m], 0);
  const vendor = Object.values(vendorCostByClient(world)).reduce((s, v) => s + v, 0);
  const pay = payrollForClose(world);
  const delivery = pay ? pay.run.allocations.filter((a) => a.clientId).reduce((s, a) => s + a.cost, 0) : 0;
  const overhead = pay ? pay.run.allocations.filter((a) => !a.clientId).reduce((s, a) => s + a.cost, 0) : 0;
  const bankCharges = world.journals.filter((j) => j.kind === 'Bank charges' && j.period === world.closingPeriod).reduce((s, j) => s + j.lines.reduce((x, l) => x + l.dr, 0), 0);
  const fx = world.journals.filter((j) => j.kind === 'FX difference' && j.period === world.closingPeriod).reduce((s, j) => s + j.lines.filter((l) => l.account.includes('FX')).reduce((x, l) => x + l.cr - l.dr, 0), 0);
  const dep = world.erpJobs.find((j) => j.procedure === 14 && j.period === world.closingPeriod);
  const lease = world.erpJobs.find((j) => j.procedure === 15 && j.period === world.closingPeriod);
  const depreciation = dep?.status === 'completed' ? Number((dep.summary ?? '').match(/SAR ([\d,]+)/)?.[1]?.replace(/,/g, '') ?? 0) : 0;
  const leaseInterest = lease?.status === 'completed' ? Number((lease.summary ?? '').match(/interest SAR ([\d,]+)/)?.[1]?.replace(/,/g, '') ?? 0) : 0;
  const grossMargin = revenue - vendor - delivery;
  const operating = grossMargin - overhead - bankCharges + fx - depreciation - leaseInterest;
  return { revenue, vendor, delivery, grossMargin, grossMarginPct: revenue ? grossMargin / revenue : 0, overhead, bankCharges, fx, depreciation, leaseInterest, operating, payrollEstimate: pay?.estimate ?? true, depreciationRun: dep?.status === 'completed', byLine: Object.entries(rec).map(([l, a]) => ({ businessLine: l as BusinessLine, revenue: a[m] })).filter((x) => x.revenue) };
}

/* ------------------------------------------------------------ VAT */

export const vatReturn = (world: World, period = world.closingPeriod): VatReturn | undefined => world.vatReturns.find((v) => v.period === period);

/** The return as the ledger stands: output VAT from cleared tax invoices dated in the period, input VAT from vendor invoices posted to AP, the rest named. */
export function vatFigures(world: World, period = world.closingPeriod): VatFigures {
  const sales = world.invoices.filter((i) => i.date.startsWith(period) && !i.creditNoteOf);
  const cleared = sales.filter((i) => i.zatca === 'cleared');
  const excluded = sales.filter((i) => i.zatca !== 'cleared').map((i) => ({ ref: i.id, reason: i.zatca === 'rejected' ? `rejected by ZATCA — ${i.zatcaReason ?? 'not a valid tax invoice'}` : `${i.zatca} — not yet cleared by ZATCA`, vat: toSAR(i.vat, i.currency) }));
  const purchases = world.vendorInvoices.filter((v) => v.issueDate.startsWith(period));
  const posted = purchases.filter((v) => v.matchStatus === 'matched');
  const deferred = purchases.filter((v) => ['proposed', 'no_po'].includes(v.matchStatus));
  const outputVat = r2(cleared.reduce((s, i) => s + toSAR(i.vat, i.currency), 0));
  const inputVat = r2(posted.reduce((s, v) => s + toSAR(v.vat, v.currency), 0));
  return {
    standardRatedSales: r2(cleared.reduce((s, i) => s + toSAR(i.net, i.currency), 0)), outputVat, salesCount: cleared.length, zeroRatedSales: 0,
    standardRatedPurchases: r2(posted.reduce((s, v) => s + toSAR(v.net, v.currency), 0)), inputVat, purchaseCount: posted.length,
    deferredInputVat: r2(deferred.reduce((s, v) => s + toSAR(v.vat, v.currency), 0)),
    deferredNote: deferred.length ? deferred.map((v) => `${v.vendorName} ${v.invoiceRef} (SAR ${v.vat.toLocaleString('en-US')}) — ${v.matchStatus === 'no_po' ? 'no vendor PO; not claimable until approved and posted' : 'match awaiting approval'}`).join('; ') : '',
    adjustments: 0, adjustmentNote: '',
    netPayable: r2(outputVat - inputVat),
    excluded: [...excluded, ...purchases.filter((v) => v.matchStatus === 'rejected').map((v) => ({ ref: v.invoiceRef, reason: 'returned to the vendor — no input VAT without a posted invoice', vat: toSAR(v.vat, v.currency) }))],
    salesRefs: cleared.map((i) => i.id), purchaseRefs: posted.map((v) => v.id),
  };
}

/** The figures the VAT tab shows: frozen once prepared, live before. */
export function vatForPeriod(world: World, period = world.closingPeriod) {
  const ret = vatReturn(world, period);
  const figures = ret?.figures ?? vatFigures(world, period);
  const rejected = world.invoices.filter((i) => i.date.startsWith(period) && i.zatca === 'rejected');
  return { ret, figures, canPrepare: !!ret && ret.status === 'open' && rejected.length === 0, rejected };
}

/* ------------------------------------------------------- ERP jobs */

export const erpJobFor = (world: World, procedure: number, period = world.closingPeriod): ErpJob | undefined => world.erpJobs.find((j) => j.procedure === procedure && j.period === period);

/* --------------------------------------------------------- budget */

export function budgetTable(world: World) {
  const rec = recognisedByLineMonth(world);
  return world.budget.map((b) => ({ ...b, actual: b.month <= monthOf(world.asOf) - 1 ? Math.round(rec[b.businessLine][b.month]) : 0 }));
}
export function budgetByMonth(world: World) {
  const t = budgetTable(world);
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1; const rows = t.filter((r) => r.month === m);
    return { month: m, budget: rows.reduce((s, r) => s + r.budget, 0), target: rows.reduce((s, r) => s + r.target, 0), forecast: rows.reduce((s, r) => s + r.forecast, 0), actual: m <= monthOf(world.asOf) - 1 ? rows.reduce((s, r) => s + r.actual, 0) : null };
  });
}
export function budgetByLine(world: World, month: number) {
  return budgetTable(world).filter((r) => r.month === month).map((r) => {
    const drivers = world.drivers.filter((dv) => dv.businessLine === r.businessLine);
    const explained = drivers.reduce((s, dv) => s + dv.amount, 0);
    return { ...r, varBudget: r.actual - r.budget, varForecast: r.actual - r.forecast, drivers, unexplained: r.actual - r.budget - explained };
  });
}
export function fyTotals(world: World) {
  const bm = budgetByMonth(world);
  const ytd = bm.filter((r) => r.actual !== null);
  return {
    budget: bm.reduce((s, r) => s + r.budget, 0), target: bm.reduce((s, r) => s + r.target, 0), forecast: bm.reduce((s, r) => s + r.forecast, 0),
    actualYtd: ytd.reduce((s, r) => s + (r.actual ?? 0), 0), budgetYtd: ytd.reduce((s, r) => s + r.budget, 0),
  };
}
export function nonPifShare(world: World) {
  const rec = recognisedByClientMonth(world, monthOf(world.asOf) - 1);
  const total = Object.values(rec).reduce((s, v) => s + v, 0);
  const nonPif = Object.entries(rec).filter(([id]) => !clientOf(world, id).pif).reduce((s, [, v]) => s + v, 0);
  return total ? nonPif / total : 0;
}

/* ----------------------------------------------------------- close */

const DT_LINES = new Set(['502', '504', '506', 'EVAS']);
const fmtSar = (n: number) => `SAR ${Math.round(n).toLocaleString('en-US')}`;

/**
 * Tasama's 24 procedures (plus the VAT line Cognirise added) with their status
 * read from the world. Nothing here is ticked by a person: inputs, payroll,
 * billing, cash, bank, vendor, journal, ERP-job, budget and period state
 * decide. Fixed Assets and Leases are read back from the ERP's own jobs.
 */
export function deriveCloseItems(world: World): CloseItem[] {
  const period = world.closingPeriod;
  const events = world.events.filter((e) => e.period === period || eventStatus(world, e) === 'missed');
  const billingOpen = events.filter((e) => ['due', 'missed'].includes(eventStatus(world, e)));
  const blocked = events.filter((e) => isBlocked(eventStatus(world, e)));
  const recs = world.bankAccounts.map((a) => bankRec(world, a.id));
  const cash = cashStats(world);
  const rejected = world.invoices.filter((i) => i.zatca === 'rejected');
  const released = world.invoices.filter((i) => i.date.startsWith(world.asOf.slice(0, 7)) && ['released', 'posted', 'paid'].includes(i.status));
  const journal = (kind: string) => world.journals.find((j) => j.kind === kind);
  const jStatus = (kinds: string[]): CloseItem['status'] => { const js = kinds.map(journal).filter(Boolean) as typeof world.journals; if (!js.length) return 'not_started'; return js.every((j) => j.status === 'posted') ? 'done' : js.some((j) => j.status === 'approved') ? 'in_progress' : 'not_started'; };
  const jEvidence = (kinds: string[]) => (kinds.map(journal).filter(Boolean) as typeof world.journals).map((j) => `${j.id} ${j.status}${j.erpRef ? ` (${j.erpRef})` : ''}`).join('; ');
  const delivery = (dt: boolean) => {
    const evs = world.events.filter((e) => e.period === period && DT_LINES.has(lineOf(world, e.lineId).businessLine) === dt);
    const evidenced = evs.filter((e) => eventStatus(world, e) !== 'scheduled' && eventStatus(world, e) !== 'blocked_evidence');
    const stuck = evs.filter((e) => ['blocked_coc', 'blocked_no_po', 'blocked_evidence'].includes(eventStatus(world, e)));
    return { evs, evidenced, stuck };
  };
  const vendorProposed = world.vendorInvoices.filter((v) => v.matchStatus === 'proposed');
  const vendorNoPo = world.vendorInvoices.filter((v) => v.matchStatus === 'no_po');
  const vendorReturned = world.vendorInvoices.filter((v) => v.matchStatus === 'rejected');
  const financeDone = (items: CloseItem[]) => items.filter((i) => i.group === 'finance' && i.number < 23 && i.status !== 'external').every((i) => i.status === 'done');
  const pay = payrollSummary(world);
  const fmtDate = (iso: string) => `${Number(iso.slice(8, 10))} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(iso.slice(5, 7)) - 1]}`;

  const items = world.closeItems.map((c) => {
    const x: CloseItem = { ...c };
    switch (c.derivedFrom) {
      case 'inputs': {
        const late = world.inputs.filter((i) => !i.receivedOn);
        x.status = late.length ? (late.some((i) => world.asOf > i.dueOn) ? 'in_progress' : 'in_progress') : 'done';
        x.evidence = `Calendar and cut-offs issued 25 Sep to HR, Requesters, Operations and D&T; ${world.inputs.filter((i) => i.receivedOn).length} of ${world.inputs.length} inputs received`;
        x.blocker = late.length ? late.map((i) => `${i.department.toUpperCase()} — ${i.what.split(':')[0].split(' — ')[0]} ${workingDaysBetween(i.dueOn, world.asOf)} WD late${i.reminders.length ? `, reminded ${i.reminders.length}× (${i.reminders.map(fmtDate).join(', ')})` : ''}`).join('; ') : undefined;
        break;
      }
      case 'payroll': {
        if (!pay) { x.status = 'not_started'; break; }
        const r = pay.run;
        if (r.status === 'awaited') { x.status = pay.late ? 'blocked' : 'in_progress'; x.blocker = `Register not received from HR — paid ${fmtDate(r.paidOn)}, due ${fmtDate(r.dueOn)}${pay.late ? `, ${pay.late} WD late` : ''}${pay.reminders.length ? `; Iqfal reminded ${pay.reminders.length}×` : ''}`; x.evidence = undefined; }
        else if (r.status === 'received') { x.status = 'in_progress'; x.evidence = `Register received ${fmtDate(r.receivedOn!)}: ${r.headcount} heads, net SAR ${r.netPay.toLocaleString('en-US')} — ${r.proof?.bankTies ? 'ties to the WPS payment' : 'does NOT tie to the bank'}; awaiting the Accounting Manager's sign-off`; x.blocker = r.proof && !(r.proof.bankTies && r.proof.headcountTies && r.proof.glTies) ? r.proof.note : undefined; }
        else if (r.status === 'proved') { x.status = 'in_progress'; x.evidence = `Proof signed; payroll and provisions journals ${pay.journals.every((j) => j.status === 'posted') ? 'posted' : 'proposed'}`; x.blocker = pay.journalsPosted ? undefined : 'Payroll journals awaiting approval'; }
        else { x.status = 'done'; x.evidence = `Register ${r.headcount} heads · net SAR ${r.netPay.toLocaleString('en-US')} = WPS ${fmtDate(r.paidOn)} = GL · employer cost SAR ${r.employerCost.toLocaleString('en-US')} allocated to ${r.allocations.filter((a) => a.clientId).length} engagements; GOSI SAR ${pay.gosiTotal.toLocaleString('en-US')} due ${fmtDate(r.gosiDueOn)}`; }
        break;
      }
      case 'erp_job': {
        const j = erpJobFor(world, c.number);
        x.status = !j ? 'not_started' : j.status === 'completed' ? (j.ties === false ? 'blocked' : 'done') : j.status === 'errors' ? 'blocked' : j.status === 'scheduled' ? 'in_progress' : 'not_started';
        x.evidence = j ? `${j.name} — ${j.summary ?? j.status}${j.ranAt ? ` (ran ${fmtDate(j.ranAt.slice(0, 10))})` : j.scheduledFor ? ` (scheduled ${fmtDate(j.scheduledFor)})` : ''}` : undefined;
        x.blocker = j && j.status === 'errors' ? `${j.errors} accounting error(s) in ${j.module}` : j && j.ties === false ? 'FA sub-ledger does not tie to GL' : undefined;
        break;
      }
      case 'vat': {
        const v = vatForPeriod(world);
        x.status = !v.ret ? 'not_started' : v.ret.status === 'filed' ? 'done' : v.ret.status === 'approved' ? 'done' : v.ret.status === 'prepared' ? 'in_progress' : v.rejected.length ? 'blocked' : 'not_started';
        x.evidence = `Output VAT SAR ${v.figures.outputVat.toLocaleString('en-US')} on ${v.figures.salesCount} cleared invoice(s) · input VAT SAR ${v.figures.inputVat.toLocaleString('en-US')} · net payable SAR ${v.figures.netPayable.toLocaleString('en-US')}${v.ret?.status === 'approved' ? ' — approved, ready to file' : v.ret?.status === 'filed' ? ' — filed' : ''}`;
        x.blocker = v.rejected.length ? `${v.rejected.length} invoice(s) in the period rejected by ZATCA — not valid tax invoices` : v.figures.deferredInputVat ? `Input VAT SAR ${v.figures.deferredInputVat.toLocaleString('en-US')} not claimable: ${v.figures.deferredNote}` : undefined;
        break;
      }
      case 'vendor_coc': {
        x.status = vendorProposed.length ? 'in_progress' : 'done';
        x.evidence = `${world.vendorInvoices.filter((v) => v.matchStatus === 'matched').length} vendor invoice(s) matched to a vendor PO and delivery`;
        x.blocker = vendorProposed.length ? `${vendorProposed.length} three-way match(es) awaiting the Accountant (${vendorProposed.map((v) => v.vendorName).join(', ')})` : undefined;
        break;
      }
      case 'delivery_ops': case 'delivery_dt': {
        const d = delivery(c.derivedFrom === 'delivery_dt');
        x.status = d.stuck.length ? 'blocked' : d.evidenced.length === d.evs.length ? 'done' : 'in_progress';
        x.evidence = `Schedule derived by Shahid from PPM / ServiceNow / timesheets: ${d.evidenced.length} of ${d.evs.length} ${period} events evidenced, ${fmtSar(d.evidenced.reduce((s, e) => s + toSAR(e.expectedAmount, e.currency), 0))}`;
        x.blocker = d.stuck.length ? d.stuck.map((e) => `${clientOf(world, e.clientId).short} — ${EVENT_STATUS_LABEL[eventStatus(world, e)]}`).join('; ') : undefined;
        break;
      }
      case 'bank': {
        const signed = recs.filter((r) => r.account.signedOff).length;
        x.status = signed === recs.length ? 'done' : signed ? 'in_progress' : recs.every((r) => r.explained) ? 'in_progress' : 'blocked';
        x.evidence = recs.map((r) => `${r.account.bank}: ${r.explained ? 'explained' : 'unexplained'}${r.account.signedOff ? ', signed' : ''}`).join(' · ');
        x.blocker = signed === recs.length ? undefined : `${recs.length - signed} account(s) not signed off; ${recs.reduce((s, r) => s + r.unmatchedStatement.length + r.unmatchedLedger.length, 0)} open item(s)`;
        break;
      }
      case 'cash_applied': {
        x.status = cash.proposed.length + cash.unapplied.length === 0 ? 'done' : 'in_progress';
        x.evidence = `${cash.applied} receipt(s) posted through the connector this month`;
        x.blocker = x.status === 'done' ? undefined : `${cash.proposed.length} proposed, ${cash.unapplied.length} unapplied — Create Accounting runs in the ERP once cash is applied`;
        break;
      }
      case 'vendor_ap': {
        x.status = vendorNoPo.length ? 'blocked' : 'done';
        x.blocker = vendorNoPo.length ? vendorNoPo.map((v) => `${v.vendorName} ${v.invoiceRef} — ${v.matchStatus === 'no_po' ? 'no vendor PO' : 'rejected'}`).join('; ') : undefined;
        x.evidence = `${world.vendorInvoices.filter((v) => v.matchStatus === 'matched').length} approved and posted to AP${vendorReturned.length ? `; ${vendorReturned.length} returned to the vendor (${vendorReturned.map((v) => v.invoiceRef).join(', ')})` : ''}`;
        break;
      }
      case 'erp_ap': {
        x.status = vendorNoPo.length || vendorProposed.length ? 'not_started' : 'done';
        x.evidence = x.status === 'done' ? 'AP accounting can run: every vendor invoice matched or refused' : 'Waits for procedures 3 and 8';
        break;
      }
      case 'journal_vendor': { x.status = jStatus(['Vendor accrual']); x.evidence = jEvidence(['Vendor accrual']); break; }
      case 'journal_manual': {
        const kinds = ['Bank charges', 'FX difference', 'Rate correction (debit note)', 'Payroll', 'Payroll provisions'];
        const js = jStatus(kinds);
        const payrollIn = pay?.run.status === 'posted';
        x.status = js === 'done' && payrollIn ? 'done' : js === 'not_started' && !payrollIn ? 'not_started' : 'in_progress';
        x.evidence = jEvidence(kinds);
        x.blocker = payrollIn ? undefined : 'Payroll — the largest cost line — is not yet booked (procedure 2)';
        break;
      }
      case 'billing': {
        if (billingOpen.length === 0 && blocked.length === 0) { x.status = 'done'; x.evidence = `All ${period} events invoiced and recorded; ${released.length} invoice(s) posted this month.`; }
        else { x.status = blocked.length ? 'blocked' : 'in_progress'; x.evidence = `${released.length} invoice(s) posted this month`; x.blocker = `${billingOpen.length} event(s) due or missed, ${blocked.length} blocked (${blocked.map((e) => EVENT_STATUS_LABEL[eventStatus(world, e)]).filter((v, i, a) => a.indexOf(v) === i).join('; ')})`; }
        break;
      }
      case 'ar_tie': {
        x.evidence = `AR sub-ledger ${fmtSar(arOpen(world))} ties to the control account; ${world.dunning.filter((d) => d.status === 'proposed').length} dunning notice(s) awaiting the KAM`;
        x.status = cash.proposed.length || cash.unapplied.length ? 'in_progress' : 'done';
        if (x.status !== 'done') x.blocker = `${cash.proposed.length + cash.unapplied.length} receipt(s) not yet applied`;
        break;
      }
      case 'journal_unbilled': { x.status = jStatus(['Unbilled revenue accrual']); x.evidence = `Recognised ${period} revenue from the delivery schedule; ${jEvidence(['Unbilled revenue accrual']) || 'unbilled accrual not yet proposed'}`; break; }
      case 'journal_deferred': { x.status = jStatus(['Deferred revenue release']); x.evidence = `Unbilled ${fmtSar(unbilled(world))} · deferred ${fmtSar(deferredBalance(world))} · ${jEvidence(['Deferred revenue release'])}`; break; }
      case 'erp_ar': {
        x.status = rejected.length ? 'blocked' : billingOpen.length || blocked.length ? 'not_started' : 'done';
        x.blocker = rejected.length ? `${rejected.length} invoice(s) rejected by ZATCA — output VAT cannot tie` : undefined;
        x.evidence = rejected.length ? undefined : x.status === 'done' ? 'Every posted invoice cleared by ZATCA; AR accounting can run' : 'Waits for procedure 17';
        break;
      }
      case 'budget': {
        x.status = world.flags.reforecastAccepted ? 'done' : 'in_progress';
        x.evidence = `${world.drivers.length} variance driver(s) explained by Mizaniya${world.flags.reforecastAccepted ? '; reforecast accepted by FP&A' : ''}`;
        x.blocker = world.flags.reforecastAccepted ? undefined : 'Reforecast proposed, not yet accepted';
        break;
      }
      case 'period_close': {
        x.status = world.flags.periodClosed ? 'done' : 'not_started';
        x.evidence = world.flags.periodClosed ? `${period} closed by the CFO` : undefined;
        break;
      }
      case 'reports': {
        x.status = world.flags.periodClosed ? 'done' : 'not_started';
        x.evidence = world.flags.periodClosed ? 'Day-1 pack issued from the same figures: P&L, balance sheet, cash, AR ageing, margin by client, headcount cost' : 'Issued when procedure 23 closes the period';
        break;
      }
    }
    return x;
  });
  // The ERP close itself is blocked until every Finance procedure Mizan can see is done.
  const p23 = items.find((i) => i.number === 23);
  if (p23 && !world.flags.periodClosed) {
    const openFinance = items.filter((i) => i.group === 'finance' && i.number < 23 && !['done', 'external'].includes(i.status));
    const openInputs = items.filter((i) => i.group === 'inputs' && i.status !== 'done');
    const ready = financeDone(items) && openInputs.length === 0;
    p23.status = ready ? 'not_started' : 'blocked';
    p23.blocker = ready ? undefined : [openInputs.length ? `${openInputs.length} input(s) still open (${openInputs.map((i) => `P${i.number}`).join(', ')})` : '', openFinance.length ? `${openFinance.length} finance procedure(s) still open (${openFinance.map((i) => `P${i.number}`).join(', ')})` : ''].filter(Boolean).join('; ');
  }
  return items;
}

export function closeSummary(world: World) {
  const items = deriveCloseItems(world);
  const by = (s: CloseItem['status']) => items.filter((i) => i.status === s).length;
  const inputsDone = items.filter((i) => i.group === 'inputs').every((i) => i.status === 'done');
  return { items, done: by('done'), inProgress: by('in_progress'), blocked: by('blocked'), notStarted: by('not_started'), external: by('external'), total: items.length, inputsDone,
    /** Tasama's own 24 lines (the added VAT line is reported separately). */
    tasama: items.filter((i) => i.number <= 24).length,
    readyToClose: items.filter((i) => i.number < 23 && i.status !== 'external').every((i) => i.status === 'done') };
}

/* ------------------------------------------------------------ inbox */

export type InboxType =
  | 'release_invoice' | 'draft_catchup' | 'approve_coc' | 'escalate_coc' | 'approve_dunning' | 'apply_cash'
  | 'approve_vendor' | 'resolve_vendor' | 'approve_journal' | 'sign_bank_rec' | 'fix_zatca' | 'acknowledge_finding' | 'confirm_schedule' | 'accept_reforecast'
  | 'receive_payroll' | 'approve_payroll' | 'prepare_vat' | 'approve_vat' | 'record_po_cover' | 'read_erp_jobs';

export type InboxItemModel = {
  id: string; type: InboxType; agentId: string; clientId?: string; amount?: number; currency?: string;
  title: string; preview: string; reference: string; decision: string; authority: string; roles: string[]; recordRef: string; at: string;
  attention: boolean;
};

export function inboxItems(world: World): InboxItemModel[] {
  const out: InboxItemModel[] = [];
  const c = (id?: string) => (id ? clientOf(world, id) : undefined);
  // Drafted invoices awaiting release
  for (const inv of world.invoices.filter((i) => i.status === 'draft')) {
    out.push({ id: `rel:${inv.id}`, type: 'release_invoice', agentId: 'fatoora', clientId: inv.clientId, amount: inv.gross, currency: inv.currency, title: `Release invoice ${inv.id} — ${c(inv.clientId)!.short}`, preview: inv.description, reference: inv.id, decision: `Release ${inv.id} for ${inv.currency} ${inv.gross.toLocaleString('en-US')} to the ERP and ZATCA`, authority: 'Head of Revenue & Treasury', roles: ['faisal', 'noura'], recordRef: inv.id, at: '2026-10-06T07:30:00+03:00', attention: true });
  }
  // Due / missed events with no draft yet
  for (const e of world.events) {
    const s = eventStatus(world, e);
    if (s === 'missed') out.push({ id: `catch:${e.id}`, type: 'draft_catchup', agentId: 'hares', clientId: e.clientId, amount: e.expectedAmount, currency: e.currency, title: `Missed billing — ${c(e.clientId)!.short}: ${e.label}`, preview: e.note ?? 'Delivered and evidenced; no invoice raised.', reference: e.id, decision: 'Draft the catch-up invoice now', authority: 'Head of Revenue & Treasury', roles: ['faisal', 'noura'], recordRef: e.id, at: '2026-10-01T07:15:00+03:00', attention: true });
    if (s === 'blocked_coc' && e.coc !== 'escalated') out.push({ id: `coc:${e.id}`, type: e.coc === 'to_send' ? 'approve_coc' : 'escalate_coc', agentId: 'shahid', clientId: e.clientId, amount: e.expectedAmount, currency: e.currency, title: `${e.coc === 'to_send' ? 'Send CoC request' : 'Escalate unsigned CoC'} — ${c(e.clientId)!.short}: ${e.label}`, preview: e.note ?? 'Evidence complete; certificate of completion required before invoicing.', reference: e.id, decision: e.coc === 'to_send' ? 'Approve the CoC request to the client' : 'Approve the escalation email to the client sponsor', authority: 'Key Account Manager', roles: ['majed', 'faisal', 'noura'], recordRef: e.id, at: '2026-10-03T08:01:00+03:00', attention: true });
  }
  for (const d of world.dunning.filter((x) => x.status === 'proposed')) out.push({ id: `dun:${d.id}`, type: 'approve_dunning', agentId: 'tahseel', clientId: d.clientId, amount: invoiceOf(world, d.invoiceId)!.gross, currency: 'SAR', title: `Approve ${d.proposedStage} notice — ${c(d.clientId)!.short} ${d.invoiceId}`, preview: d.draft.split('\n')[0], reference: d.id, decision: `Send the ${d.proposedStage} notice as drafted`, authority: 'Key Account Manager', roles: ['majed', 'sarah', 'faisal', 'noura'], recordRef: d.id, at: '2026-10-06T06:30:00+03:00', attention: true });
  for (const r of world.receipts.filter((x) => x.status === 'proposed')) out.push({ id: `cash:${r.id}`, type: 'apply_cash', agentId: 'tasweya', clientId: r.clientId ?? undefined, amount: r.amount, currency: 'SAR', title: `Apply receipt — ${c(r.clientId!)!.short} ${r.amount.toLocaleString('en-US')} (${r.method.replace('_', ' + ')}, ${Math.round(r.confidence * 100)}%)`, preview: r.note ?? '', reference: r.id, decision: `Apply to ${r.invoiceIds.join(', ')}${r.shortfall ? ` and post SAR ${r.shortfall} to bank charges` : ''}`, authority: 'Head of Revenue & Treasury', roles: ['faisal', 'omar', 'noura'], recordRef: r.id, at: '2026-10-01T06:03:10+03:00', attention: true });
  for (const v of world.vendorInvoices.filter((x) => x.matchStatus === 'proposed' || x.matchStatus === 'no_po')) out.push({ id: `vend:${v.id}`, type: v.matchStatus === 'proposed' ? 'approve_vendor' : 'resolve_vendor', agentId: 'mawrid', amount: v.total, currency: v.currency, title: `${v.matchStatus === 'proposed' ? 'Approve 3-way match' : 'Vendor invoice without PO'} — ${v.vendorName} ${v.invoiceRef}`, preview: v.matchNote ?? '', reference: v.id, decision: v.matchStatus === 'proposed' ? 'Approve the match and post to AP' : 'Reject and return to Procurement, or raise a vendor PO', authority: 'Accounting Manager', roles: ['reem', 'omar', 'noura'], recordRef: v.id, at: '2026-10-05T10:30:00+03:00', attention: true });
  for (const j of world.journals.filter((x) => x.status === 'proposed')) out.push({ id: `je:${j.id}`, type: 'approve_journal', agentId: j.proposedBy, amount: j.lines.reduce((s, l) => s + l.dr, 0), currency: 'SAR', title: `Approve journal — ${j.kind}`, preview: j.description, reference: j.id, decision: `Approve and post ${j.id}`, authority: 'Accounting Manager', roles: ['reem', 'noura'], recordRef: j.id, at: '2026-10-06T06:00:00+03:00', attention: true });
  for (const a of world.bankAccounts.filter((x) => !x.signedOff)) { const rec = bankRec(world, a.id); out.push({ id: `rec:${a.id}`, type: 'sign_bank_rec', agentId: 'tasweya', amount: Math.abs(rec.difference), currency: a.currency, title: `Sign off bank reconciliation — ${a.bank} ${a.label}`, preview: rec.explained ? `Difference ${a.currency} ${rec.difference.toLocaleString('en-US')} fully explained by ${rec.unmatchedStatement.length + rec.unmatchedLedger.length} open item(s)` : 'Difference not yet explained', reference: a.id, decision: 'Sign off the September reconciliation', authority: 'Accounting Manager', roles: ['reem', 'noura'], recordRef: a.id, at: '2026-10-06T06:00:00+03:00', attention: rec.explained && rec.unmatchedStatement.length + rec.unmatchedLedger.length <= 1 }); }
  for (const inv of world.invoices.filter((i) => i.zatca === 'rejected')) out.push({ id: `zatca:${inv.id}`, type: 'fix_zatca', agentId: 'fatoora', clientId: inv.clientId, amount: inv.gross, currency: inv.currency, title: `ZATCA rejected ${inv.id} — ${c(inv.clientId)!.short}`, preview: inv.zatcaReason ?? '', reference: inv.id, decision: 'Add the buyer VAT number to the customer master and re-submit', authority: 'Head of Revenue & Treasury', roles: ['faisal', 'omar', 'noura'], recordRef: inv.id, at: '2026-10-02T11:00:00+03:00', attention: true });
  for (const f of world.findings.filter((x) => !x.acknowledged && !['Missed billing', 'Blocked billing', 'Clearance rejected'].includes(x.kind))) out.push({ id: `find:${f.id}`, type: 'acknowledge_finding', agentId: 'hares', clientId: f.clientId, amount: f.amount, currency: 'SAR', title: `${f.kind} — ${f.summary}`, preview: f.detail, reference: f.id, decision: 'Acknowledge and assign the follow-up', authority: 'Head of Revenue & Treasury', roles: ['faisal', 'noura', 'majed'], recordRef: f.id, at: '2026-10-01T07:15:00+03:00', attention: false });
  // Payroll — the register HR owes, then the proof the Accounting Manager signs
  const pay = payrollSummary(world);
  if (pay && pay.run.status === 'awaited') out.push({ id: `pay:${pay.run.id}`, type: 'receive_payroll', agentId: 'rawatib', amount: pay.run.netPay, currency: 'SAR', title: `Payroll register overdue — HR, ${pay.late} WD late`, preview: `Paid ${pay.run.paidOn} through WPS; the register is due 3 WD after pay-out. Iqfal reminded HR ${pay.reminders.length}×. When it lands, Rawatib proves it to the bank, the GL and the headcount before anyone books it.`, reference: pay.run.id, decision: 'Read the register from the HR payroll system and run the proof', authority: 'Accountant', roles: ['omar', 'reem', 'noura'], recordRef: pay.run.id, at: '2026-10-05T07:00:00+03:00', attention: true });
  if (pay && pay.run.status === 'received') out.push({ id: `pay:${pay.run.id}`, type: 'approve_payroll', agentId: 'rawatib', amount: pay.run.employerCost, currency: 'SAR', title: `Sign the payroll proof — ${pay.run.period}: register = WPS = GL`, preview: pay.run.proof?.note ?? '', reference: pay.run.id, decision: 'Sign the proof; the payroll and provisions journals go to approval', authority: 'Accounting Manager', roles: ['reem', 'noura'], recordRef: pay.run.id, at: '2026-10-06T09:00:00+03:00', attention: true });
  // VAT — prepare, then approve
  const vat = vatForPeriod(world);
  if (vat.ret && vat.ret.status === 'open') out.push({ id: `vat:${vat.ret.id}`, type: 'prepare_vat', agentId: 'iqfal', amount: vat.figures.netPayable, currency: 'SAR', title: `Prepare the VAT return — ${vat.ret.period} (due ${vat.ret.filingDueOn})`, preview: vat.rejected.length ? `${vat.rejected.length} invoice(s) rejected by ZATCA must be cleared first.` : `Output VAT on ${vat.figures.salesCount} cleared invoices, input VAT on ${vat.figures.purchaseCount} posted vendor invoice(s).${vat.figures.deferredInputVat ? ` SAR ${vat.figures.deferredInputVat.toLocaleString('en-US')} input VAT not claimable yet.` : ''}`, reference: vat.ret.id, decision: 'Freeze the figures from the ledger and send the return to the CFO', authority: 'Accounting Manager', roles: ['reem', 'omar', 'noura'], recordRef: vat.ret.id, at: '2026-10-06T06:10:00+03:00', attention: !vat.rejected.length });
  if (vat.ret && vat.ret.status === 'prepared') out.push({ id: `vat:${vat.ret.id}`, type: 'approve_vat', agentId: 'iqfal', amount: vat.figures.netPayable, currency: 'SAR', title: `Approve the VAT return — ${vat.ret.period}: SAR ${vat.figures.netPayable.toLocaleString('en-US')} payable`, preview: `Output SAR ${vat.figures.outputVat.toLocaleString('en-US')} − input SAR ${vat.figures.inputVat.toLocaleString('en-US')}; filed on the ZATCA portal by ${vat.ret.filingDueOn}.`, reference: vat.ret.id, decision: 'Approve for filing and post the VAT settlement journal', authority: 'Chief Financial Officer', roles: ['noura'], recordRef: vat.ret.id, at: '2026-10-06T09:30:00+03:00', attention: true });
  // Delivery without PO cover — the KAM records the instrument when it arrives
  for (const e of world.events.filter((x) => x.noPoCover && !x.invoiceId)) out.push({ id: `pocover:${e.id}`, type: 'record_po_cover', agentId: 'aqd', clientId: e.clientId, amount: e.expectedAmount, currency: e.currency, title: `PO cover — ${c(e.clientId)!.short}: ${e.label}`, preview: e.note ?? 'Delivered without an instrument to bill against.', reference: e.id, decision: 'Record the PO extension when it is received from the client (Sirion); the event becomes due', authority: 'Key Account Manager', roles: ['majed', 'faisal', 'noura'], recordRef: e.id, at: '2026-10-01T07:15:00+03:00', attention: true });
  // ERP jobs still to read back
  const openJobs = world.erpJobs.filter((j) => j.period === world.closingPeriod && j.status !== 'completed');
  if (openJobs.length) out.push({ id: 'erp:fa', type: 'read_erp_jobs', agentId: 'iqfal', title: `Fixed Assets jobs not yet run — ${openJobs.map((j) => `P${j.procedure}`).join(', ')}`, preview: openJobs.map((j) => `${j.name}: ${j.summary ?? j.status}`).join(' · '), reference: openJobs[0].id, decision: 'Read the job status back from the ERP once Fixed Assets has run depreciation and Create Accounting', authority: 'Accountant', roles: ['omar', 'reem', 'noura'], recordRef: openJobs[0].id, at: '2026-10-06T06:00:00+03:00', attention: false });
  for (const p of world.pos.filter((x) => !x.scheduleConfirmed)) out.push({ id: `sched:${p.id}`, type: 'confirm_schedule', agentId: 'aqd', clientId: p.clientId, amount: p.value, currency: p.currency, title: `Confirm billing schedule — ${c(p.clientId)!.short} ${p.id}`, preview: `${p.lines.length} line(s); ${p.lines.flatMap((l) => l.matchFlags).length} mismatch flag(s)`, reference: p.id, decision: 'Confirm the schedule Aqd generated', authority: 'Head of Revenue & Treasury', roles: ['faisal', 'noura'], recordRef: p.id, at: '2026-10-06T08:00:00+03:00', attention: true });
  return out.sort((a, b) => (Number(b.attention) - Number(a.attention)) || (b.amount ?? 0) - (a.amount ?? 0));
}
