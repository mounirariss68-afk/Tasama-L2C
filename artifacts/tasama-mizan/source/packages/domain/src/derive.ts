/**
 * Everything a screen shows about status, exposure, variance or readiness
 * comes from here. Screens read; they never compute.
 */
import type {
  BankAccount, BankLine, BillingEvent, BusinessLine, CashReceipt, Client, CloseItem, Invoice, LedgerEntry,
  POLine, World,
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

/** Illustrative internal delivery cost per business line, as a share of recognised revenue. */
export const STAFF_COST_RATIO: Record<BusinessLine, number> = {
  '502': 0.12, '504': 0.46, '506': 0.44, 'SES-FIN': 0.58, 'SES-HR': 0.6, 'SES-PROC': 0.57, BES: 0.52, EVAS: 0.5,
};

export function marginByClient(world: World) {
  const rows: { client: Client; revenue: number; vendorCost: number; staffCost: number; margin: number; marginPct: number }[] = [];
  for (const c of world.clients) {
    let revenue = 0, staff = 0;
    for (const e of world.events) {
      if (e.clientId !== c.id) continue;
      const l = lineOf(world, e.lineId);
      let amt = 0;
      if (l.pricingModel === 'advance') amt = (e.expectedAmount / 12) * Math.max(0, Math.min(12, monthOf(world.asOf) - 1 - monthOf(l.start) + 1));
      else if (!e.noPoCover && e.dueDate <= world.asOf && evidenceComplete(e)) amt = e.expectedAmount;
      const sar = toSAR(amt, e.currency);
      revenue += sar; staff += sar * STAFF_COST_RATIO[l.businessLine];
    }
    const lineIds = new Set(world.pos.filter((p) => p.clientId === c.id).flatMap((p) => p.lines.map((l) => l.id)));
    const vendorCost = world.vendorInvoices.filter((v) => v.clientPOLineId && lineIds.has(v.clientPOLineId) && (v.matchStatus === 'matched' || v.matchStatus === 'proposed')).reduce((s, v) => s + v.net, 0);
    const margin = revenue - vendorCost - staff;
    rows.push({ client: c, revenue, vendorCost, staffCost: staff, margin, marginPct: revenue ? margin / revenue : 0 });
  }
  return rows.sort((a, b) => b.revenue - a.revenue);
}

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

export function deriveCloseItems(world: World): CloseItem[] {
  const events = world.events.filter((e) => e.period === world.closingPeriod || eventStatus(world, e) === 'missed');
  const billingOpen = events.filter((e) => ['due', 'missed'].includes(eventStatus(world, e)));
  const blocked = events.filter((e) => isBlocked(eventStatus(world, e)));
  const recs = world.bankAccounts.map((a) => bankRec(world, a.id));
  const cash = cashStats(world);
  const rejected = world.invoices.filter((i) => i.zatca === 'rejected');
  const vendorOpen = world.vendorInvoices.filter((v) => ['proposed', 'no_po'].includes(v.matchStatus));
  const journalsOpen = world.journals.filter((j) => j.status === 'proposed');
  return world.closeItems.map((c) => {
    const x = { ...c };
    switch (c.derivedFrom) {
      case 'billing':
        if (billingOpen.length === 0 && blocked.length === 0) { x.status = 'done'; x.evidence = 'All September events invoiced; nothing missed.'; }
        else { x.status = blocked.length ? 'blocked' : 'in_progress'; x.blocker = `${billingOpen.length} event(s) due or missed, ${blocked.length} blocked (${blocked.map((e) => EVENT_STATUS_LABEL[eventStatus(world, e)]).filter((v, i, a) => a.indexOf(v) === i).join('; ')})`; }
        break;
      case 'journals': {
        const j = world.journals.find((jj) => (c.id === 'c02' ? jj.kind === 'Unbilled revenue accrual' : jj.kind === 'Deferred revenue release'));
        x.status = j?.status === 'posted' ? 'done' : j?.status === 'approved' ? 'in_progress' : 'not_started';
        if (j?.status === 'posted') x.evidence = `${j.id} posted (${j.erpRef ?? 'ERP'})`;
        break;
      }
      case 'ar_tie': {
        const sub = arOpen(world); x.evidence = `AR sub-ledger SAR ${Math.round(sub).toLocaleString('en-US')} = GL 1200 control (derived from the same invoices and receipts)`;
        x.status = cash.proposed.length || cash.unapplied.length ? 'in_progress' : 'done';
        if (x.status !== 'done') x.blocker = `${cash.proposed.length + cash.unapplied.length} receipt(s) not yet applied`;
        break;
      }
      case 'bank': {
        if (c.id === 'c09') { x.status = cash.proposed.length + cash.unapplied.length === 0 ? 'done' : 'in_progress'; x.blocker = x.status === 'done' ? undefined : `${cash.proposed.length} proposed, ${cash.unapplied.length} unapplied`; }
        else { const signed = recs.filter((r) => r.account.signedOff).length; x.status = signed === recs.length ? 'done' : signed ? 'in_progress' : (recs.every((r) => r.explained) ? 'in_progress' : 'blocked'); x.blocker = signed === recs.length ? undefined : `${recs.length - signed} account(s) not signed off; ${recs.reduce((s, r) => s + r.unmatchedStatement.length + r.unmatchedLedger.length, 0)} open item(s)`; }
        break;
      }
      case 'vendor':
        x.status = vendorOpen.length ? 'in_progress' : 'done'; x.blocker = vendorOpen.length ? `${vendorOpen.length} vendor invoice(s) unresolved (${vendorOpen.map((v) => v.matchStatus).join(', ')})` : undefined; break;
      case 'zatca':
        x.status = rejected.length ? 'blocked' : 'done'; x.blocker = rejected.length ? `${rejected.length} invoice(s) rejected by ZATCA` : undefined; break;
      case 'budget':
        x.status = journalsOpen.length ? 'in_progress' : 'in_progress'; break;
    }
    return x;
  });
}

export function closeSummary(world: World) {
  const items = deriveCloseItems(world);
  const by = (s: CloseItem['status']) => items.filter((i) => i.status === s).length;
  return { items, done: by('done'), inProgress: by('in_progress'), blocked: by('blocked'), notStarted: by('not_started'), total: items.length, readyToClose: items.filter((i) => i.id !== 'c17').every((i) => i.status === 'done') };
}

/* ------------------------------------------------------------ inbox */

export type InboxType =
  | 'release_invoice' | 'draft_catchup' | 'approve_coc' | 'escalate_coc' | 'approve_dunning' | 'apply_cash'
  | 'approve_vendor' | 'resolve_vendor' | 'approve_journal' | 'sign_bank_rec' | 'fix_zatca' | 'acknowledge_finding' | 'confirm_schedule' | 'accept_reforecast';

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
  for (const p of world.pos.filter((x) => !x.scheduleConfirmed)) out.push({ id: `sched:${p.id}`, type: 'confirm_schedule', agentId: 'aqd', clientId: p.clientId, amount: p.value, currency: p.currency, title: `Confirm billing schedule — ${c(p.clientId)!.short} ${p.id}`, preview: `${p.lines.length} line(s); ${p.lines.flatMap((l) => l.matchFlags).length} mismatch flag(s)`, reference: p.id, decision: 'Confirm the schedule Aqd generated', authority: 'Head of Revenue & Treasury', roles: ['faisal', 'noura'], recordRef: p.id, at: '2026-10-06T08:00:00+03:00', attention: true });
  return out.sort((a, b) => (Number(b.attention) - Number(a.attention)) || (b.amount ?? 0) - (a.amount ?? 0));
}
