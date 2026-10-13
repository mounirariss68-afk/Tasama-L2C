/**
 * Workflow catalog and walkthroughs. Every step: actor, inputs, outputs,
 * decision. Coverage says what the prototype actually runs.
 */
import type { Autonomy } from './types';

export type Coverage = 'implemented' | 'partial' | 'designed' | 'manual';

export type WorkflowStepDef = {
  title: string; actor: string; detail: string; inputs: string[]; outputs: string[]; decision?: string; autonomy?: Autonomy; coverage: Coverage;
};
export type StageRef = 'lead-to-contract' | 'contract-to-service' | 'service-to-cash' | 'close';
export type WorkflowDef = {
  id: string; stage: StageRef; name: string; purpose: string; trigger: string; outcome: string; coverage: Coverage; autonomy: Autonomy; agents: string[]; steps: WorkflowStepDef[];
};

export const WORKFLOWS: WorkflowDef[] = [
  {
    id: 'wf-01', stage: 'contract-to-service', name: 'PO intake to billing schedule', purpose: 'Turn a client PO into dated billing events the moment it arrives.', trigger: 'Client PO received (email, Business Center, Etimad award) or Salesforce closed-won.', outcome: 'A confirmed billing schedule per PO line, mismatches flagged to the KAM.', coverage: 'implemented', autonomy: 'assisted', agents: ['aqd'],
    steps: [
      { title: 'Register the PO', actor: 'KAM / Aqd', detail: 'PO number in the client\'s own format, date, value, currency, lines.', inputs: ['PO document', 'Signed contract (Sirion)', 'Quote lines (Salesforce Revenue)'], outputs: ['PO record', 'Customer account update (ERP)'], coverage: 'implemented' },
      { title: 'Match PO lines to quote lines', actor: 'Aqd', detail: 'Price, quantity, term, missing lines, expired contract.', inputs: ['PO lines', 'Quote lines', 'Rate card version'], outputs: ['Match flags per line'], decision: 'Aqd flags; the KAM resolves with the client.', autonomy: 'assisted', coverage: 'implemented' },
      { title: 'Expand into billing events', actor: 'Aqd', detail: 'By pricing model: monthly fixed, days × rate, volume bundle, milestone %, one-off, pass-through, advance.', inputs: ['PO lines', 'Contract terms'], outputs: ['Billing events with evidence requirements'], autonomy: 'recommend', coverage: 'implemented' },
      { title: 'Confirm the schedule', actor: 'Head of Revenue & Treasury', detail: 'Reviews the proposed schedule and the flags.', inputs: ['Proposed schedule'], outputs: ['Confirmed schedule'], decision: 'Confirm, or send back with a correction.', coverage: 'implemented' },
    ],
  },
  {
    id: 'wf-02', stage: 'service-to-cash', name: 'Evidence and certificate of completion', purpose: 'Get the acceptance that gates every invoice, with the evidence attached.', trigger: 'A billing event reaches its due date with evidence complete and CoC required.', outcome: 'CoC signed, or the stall escalated to the KAM with the pack.', coverage: 'implemented', autonomy: 'supervised', agents: ['shahid'],
    steps: [
      { title: 'Collect evidence', actor: 'Shahid', detail: 'Timesheets, PPM milestone acceptance, ServiceNow volumes, licence activation, service month elapsed.', inputs: ['PPM', 'ServiceNow', 'Timesheets'], outputs: ['Evidence pack per event'], autonomy: 'supervised', coverage: 'implemented' },
      { title: 'Draft the CoC request', actor: 'Shahid', detail: 'Client-facing request with the pack; Arabic or English by account.', inputs: ['Evidence pack', 'Contract CoC clause'], outputs: ['Draft email + CoC form'], autonomy: 'assisted', coverage: 'implemented' },
      { title: 'Approve and send', actor: 'KAM', detail: 'The KAM owns the client relationship and approves the first ask.', inputs: ['Draft'], outputs: ['Sent request, logged'], decision: 'Send as drafted, edit, or hold.', coverage: 'implemented' },
      { title: 'Remind on cadence', actor: 'Shahid', detail: 'Default +3, +7, +10 working days; configurable.', inputs: ['Cadence setting'], outputs: ['Reminders, logged'], autonomy: 'supervised', coverage: 'implemented' },
      { title: 'Escalate', actor: 'Shahid → KAM → Sponsor', detail: 'When the cadence is exhausted, an escalation to the client sponsor is proposed to the KAM.', inputs: ['Reminder history', 'Pack'], outputs: ['Escalation email'], decision: 'KAM approves the escalation.', autonomy: 'recommend', coverage: 'implemented' },
    ],
  },
  {
    id: 'wf-03', stage: 'service-to-cash', name: 'Month-end billing run', purpose: 'Invoice every due, evidenced event; withhold every one that is not.', trigger: 'Close Day 1, and on demand.', outcome: 'Released invoices posted to the ERP and cleared by ZATCA; withheld events named with the reason.', coverage: 'implemented', autonomy: 'assisted', agents: ['fatoora', 'hares'],
    steps: [
      { title: 'Select due events', actor: 'Fatoora', detail: 'Period = closing month; evidence complete; CoC signed where required; PO cover exists.', inputs: ['Billing schedule', 'Evidence', 'CoC status'], outputs: ['Draft list', 'Withheld list with reasons'], autonomy: 'assisted', coverage: 'implemented' },
      { title: 'Draft and validate', actor: 'Fatoora', detail: 'Lines, VAT 15%, buyer VAT number, PO reference, currency; ZATCA mandatory-field check.', inputs: ['Event', 'Customer master'], outputs: ['Draft invoice'], autonomy: 'assisted', coverage: 'implemented' },
      { title: 'Release', actor: 'Head of Revenue & Treasury', detail: 'By amount authority.', inputs: ['Draft'], outputs: ['Released invoice'], decision: 'Release, hold, or reject with reason.', coverage: 'implemented' },
      { title: 'Post and clear', actor: 'Fatoora → ERP → ZATCA', detail: 'Oracle receivablesInvoices or Odoo account.move; clearance status read back.', inputs: ['Released invoice'], outputs: ['ERP reference', 'ZATCA status'], autonomy: 'supervised', coverage: 'partial' },
      { title: 'Handle rejection', actor: 'Fatoora', detail: 'Reason surfaced; field fix proposed; re-submission after approval.', inputs: ['Rejection reason'], outputs: ['Fixed invoice'], decision: 'Approve the field fix.', autonomy: 'assisted', coverage: 'implemented' },
    ],
  },
  {
    id: 'wf-04', stage: 'service-to-cash', name: 'Revenue assurance — the four-way check', purpose: 'Find every leak between contract, delivery, invoice and cash.', trigger: 'Daily 07:00, and after every billing run.', outcome: 'Findings with amounts and the proposed correction.', coverage: 'implemented', autonomy: 'recommend', agents: ['hares'],
    steps: [
      { title: 'Delivered, not invoiced', actor: 'Hares', detail: 'Events past due with evidence and no invoice; split missed vs blocked.', inputs: ['Schedule', 'Invoices'], outputs: ['Findings'], autonomy: 'recommend', coverage: 'implemented' },
      { title: 'Under-rate', actor: 'Hares', detail: 'Invoice rate vs contract rate card.', inputs: ['Invoices', 'Rate card (Sirion)'], outputs: ['Debit-note proposal'], autonomy: 'recommend', coverage: 'implemented' },
      { title: 'PO cover', actor: 'Hares', detail: 'Consumption above threshold; delivery on expired PO.', inputs: ['PO values', 'Schedule'], outputs: ['Top-up / extension request (via Aqd)'], autonomy: 'recommend', coverage: 'implemented' },
      { title: 'Dispose', actor: 'Head of Revenue & Treasury', detail: 'Acknowledge, assign, or dismiss with reason.', inputs: ['Findings'], outputs: ['Dispositions, trail'], decision: 'Per finding.', coverage: 'implemented' },
    ],
  },
  {
    id: 'wf-05', stage: 'service-to-cash', name: 'Collections', purpose: 'Get paid without damaging the account.', trigger: 'Invoice past due date; daily.', outcome: 'Notices sent at the right stage, promises and disputes logged, escalations made.', coverage: 'implemented', autonomy: 'assisted', agents: ['tahseel'],
    steps: [
      { title: 'Age and stage', actor: 'Tahseel', detail: 'Due +7 reminder, +21 second, +45 formal; Etimad accounts shifted by the approval cycle.', inputs: ['Open invoices', 'Segment', 'Channel'], outputs: ['Proposed stage'], autonomy: 'recommend', coverage: 'implemented' },
      { title: 'Draft the notice', actor: 'Tahseel', detail: 'Tone by account; Arabic or English.', inputs: ['Invoice', 'History'], outputs: ['Draft'], autonomy: 'assisted', coverage: 'implemented' },
      { title: 'Approve and send', actor: 'KAM (PIF / Gov) · auto (Private under limit)', detail: 'The KAM may change the stage — the override and its reason are kept.', inputs: ['Draft'], outputs: ['Sent notice'], decision: 'Send, change stage, or hold.', coverage: 'implemented' },
      { title: 'Log promise / dispute', actor: 'KAM / Tahseel', detail: 'Promise-to-pay dates re-stage the invoice; disputes stop dunning and open a case.', inputs: ['Client reply'], outputs: ['Promise or dispute on the invoice'], coverage: 'partial' },
    ],
  },
  {
    id: 'wf-06', stage: 'service-to-cash', name: 'Cash application and bank reconciliation', purpose: 'Apply every receipt; prove every account.', trigger: 'Bank statement received (CogniDocs job completed).', outcome: 'Receipts applied, open items named, adjustments proposed, reconciliation signed.', coverage: 'implemented', autonomy: 'supervised', agents: ['tasweya'],
    steps: [
      { title: 'Ingest the statement', actor: 'Tasweya ← CogniDocs', detail: 'direction, amount10k, reference, counterparty per line; confidence and fieldsMissing respected.', inputs: ['CogniDocs StatementResult'], outputs: ['Bank lines'], autonomy: 'observe', coverage: 'implemented' },
      { title: 'Match credits to invoices', actor: 'Tasweya', detail: 'Reference → amount + client → tolerance (SAR 50) → one-to-many.', inputs: ['Bank lines', 'Open invoices'], outputs: ['Applied / proposed receipts'], decision: 'Exact matches apply; the rest are proposed.', autonomy: 'supervised', coverage: 'implemented' },
      { title: 'Match debits to ledger', actor: 'Tasweya', detail: 'Payments, payroll, GOSI, VAT, transfers, charges.', inputs: ['Bank lines', 'Ledger'], outputs: ['Matched pairs', 'Open items'], autonomy: 'supervised', coverage: 'implemented' },
      { title: 'Propose adjustments', actor: 'Tasweya', detail: 'Bank charges, FX differences, timing items.', inputs: ['Open items'], outputs: ['Journals'], autonomy: 'assisted', coverage: 'implemented' },
      { title: 'Sign off', actor: 'Accounting Manager', detail: 'Statement balance − ledger balance = open items.', inputs: ['Reconciliation'], outputs: ['Signed reconciliation'], decision: 'Sign, or return.', coverage: 'implemented' },
    ],
  },
  {
    id: 'wf-07', stage: 'service-to-cash', name: 'Vendor invoice to cost of delivery', purpose: 'Know what each deal cost, and bill the pass-through.', trigger: 'Vendor invoice received (CogniDocs job completed).', outcome: 'Matched to vendor PO and client line, posted to AP, pass-through billed.', coverage: 'implemented', autonomy: 'assisted', agents: ['mawrid'],
    steps: [
      { title: 'Ingest the invoice', actor: 'Mawrid ← CogniDocs', detail: 'Vendor, reference, totals, line items, banking details; duplicates resolved by CogniDocs on (vendorKey, normalizedInvoiceRef).', inputs: ['CogniDocs InvoiceResult'], outputs: ['Vendor invoice'], autonomy: 'observe', coverage: 'implemented' },
      { title: 'Three-way match', actor: 'Mawrid', detail: 'Vendor PO, delivery evidence, invoice; tolerances.', inputs: ['Vendor POs', 'PPM'], outputs: ['Match proposal or refusal'], decision: 'No PO → refuse and route to Procurement.', autonomy: 'assisted', coverage: 'implemented' },
      { title: 'Allocate and bill through', actor: 'Mawrid → Aqd', detail: 'Cost to client PO line; pass-through billing event at contract mark-up.', inputs: ['Match'], outputs: ['Cost allocation', 'Billing event'], autonomy: 'assisted', coverage: 'partial' },
      { title: 'Approve and post', actor: 'Accountant / Accounting Manager', detail: 'AP posting through the ERP connector.', inputs: ['Match'], outputs: ['AP invoice (ERP)'], decision: 'Approve, or reject with reason.', coverage: 'implemented' },
    ],
  },
  {
    id: 'wf-08', stage: 'close', name: 'Month-end close', purpose: 'Close September in five days, with every item owned and every blocker named.', trigger: 'Day 1 of the close.', outcome: 'Journals posted, accounts reconciled, AR tied, variances explained, pack issued, period closed.', coverage: 'implemented', autonomy: 'supervised', agents: ['iqfal', 'rawatib', 'mizaniya', 'tasweya', 'mawrid'],
    steps: [
      { title: 'Chase the inputs', actor: 'Iqfal', detail: 'Tasama\'s procedures 1–5: calendar issued on the 25th; HR, Requesters, Operations and D&T reminded while their input is late.', inputs: ['Closing calendar'], outputs: ['Inputs received or chased'], autonomy: 'supervised', coverage: 'implemented' },
      { title: 'Derive the checklist', actor: 'Iqfal', detail: 'Status from the data: inputs in? payroll proven? billing complete? cash applied? accounts explained? vendor matched? ZATCA clean? ERP jobs run?', inputs: ['All of Mizan'], outputs: ['The 24 procedures by owner, deadline, status'], autonomy: 'supervised', coverage: 'implemented' },
      { title: 'Propose journals', actor: 'Iqfal / Tasweya / Mawrid / Hares', detail: 'Unbilled accrual, deferred release, vendor accrual, bank charges, FX, debit note.', inputs: ['Derived balances'], outputs: ['Journals with ERP preview'], autonomy: 'assisted', coverage: 'implemented' },
      { title: 'Approve and post', actor: 'Accounting Manager', detail: 'Journal import through the connector.', inputs: ['Journals'], outputs: ['Posted entries'], decision: 'Per journal.', coverage: 'implemented' },
      { title: 'Explain the variances', actor: 'Mizaniya', detail: 'Budget · Target · Forecast · Actual by line, drivers, reforecast.', inputs: ['Budget', 'Schedule', 'Pipeline'], outputs: ['Variance commentary', 'Reforecast'], decision: 'FP&A accepts the reforecast.', autonomy: 'recommend', coverage: 'implemented' },
      { title: 'Read the ERP jobs back', actor: 'Iqfal ← ERP', detail: 'Fixed Assets additions, CIP, depreciation, Create Accounting; lease interest — run in the ERP, read back with their errors and the sub-ledger tie.', inputs: ['ERP job status'], outputs: ['Procedures 12–16 evidenced'], autonomy: 'observe', coverage: 'implemented' },
      { title: 'Close', actor: 'CFO', detail: 'Every procedure done; Day-1 pack issued.', inputs: ['Checklist', 'Pack'], outputs: ['Closed period'], decision: 'Close, or hold with the blocker named.', coverage: 'implemented' },
    ],
  },
  {
    id: 'wf-10', stage: 'close', name: 'Payroll into the close', purpose: 'The largest cost line, proven and allocated the morning it arrives.', trigger: 'HR\'s final payroll register reaches Finance (procedure 2, 3 WD after pay-out).', outcome: 'Payroll, provisions and GOSI booked; delivery cost on the engagements; margin per client complete.', coverage: 'implemented', autonomy: 'supervised', agents: ['rawatib', 'tasweya'],
    steps: [
      { title: 'Read the register', actor: 'Rawatib ← HR payroll system', detail: 'Totals by cost centre: basic, allowances, overtime, GOSI (employee and employer), deductions, final settlements, net pay. No employee record enters Mizan.', inputs: ['Payroll register'], outputs: ['Payroll run'], autonomy: 'observe', coverage: 'implemented' },
      { title: 'Prove it three ways', actor: 'Rawatib / Tasweya', detail: 'Net pay = the WPS batch on the bank statement = GL payroll clearing; headcount = prior month + joiners − leavers.', inputs: ['Register', 'Bank lines', 'Ledger'], outputs: ['Proof'], autonomy: 'supervised', coverage: 'implemented' },
      { title: 'Propose the journals', actor: 'Rawatib', detail: 'Payroll (staff cost split delivery / G&A, employer GOSI, clearing, GOSI payable), provisions (end-of-service, leave, bonus), GOSI due on the 15th.', inputs: ['Proven register'], outputs: ['Two journals with ERP preview'], autonomy: 'assisted', coverage: 'implemented' },
      { title: 'Sign and approve', actor: 'Accounting Manager', detail: 'The proof is signed first; each journal is approved and posted through the connector.', inputs: ['Proof', 'Journals'], outputs: ['Posted payroll'], decision: 'Sign the proof; approve each journal.', coverage: 'implemented' },
      { title: 'Allocate to engagements', actor: 'Rawatib → Mizaniya', detail: 'Delivery cost to clients by timesheet share; overhead stays in G&A. Margin per client against 23%.', inputs: ['Timesheets', 'Register'], outputs: ['Cost of delivery by client'], autonomy: 'supervised', coverage: 'implemented' },
    ],
  },
  {
    id: 'wf-11', stage: 'close', name: 'VAT return', purpose: 'A return that ties to the cleared invoices and the posted AP — nothing else.', trigger: 'Period closing; every invoice of the month cleared by ZATCA.', outcome: 'Return prepared, approved, settlement posted; filed on the ZATCA portal by the end of the following month.', coverage: 'implemented', autonomy: 'assisted', agents: ['iqfal', 'fatoora'],
    steps: [
      { title: 'Output VAT from cleared invoices', actor: 'Iqfal ← Fatoora', detail: 'Only ZATCA-cleared tax invoices dated in the period; a rejected invoice blocks the return until re-submitted.', inputs: ['Invoices', 'ZATCA status'], outputs: ['Box 1 — standard-rated sales'], autonomy: 'supervised', coverage: 'implemented' },
      { title: 'Input VAT from posted AP', actor: 'Iqfal ← Mawrid', detail: 'Only vendor invoices matched and posted; an invoice without a PO is not claimable until it is.', inputs: ['Vendor invoices'], outputs: ['Box 7 — standard-rated purchases'], autonomy: 'supervised', coverage: 'implemented' },
      { title: 'Prepare and approve', actor: 'Iqfal → Accounting Manager → CFO', detail: 'Figures frozen from the ledger; the CFO approves; the settlement journal posts VAT payable.', inputs: ['Figures'], outputs: ['Approved return', 'Settlement journal'], decision: 'Approve for filing.', coverage: 'implemented' },
      { title: 'File and pay', actor: 'Accountant · ZATCA portal · SADAD', detail: 'Outside Mizan: the return is filed on the portal and paid through SADAD by the last day of the following month; the payment lands on the next bank statement.', inputs: ['Approved return'], outputs: ['Filed return', 'Payment'], coverage: 'manual' },
    ],
  },
  {
    id: 'wf-09', stage: 'lead-to-contract', name: 'Renewal and PO top-up', purpose: 'Never deliver into a gap.', trigger: 'PO consumption above 80%, or contract expiry within 90 days.', outcome: 'Renewal pack and top-up request with the KAM before the gap opens.', coverage: 'partial', autonomy: 'recommend', agents: ['aqd', 'hares'],
    steps: [
      { title: 'Detect', actor: 'Aqd / Hares', detail: 'Consumption, expiry, scheduled events beyond PO value.', inputs: ['Schedule', 'PO'], outputs: ['Finding'], autonomy: 'recommend', coverage: 'implemented' },
      { title: 'Draft the request', actor: 'Aqd', detail: 'Top-up amount from the remaining schedule; renewal pack from Sirion terms.', inputs: ['Remaining schedule', 'Contract'], outputs: ['Draft to KAM'], autonomy: 'recommend', coverage: 'designed' },
      { title: 'Client procurement', actor: 'KAM / client', detail: 'Outside Mizan.', inputs: ['Request'], outputs: ['New PO'], coverage: 'manual' },
    ],
  },
];
