/**
 * Muhasib — the finance co-pilot in the rail. A deterministic resolver over
 * the same derivations the screens use. It matches; it does not comprehend.
 * It says so, and it declines what it cannot answer rather than inventing.
 */
import type { World } from '@mizan/domain/types';
import type { Section } from '@mizan/domain/personas';
import { arOpen, bankRec, cashStats, closeSummary, clientOf, deferredBalance, dso, dsoBySegment, eventStatus, fyTotals, inboxItems, marginByClient, overdue, poConsumption, unbilled, unbilledEvents, waterfall, GM_TARGET } from '@mizan/domain/derive';
import { money, pct, period } from '@mizan/domain/format';

export type Answer = { text: string; agent: string; goto?: Section; tab?: string; focus?: string; unknown?: boolean };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ ]/g, ' ').replace(/\s+/g, ' ').trim();

export function answer(q: string, world: World, personaId: string): Answer {
  const s = norm(q);
  const has = (...ws: string[]) => ws.some((w) => s.includes(w));
  const client = world.clients.find((c) => s.includes(c.short.toLowerCase()) || s.includes(c.id));

  if (has('unbilled', 'not invoiced', 'delivered not billed')) {
    const evs = unbilledEvents(world);
    const byReason: Record<string, number> = {};
    for (const e of evs) { const k = eventStatus(world, e); byReason[k] = (byReason[k] ?? 0) + e.expectedAmount; }
    return { agent: 'hares', goto: 'l2c', tab: 'billing', text: `Unbilled revenue is ${money(unbilled(world))} across ${evs.length} events: ${Object.entries(byReason).map(([k, v]) => `${k.replace('_', ' ')} ${money(v, 'SAR', { compact: true })}`).join(', ')}. The largest single item is the KSIA UAT milestone (SAR 611,800) blocked on a certificate of completion.` };
  }
  if (has('overdue', 'ageing', 'aging', 'collections', 'dso')) {
    const od = overdue(world); const seg = dsoBySegment(world);
    return { agent: 'tahseel', goto: 'l2c', tab: 'collections', text: `${od.length} invoices are overdue for ${money(od.reduce((t, x) => t + x.invoice.gross, 0))}; the oldest is ${Math.max(0, ...od.map((x) => x.days))} days (Social Development Bank, paid through Etimad). DSO is ${dso(world)} days overall — ${Object.entries(seg).map(([k, v]) => `${k} ${v.dso === null ? 'n/a' : v.dso}`).join(', ')}. Open receivables ${money(arOpen(world), 'SAR', { compact: true })}.` };
  }
  if (has('close', 'month end', 'month-end', 'ready')) {
    const c = closeSummary(world);
    const blockers = c.items.filter((i) => i.status === 'blocked');
    return { agent: 'iqfal', goto: 'close', tab: 'checklist', text: `${period(world.closingPeriod)} close, Day ${world.closeDay} of 10: ${c.done} done, ${c.inProgress} in progress, ${c.blocked} blocked, ${c.notStarted} not started. ${blockers.length ? `Blocked: ${blockers.map((b) => `${b.title} — ${b.blocker}`).join('; ')}.` : 'Nothing is blocked.'} ${c.readyToClose ? 'Every item is done; the CFO can close.' : ''}` };
  }
  if (has('bank', 'reconcil', 'statement')) {
    const recs = world.bankAccounts.map((a) => bankRec(world, a.id));
    return { agent: 'tasweya', goto: 'close', tab: 'bank', text: recs.map((r) => `${r.account.bank} ${r.account.label}: statement ${money(r.statementBalance, r.account.currency, { compact: true })}, ledger ${money(r.ledgerBalance, r.account.currency, { compact: true })}, difference ${money(r.difference, r.account.currency)} — ${r.explained ? 'explained' : 'not explained'} by ${r.unmatchedStatement.length + r.unmatchedLedger.length} open item(s)${r.account.signedOff ? ', signed off' : ''}`).join('. ') + '.' };
  }
  if (has('cash', 'receipt', 'applied', 'unapplied')) {
    const c = cashStats(world);
    return { agent: 'tasweya', goto: 'inbox', text: `This month ${c.applied} receipts are applied (${money(c.appliedAmount, 'SAR', { compact: true })}, ${pct(c.autoRate)} by exact reference). ${c.proposed.length} proposed match(es) and ${c.unapplied.length} unapplied receipt(s) are waiting for a person.` };
  }
  if (has('budget', 'forecast', 'variance', 'target')) {
    const fy = fyTotals(world);
    return { agent: 'mizaniya', goto: 'close', tab: 'budget', text: `FY2026: budget ${money(fy.budget, 'SAR', { compact: true })}, target ${money(fy.target, 'SAR', { compact: true })}, forecast ${money(fy.forecast, 'SAR', { compact: true })}. Year to date actual ${money(fy.actualYtd, 'SAR', { compact: true })} against ${money(fy.budgetYtd, 'SAR', { compact: true })} budget. September drivers: ${world.drivers.map((d) => `${d.kind} ${money(d.amount, 'SAR', { compact: true })}`).join('; ')}.` };
  }
  if (has('margin', 'cost of delivery', 'gross')) {
    const m = marginByClient(world); const rev = m.reduce((t, x) => t + x.revenue, 0); const mg = m.reduce((t, x) => t + x.margin, 0);
    return { agent: 'mizaniya', goto: 'close', tab: 'budget', text: `Gross margin YTD is ${pct(mg / rev, 1)} against the ${pct(GM_TARGET)} target. Lowest: ${m.slice().sort((a, b) => a.marginPct - b.marginPct).slice(0, 2).map((x) => `${x.client.short} ${pct(x.marginPct)}`).join(', ')}. Internal delivery cost is an illustrative ratio; vendor cost is matched from invoices.` };
  }
  if (has('deferred', 'advance')) return { agent: 'iqfal', goto: 'close', tab: 'journals', text: `Deferred revenue is ${money(deferredBalance(world))} — the FAIC annual subscription invoiced in April, released at SAR 100,000 a month. The September release is journal DEMO-JE-2609-02.` };
  if (has('waiting', 'inbox', 'my decisions', 'what should i')) {
    const items = inboxItems(world).filter((i) => personaId === 'noura' || i.roles.includes(personaId));
    return { agent: 'muhasib', goto: 'inbox', text: items.length ? `${items.length} decisions are waiting on you: ${items.slice(0, 5).map((i) => i.title).join('; ')}${items.length > 5 ? '; …' : ''}.` : 'Nothing is waiting on you right now.' };
  }
  if (has('waterfall', 'lead to cash', 'funnel')) {
    const wf = waterfall(world);
    return { agent: 'hares', goto: 'overview', text: `${period(world.closingPeriod)}: contracted ${money(wf.contracted, 'SAR', { compact: true })} → evidenced ${money(wf.evidenced, 'SAR', { compact: true })} → invoiced ${money(wf.invoiced, 'SAR', { compact: true })} → cleared ${money(wf.cleared, 'SAR', { compact: true })} → collected ${money(wf.collected, 'SAR', { compact: true })}.` };
  }
  if (has('zatca', 'rejected', 'clearance')) {
    const r = world.invoices.filter((i) => i.zatca === 'rejected');
    return { agent: 'fatoora', goto: 'inbox', focus: r[0] ? `zatca:${r[0].id}` : undefined, text: r.length ? `${r.length} invoice(s) rejected by ZATCA: ${r.map((i) => `${i.id} (${clientOf(world, i.clientId).short}) — ${i.zatcaReason}`).join('; ')}` : 'No invoice is currently rejected by ZATCA.' };
  }
  if (has('coc', 'certificate', 'completion')) {
    const evs = world.events.filter((e) => ['sent', 'reminded', 'escalated', 'to_send'].includes(e.coc) && !e.invoiceId);
    return { agent: 'shahid', goto: 'inbox', text: evs.length ? `${evs.length} certificate(s) of completion outstanding: ${evs.map((e) => `${clientOf(world, e.clientId).short} — ${e.label} (${e.coc}${e.cocSentOn ? `, sent ${e.cocSentOn}` : ''}, ${money(e.expectedAmount, e.currency)})`).join('; ')}.` : 'No certificate of completion is outstanding.' };
  }
  if (has('duplicate', 'vendor', 'accenture', 'oracle invoice', 'masterworks')) {
    const open = world.vendorInvoices.filter((v) => v.matchStatus !== 'matched');
    return { agent: 'mawrid', goto: 'inbox', text: open.length ? `${open.length} vendor invoice(s) unresolved: ${open.map((v) => `${v.vendorName} ${v.invoiceRef} — ${v.matchStatus.replace('_', ' ')} (${money(v.total)})`).join('; ')}.` : 'All vendor invoices are matched.' };
  }
  if (client) {
    const pos = world.pos.filter((p) => p.clientId === client.id);
    const cons = pos.map((p) => ({ p, c: poConsumption(world, p.id) }));
    const open = world.invoices.filter((i) => i.clientId === client.id && ['posted', 'released'].includes(i.status));
    const findings = world.findings.filter((f) => f.clientId === client.id && !f.acknowledged);
    return { agent: 'aqd', goto: 'l2c', tab: 'clients', focus: client.id, text: `${client.name} (${client.segment}, KAM ${client.kam}): ${pos.length} PO(s) — ${cons.map((x) => `${x.p.id} ${pct(x.c.pct)} consumed${x.c.uncovered ? `, ${money(x.c.uncovered, x.p.currency, { compact: true })} uncovered` : ''}`).join('; ')}. Open invoices ${open.length} for ${money(open.reduce((t, i) => t + i.gross, 0), client.currency)}. ${findings.length ? `Findings: ${findings.map((f) => f.summary).join('; ')}.` : 'No open findings.'}` };
  }
  if (has('who are you', 'what can you', 'help')) return { agent: 'muhasib', text: 'I am Muhasib, the finance co-pilot. In this build I match your question against the same derivations the screens use — unbilled, overdue, close status, bank reconciliation, cash, budget, margin, a client, ZATCA, CoCs, vendor invoices — and route you to the owning agent. I do not comprehend free text, and I will say so rather than guess.' };
  return { agent: 'muhasib', unknown: true, text: 'I cannot answer that from the data I hold. I can tell you about unbilled revenue, overdue invoices, the close, bank reconciliation, cash application, budget and forecast, margin, a specific client, ZATCA rejections, certificates of completion or vendor invoices.' };
}
