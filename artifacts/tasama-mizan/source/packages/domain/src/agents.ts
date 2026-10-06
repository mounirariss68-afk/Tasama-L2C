/**
 * The agent team. Names are the Arabic word for the job. Autonomy is the rung
 * the prototype actually runs at (design §4) — if it asks, it is A2.
 */
import type { Autonomy } from './types';

export type AgentDef = {
  id: string;
  name: string;
  arabic: string;
  role: string;
  purpose: string;
  autonomy: Autonomy;
  autonomyNote: string;
  initials: string;
  hue: number;
  functions: string[];
  superpower: string;
  impact: string;
};

export const AGENTS: AgentDef[] = [
  {
    id: 'aqd', name: 'Aqd', arabic: 'عقد', role: 'Contract & Order Terms Analyst', initials: 'AQ', hue: 246,
    purpose: 'Turns a signed contract and a client PO into a confirmed billing schedule, and flags where the PO disagrees with the quote or the contract has run out.',
    autonomy: 'recommend', autonomyNote: 'Proposes the schedule and the PO–quote match; the Head of Revenue & Treasury confirms. Expiry and top-up requests are drafted for the KAM.',
    functions: ['Read billing terms from Sirion: payment terms, frequency, milestones, rate card, CoC requirement, expiry', 'Match each client PO line to its quote line — price, quantity, term, missing lines', 'Expand every PO line into dated billing events by pricing model', 'Watch PO consumption and contract expiry; draft top-up and renewal requests at 80% and 90/60/30 days'],
    superpower: 'Reads every PO against its contract the day it arrives, so the schedule exists before the first service month ends.',
    impact: 'Nothing is delivered without the instrument to bill it being known in advance; the spreadsheet that joined proposal, PO, invoice and collection by hand is replaced by a schedule that cannot disagree with itself.',
  },
  {
    id: 'shahid', name: 'Shahid', arabic: 'شاهد', role: 'Delivery Evidence & CoC Coordinator', initials: 'SH', hue: 200,
    purpose: 'Collects the evidence a billing event needs, drafts and sends the certificate-of-completion request, chases it, and escalates when it stalls.',
    autonomy: 'supervised', autonomyNote: 'Reminders go out on the configured cadence and are reported (A3). Sending the first CoC request needs approval (A2). Escalation to the sponsor is proposed to the KAM (A1).',
    functions: ['Collect delivery evidence per event: timesheets, PPM milestones, ServiceNow volumes, licence activation', 'Draft the CoC request with the evidence pack attached', 'Remind at the configured days after sending', 'Escalate to the KAM with the pack when the cadence is exhausted'],
    superpower: 'Never lets a signed-off deliverable sit without a certificate, and never asks a client for a signature without the evidence attached.',
    impact: 'The CoC — Tasama\'s own gate to invoicing — stops being the step that is "stuck with finance waiting for COCs".',
  },
  {
    id: 'fatoora', name: 'Fatoora', arabic: 'فاتورة', role: 'Billing Agent', initials: 'FA', hue: 265,
    purpose: 'Drafts invoices when a billing event is due and evidenced, pre-validates the ZATCA fields, posts to the ERP once released, and handles clearance rejections.',
    autonomy: 'assisted', autonomyNote: 'Every invoice is released by a person with the authority for its amount. Re-submission after an approved field fix runs without a second approval.',
    functions: ['Run the month-end billing schedule and draft every due, evidenced event', 'Validate the mandatory ZATCA fields before release (buyer VAT number, PO reference, currency, VAT category)', 'Post released invoices through the ERP connector and read back the clearance status', 'Route rejections with the reason and the fix'],
    superpower: 'Drafts a month of invoices in the time it took to open the tracker, and refuses to draft one it cannot evidence.',
    impact: 'Invoices are no longer "requested manually through Excel, then processed via ERP"; the missed invoice becomes an exception that surfaces on day one instead of at year end.',
  },
  {
    id: 'hares', name: 'Hares', arabic: 'حارس', role: 'Revenue Assurance Analyst', initials: 'HA', hue: 20,
    purpose: 'Runs the four-way check — contract, delivery, invoice, cash — every day and names every leak.',
    autonomy: 'recommend', autonomyNote: 'Finds and explains; proposes the correcting action (catch-up invoice, debit note, PO top-up). People dispose.',
    functions: ['Delivered and evidenced but not invoiced (missed, blocked)', 'Invoiced below the contract rate', 'Delivery continuing on an exhausted or expired PO', 'Credit notes without a recorded reason; invoices rejected by ZATCA'],
    superpower: 'Compares every delivered day and month against the instrument that should have billed it, across all clients, before anyone has opened a spreadsheet.',
    impact: 'Revenue assurance — "timely and accurate billing as well as collection" — becomes a daily list with amounts, not a quarterly discovery.',
  },
  {
    id: 'tahseel', name: 'Tahseel', arabic: 'تحصيل', role: 'Collections Agent', initials: 'TA', hue: 160,
    purpose: 'Works the ageing: reminders in the right tone and language, promise-to-pay tracking, dispute flags, escalation to the KAM.',
    autonomy: 'assisted', autonomyNote: 'Dunning to PIF and Government accounts is approved by the KAM (A2). Private accounts under the auto-dunning limit are sent and reported (A3).',
    functions: ['Age every open invoice and propose the next dunning stage by segment and channel (bank transfer, Etimad, international wire)', 'Draft the notice in the account\'s tone; Arabic or English', 'Log promises to pay and disputes against the invoice', 'Escalate to the KAM and the CFO at the thresholds'],
    superpower: 'Knows that a Government invoice is paid through Etimad and a PIF invoice through a payment run, and times the ask to the cycle rather than the calendar.',
    impact: 'Overdue invoices become visible to the KAM who owns the relationship — the "no integrated visibility into overdue invoices" gap.',
  },
  {
    id: 'tasweya', name: 'Tasweya', arabic: 'تسوية', role: 'Cash Application & Bank Reconciliation Agent', initials: 'TS', hue: 300,
    purpose: 'Reads bank statements through CogniDocs, applies receipts to invoices, reconciles every account to the ledger and proposes the adjusting entries.',
    autonomy: 'supervised', autonomyNote: 'Exact reference matches are applied and reported (A3). Amount-plus-client and tolerance matches are proposed (A1). Adjusting journals are prepared for approval (A2).',
    functions: ['Ingest each statement: reference, amount, direction, counterparty, date', 'Match credits to open invoices: reference → amount + client → tolerance → one-to-many', 'Match debits to ledger payments, payroll, GOSI, VAT and transfers', 'Prove each account: statement balance, ledger balance, open items, adjustments'],
    superpower: 'Applies a morning\'s receipts before the accountant has logged into the bank portal, and never applies one it cannot explain.',
    impact: 'Bank reconciliation stops depending on "receiving transactions from the bank and manual reconciliation"; the Day-1 statement becomes a Day-1 reconciliation.',
  },
  {
    id: 'mawrid', name: 'Mawrid', arabic: 'مورد', role: 'Cost-to-Deliver Agent', initials: 'MA', hue: 40,
    purpose: 'Reads vendor invoices through CogniDocs, three-way matches them to vendor POs and delivery, allocates cost to the client PO line, and raises the pass-through billing event.',
    autonomy: 'assisted', autonomyNote: 'Matches are approved by the Accountant; duplicates and invoices without a PO are refused and routed, never posted.',
    functions: ['Ingest vendor invoices with line items and the vendor\'s banking details', 'Three-way match to vendor PO and delivery evidence; refuse duplicates on (vendor, normalised reference)', 'Allocate cost to the client PO line so margin exists per line', 'Raise the pass-through billing event with the contract mark-up; accrue delivered-not-invoiced cost at close'],
    superpower: 'Ties a subcontractor\'s invoice to the client line it was bought for, so gross margin is known per deal and not only per quarter.',
    impact: 'Pass-through licences and subcontracted scope stop sitting as unexplained cost; the margin conversation moves from the P&L to the PO line.',
  },
  {
    id: 'iqfal', name: 'Iqfal', arabic: 'إقفال', role: 'Close Orchestrator', initials: 'IQ', hue: 220,
    purpose: 'Runs the month-end checklist against the day counter, computes accruals and deferrals, ties AR to GL, assembles the close pack and names what blocks the close.',
    autonomy: 'supervised', autonomyNote: 'The checklist and the pack run and report (A3). Every journal is approved by the Accounting Manager before posting (A2). The CFO closes.',
    functions: ['Derive the status of every checklist item from the data, not from a tick box', 'Compute the unbilled revenue accrual and the deferred revenue release', 'Tie the AR sub-ledger to the GL control account', 'Assemble the management-accounts schedules and name the blockers by owner'],
    superpower: 'Knows on Day 1 what will block Day 5, because the checklist is read from the ledger rather than written by hand.',
    impact: 'A close that today takes the full 10 business days has a credible path to the five-day target Tasama\'s business case assumed.',
  },
  {
    id: 'mizaniya', name: 'Mizaniya', arabic: 'ميزانية', role: 'Budget & Forecast Analyst', initials: 'MZ', hue: 95,
    purpose: 'Compares Budget · Target · Forecast · Actual by month, business line and client, decomposes variances into causes and proposes the reforecast.',
    autonomy: 'recommend', autonomyNote: 'Explains and proposes; FP&A accepts the reforecast.',
    functions: ['Hold Tasama\'s four columns per month and business line', 'Decompose each variance: PO not received, timing, expired cover, rate, FX, scope', 'Build the forecast from the billing schedule plus weighted pipeline', 'Propose the reforecast and the commentary for the close pack'],
    superpower: 'Explains a variance in the words of the contract that caused it, not in the words of the ledger.',
    impact: 'Budget-versus-actual stops being a monthly Excel exercise with manual revenue input; the forecast is the schedule.',
  },
];

export const ASSISTANT = {
  id: 'muhasib', name: 'Muhasib', arabic: 'محاسب', role: 'Finance co-pilot', initials: 'MU', hue: 246,
  purpose: 'Answers from the same data the screens use and routes to the owning agent.',
};

export const agentById = (id: string) => AGENTS.find((a) => a.id === id) ?? { ...ASSISTANT, autonomy: 'observe' as Autonomy, autonomyNote: '', functions: [], superpower: '', impact: '' };

/** A deterministic monogram avatar in the brand palette, as a data URI. */
export function avatarFor(a: { initials: string; hue: number }) {
  const h = a.hue;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 70% 28%)"/><stop offset="1" stop-color="hsl(${(h + 40) % 360} 60% 48%)"/></linearGradient></defs><rect width="96" height="96" rx="48" fill="url(#g)"/><text x="48" y="58" text-anchor="middle" font-family="Comfortaa, Inter, sans-serif" font-size="32" font-weight="700" fill="white">${a.initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
