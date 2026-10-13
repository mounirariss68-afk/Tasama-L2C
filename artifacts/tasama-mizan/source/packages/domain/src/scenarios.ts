/**
 * The Demo Director scripts — nine scenarios, each a sequence of steps. A step
 * names what the presenter says (narration), what fires it (trigger), what the
 * app actually does (action, run through the same reducer every click uses),
 * the screen to show, and who is acting. The Director bar at the bottom of the
 * display plays them one step at a time, shows what changed, and switches the
 * persona so the room sees the right inbox.
 *
 * Nothing in a step is faked: 'show' steps point at what is already in the
 * world; every other step is a real action with a real trail entry.
 */
import type { Action } from './actions';
import type { Section } from './personas';
import type { World } from './types';
import { eventStatus } from './derive';

export type ScreenRef = { section: Section; tab?: string; focus?: string; clientLens?: string | null };

export type DirectorAction =
  | { kind: 'show' }
  | { kind: 'action'; action: Action }
  /** Release every draft invoice currently on the world (the billing-run release). */
  | { kind: 'releaseAllDrafts' }
  /** Release the draft invoice that was raised for one billing event. */
  | { kind: 'releaseForEvent'; eventId: string }
  /** Apply every proposed cash match on the world. */
  | { kind: 'applyAllProposed' }
  /** Approve every proposed journal on the world. */
  | { kind: 'approveAllJournals' }
  /** A simulated CogniDocs upload of one of the shipped sample documents, routed to its agent. */
  | { kind: 'upload'; sample: string }
  /** Approve the closing month's payroll and provisions journals without touching the others. */
  | { kind: 'approvePayrollJournals' }
  /** Correct the buyer VAT number on every invoice ZATCA rejected and re-submit. */
  | { kind: 'fixZatcaAll' }
  /** Approve every proposed three-way match on the world. */
  | { kind: 'approveAllVendorMatches' }
  /** Sign off every bank account whose difference is explained. */
  | { kind: 'signOffAllBankRecs' };

export type DirectorStep = {
  id: string;
  title: string;
  narration: string;
  trigger: string;
  action: DirectorAction;
  screen: ScreenRef;
  /** Persona to act as; the Director switches before running the step. */
  persona?: string;
};

export type Scenario = {
  key: string; // S1 … S9
  num: number;
  name: string;
  shape: string; // happy path · exception · escalation · refusal · cash · close
  summary: string;
  demonstrates: string;
  steps: DirectorStep[];
  /** Null when the world is in the state the script expects; otherwise why it is not (usually: it already ran — reset the demo). */
  blocked: (world: World) => string | null;
};

const st = (id: string, title: string, trigger: string, action: DirectorAction, screen: ScreenRef, narration: string, persona?: string): DirectorStep =>
  ({ id, title, trigger, action, screen, narration, ...(persona ? { persona } : {}) });

const KSIA_UAT = 'DEMO-KSIA-PO-00000611-L1/D2.13';
const GPLC_AUG = 'DEMO-GPLC-PO-011-L4/2026-08';

export const SCENARIOS: Scenario[] = [
  {
    key: 'S1', num: 1, name: 'Month-end billing run', shape: 'happy path',
    summary: 'Day 1 of the close: Fatoora drafts every due, evidenced September event; the Head of Revenue & Treasury releases them; the ERP posts and ZATCA clears.',
    demonstrates: 'The billing schedule is the source of truth: what is due is derived, what is withheld is named, and a person releases each invoice.',
    blocked: (w) => w.events.some((e) => e.period === w.closingPeriod && eventStatus(w, e) === 'due') ? null : 'The September due events have already been drafted. Reset the demo to run this scenario again.',
    steps: [
      st('s1-1', 'What the schedule says is due', 'Close Day 1 · schedule check (WF-03)', { kind: 'show' }, { section: 'l2c', tab: 'billing' },
        'Every PO line was expanded into dated billing events when the PO arrived. Today the schedule shows eight September events due and evidenced, and two it will not let through: the KSIA UAT milestone has no signed certificate of completion, and REDC September is being delivered on a PO that expired in August.', 'faisal'),
      st('s1-2', 'Fatoora drafts the run', 'Billing run (WF-03) · A2 assisted', { kind: 'action', action: { type: 'runBillingRun' } }, { section: 'inbox' },
        'Fatoora drafts the eight invoices — lines, 15% VAT, the buyer VAT number, the PO reference — and validates the ZATCA mandatory fields. Nothing is posted: each draft is a decision in Faisal\'s inbox, with the posting preview in the ERP dialect.', 'faisal'),
      st('s1-3', 'One release decision', 'Human step · amount authority', { kind: 'show' }, { section: 'inbox' },
        'The reader shows the event, the evidence, the ZATCA check and the exact call the connector will make — receivablesInvoices on Oracle Fusion, account.move on Odoo. The Head of Revenue & Treasury releases within his limit; above it the CFO does.', 'faisal'),
      st('s1-4', 'Released, posted, cleared', 'Release → ERP connector → ZATCA read-back', { kind: 'releaseAllDrafts' }, { section: 'overview' },
        'Faisal releases the drafts. The connector posts each one and reads back the ZATCA clearance. On the Overview the waterfall moves from "evidenced" to "invoiced"; the two withheld events stay named, with their reason.', 'faisal'),
      st('s1-5', 'The trail', 'Append-only decision trail', { kind: 'show' }, { section: 'agents', tab: 'trail' },
        'Every step is on the trail with its actor and its autonomy rung: Fatoora proposed, Faisal approved, the connector acted. This is the answer to "how do I know what it did?"', 'noura'),
    ],
  },
  {
    key: 'S2', num: 2, name: 'The invoice nobody raised', shape: 'exception',
    summary: 'Hares finds the GPLC AMS August event — delivered, CoC signed 3 September, never invoiced: the row that reads "To Invoice: Missed" in today\'s tracker.',
    demonstrates: 'Detection → catch-up draft → release, with recognised revenue unchanged: the revenue was always earned; the cash was never asked for.',
    blocked: (w) => { const e = w.events.find((x) => x.id === GPLC_AUG); return e && !e.invoiceId ? null : 'The GPLC August catch-up has already been invoiced. Reset the demo to run this scenario again.'; },
    steps: [
      st('s2-1', 'Hares\' finding', 'Daily four-way check (WF-04) · A1 recommend', { kind: 'show' }, { section: 'inbox', focus: `catch:${GPLC_AUG}` },
        'The four-way check compares contract, delivery, invoice and cash every morning. GPLC\'s AMS August service month closed in ServiceNow, the CoC was signed on 3 September, and no invoice exists. Hares opened a finding: SAR 52,500, 36 days past the billing date.', 'faisal'),
      st('s2-2', 'The catch-up draft', 'Human step · draft catch-up', { kind: 'action', action: { type: 'draftForEvent', eventId: GPLC_AUG } }, { section: 'inbox' },
        'Faisal asks Fatoora to draft the catch-up. The finding resolves against the new invoice, so the leak is closed in the same record that found it.', 'faisal'),
      st('s2-3', 'Released — and what did not move', 'Release → ERP connector → ZATCA', { kind: 'releaseForEvent', eventId: GPLC_AUG }, { section: 'overview' },
        'Released and cleared. Unbilled revenue drops by SAR 52,500. Recognised revenue for August does not change — it was always recognised when the service month closed. What changed is that the cash is now being asked for.', 'faisal'),
    ],
  },
  {
    key: 'S3', num: 3, name: 'CoC stuck at KSIA', shape: 'escalation',
    summary: 'Shahid\'s reminder cadence is exhausted on the KSIA UAT milestone; the escalation lands with the KAM, the sponsor signs, Fatoora drafts SAR 611,800.',
    demonstrates: 'The CoC gate — Tasama\'s own control — handled by an agent that chases and escalates, with a person approving every client contact.',
    blocked: (w) => { const e = w.events.find((x) => x.id === KSIA_UAT); return e && e.coc !== 'signed' && !e.invoiceId ? null : 'The KSIA UAT certificate has already been signed. Reset the demo to run this scenario again.'; },
    steps: [
      st('s3-1', 'A cadence exhausted', 'CoC reminders +3, +7, +10 working days (WF-02) · A3 supervised', { kind: 'show' }, { section: 'inbox', focus: `coc:${KSIA_UAT}` },
        'The UAT milestone — 25% of the fee, SAR 611,800 — was delivered on 22 September. Shahid sent the CoC request with the UAT exit report on the 24th, reminded on the 29th and on 3 October. The cadence is exhausted, so the escalation is prepared for the account manager, not sent by the agent.', 'majed'),
      st('s3-2', 'The KAM approves the escalation', 'Human step · client contact above the agent\'s remit', { kind: 'action', action: { type: 'escalateCoc', eventId: KSIA_UAT } }, { section: 'inbox' },
        'Majed approves. Shahid sends the escalation to the KSIA sponsor with the exit report and the reminder history attached. The agent drafted; the person decided who the client hears from.', 'majed'),
      st('s3-3', 'The sponsor signs', 'Simulated client event · CoC signed', { kind: 'action', action: { type: 'signCoc', eventId: KSIA_UAT } }, { section: 'l2c', tab: 'billing' },
        'The sponsor signs the same afternoon (simulated). On the billing board the milestone moves from "blocked — CoC unsigned" to "due": SAR 611,800 can now be invoiced.', 'faisal'),
      st('s3-4', 'Fatoora drafts the milestone', 'Billing event due (WF-03)', { kind: 'action', action: { type: 'draftForEvent', eventId: KSIA_UAT } }, { section: 'inbox' },
        'Fatoora drafts the milestone invoice the moment the gate opens. It sits in the inbox for release — above Faisal\'s limit, so the CFO decides.', 'noura'),
      st('s3-5', 'Released by the CFO', 'Release → ERP connector → ZATCA', { kind: 'releaseForEvent', eventId: KSIA_UAT }, { section: 'overview' },
        'The CFO releases. Unbilled revenue drops by SAR 611,800 and the Overview shows the largest blocked item of the month gone.', 'noura'),
    ],
  },
  {
    key: 'S4', num: 4, name: 'Duplicate vendor invoice', shape: 'refusal',
    summary: 'The Oracle licence invoice already matched and posted in February is uploaded a second time.',
    demonstrates: 'CogniDocs resolves it to the canonical invoice; Mawrid refuses and says why. Nothing reaches AP. The refusal is the feature.',
    blocked: () => null,
    steps: [
      st('s4-1', 'A PDF arrives', 'Upload → CogniDocs parse job', { kind: 'show' }, { section: 'documents' },
        'Vendor invoices, receipts and bank statements come in as PDFs. Each is sent to CogniDocs, which returns a canonical envelope — fields, line items, confidence, and a duplicate check on vendor key and invoice reference. In this room it runs in simulated mode on the sample documents; live mode calls the real service.', 'omar'),
      st('s4-2', 'Mawrid refuses', 'Job completed → routed to Mawrid (WF-07) · A2 assisted', { kind: 'upload', sample: 'oracle-dup' }, { section: 'documents' },
        'The Oracle invoice ORC-2026-00917 resolves to the one matched and posted in February. Mawrid refuses to create a second record and writes the reason on the job. Nothing reaches AP; nobody has to notice.', 'omar'),
      st('s4-3', 'The refusal on the trail', 'Decision trail', { kind: 'show' }, { section: 'agents', tab: 'trail' },
        'The refusal is a trail entry like any approval: the agent, the rung, the record and the reason. A refusal you can audit is worth more than an approval you cannot.', 'reem'),
    ],
  },
  {
    key: 'S5', num: 5, name: 'Cash day — statement upload', shape: 'cash',
    summary: 'The Al Rajhi collections statement arrives through CogniDocs. Tasweya recognises what is already on file, applies by reference, and proposes the KSIA tolerance match and the unreferenced REDC credit.',
    demonstrates: 'Cash application and bank reconciliation from one upload; the two judgement calls go to a person; the account is proved to its open items.',
    blocked: (w) => w.receipts.some((r) => r.status === 'proposed') ? null : 'The proposed cash matches have already been applied. Reset the demo to run this scenario again.',
    steps: [
      st('s5-1', 'The statement arrives', 'Bank statement → CogniDocs → Tasweya (WF-06)', { kind: 'upload', sample: 'rajhi-statement' }, { section: 'documents' },
        'The Al Rajhi collections statement for September is read line by line: direction, amount, reference, counterparty. Tasweya recognises the lines already on file — nothing is duplicated — and applies every receipt whose reference matches an open invoice.', 'omar'),
      st('s5-2', 'Two judgement calls', 'Tolerance and amount-plus-client matches · A1 recommend', { kind: 'show' }, { section: 'inbox', focus: 'cash:DEMO-RC-0262' },
        'Two receipts are not exact. KSIA paid two August invoices less SAR 37.50 — a correspondent bank charge — so Tasweya proposes a tolerance match with the difference to bank fees. REDC paid SAR 184,000 with no reference; the amount and the client match one open invoice at 78% confidence. Both wait for the Head of Revenue & Treasury.', 'faisal'),
      st('s5-3', 'Applied and posted', 'Human step → ERP standardReceipts', { kind: 'applyAllProposed' }, { section: 'close', tab: 'bank' },
        'Faisal applies both. The receipts post through the connector; the bank-charge journal is proposed for the Accounting Manager. On the bank reconciliation the Al Rajhi difference now equals its open items exactly.', 'faisal'),
      st('s5-4', 'Signed off', 'Human step · reconciliation sign-off', { kind: 'action', action: { type: 'signOffBankRec', accountId: 'rajhi-coll' } }, { section: 'close', tab: 'bank' },
        'The Accounting Manager signs the Al Rajhi reconciliation: statement balance, ledger balance, every open item named. Procedure 6 of Tasama\'s close moves on its own.', 'reem'),
    ],
  },
  {
    key: 'S6', num: 6, name: 'Close — Day 4 to Day 5', shape: 'close',
    summary: 'Iqfal re-derives Tasama\'s 24 closing procedures from the data; the Accounting Manager approves the cut-off journals; the CFO accepts the reforecast.',
    demonstrates: 'The checklist is read from the ledger, the schedule and the reconciliations — not ticked. What still blocks the close is named with an owner.',
    blocked: (w) => w.journals.some((j) => j.status === 'proposed') ? null : 'The September journals have already been approved. Reset the demo to run this scenario again.',
    steps: [
      st('s6-1', 'Tasama\'s 24 procedures, derived', 'Close Day 4 · checklist re-derived (WF-08) · A3 supervised', { kind: 'show' }, { section: 'close', tab: 'checklist' },
        'This is Tasama\'s own closing table — the 24 procedures, their departments and deadlines. Mizan does not ask anyone to tick them: Iqfal reads each status from the data. Inputs 1–5 come from the departments — payroll among them, four days late today; Finance starts at 6. Fixed Assets and Leases run in the ERP; Mizan reads their job results back rather than pretending to run them.', 'reem'),
      st('s6-2', 'The cut-off journals', 'Human step · journals approved (P10, P19, P20; P11 waits for payroll)', { kind: 'approveAllJournals' }, { section: 'close', tab: 'journals' },
        'Six journals were proposed by the agents from the data: the unbilled revenue accrual (computed at this moment from delivered-not-invoiced events), the deferred release of the FAIC advance, the Masterworks vendor accrual, bank charges, FX, and the Salwan rate correction. Reem approves; the connector posts them to the GL; three procedures turn green. Procedure 11 — all costs reviewed — stays open until payroll is booked.', 'reem'),
      st('s6-3', 'Budget · Target · Forecast · Actual', 'Variance decomposed (P22) · A1 recommend', { kind: 'action', action: { type: 'acceptReforecast' } }, { section: 'close', tab: 'budget' },
        'Mizaniya explains September in the words of the contracts: +SAR 611.8k milestone timing, −280k PO not received, −160k expired cover. The forecast is re-cut from the schedule and the weighted pipeline, and the CFO accepts it.', 'noura'),
      st('s6-4', 'What still blocks the close', 'Checklist re-derived', { kind: 'show' }, { section: 'close', tab: 'checklist' },
        'The close is not done, and the checklist says exactly why: the payroll register HR has not sent, the vendor invoice without a PO, the bank accounts not yet signed, the ZATCA rejection, the REDC days without PO cover, the Fixed Assets jobs not yet run. Each is an inbox item with an owner — nothing is hidden in a tick box. S7, S8 and S9 take the close from here to closed.', 'noura'),
    ],
  },
  {
    key: 'S7', num: 7, name: 'Payroll lands in the close', shape: 'payroll',
    summary: 'HR\'s register is four working days late. When it arrives, Rawatib proves it to the bank, the ledger and the headcount, books payroll with its provisions and GOSI, and puts the cost of people on the engagements they worked.',
    demonstrates: 'Procedure 2 — "check with department" in Tasama\'s own list — becomes a proven, allocated cost line the same morning; margin per client finally includes its largest component. No employee record enters Mizan.',
    blocked: (w) => { const r = w.payrollRuns.find((x) => x.period === w.closingPeriod); return r && r.status === 'awaited' ? null : 'The September payroll register has already been received. Reset the demo to run this scenario again.'; },
    steps: [
      st('s7-1', 'The input Finance waits longest for', 'Close Day 4 · procedure 2 overdue · Iqfal reminded HR twice', { kind: 'show' }, { section: 'close', tab: 'checklist', focus: 'P02' },
        'Tasama\'s own list puts payroll at line 2: HR runs it in the HR payroll system, pays through WPS on the 25th, and owes Finance the final output three working days later. On Day 4 it is still not in. Iqfal issued the calendar on 25 September and has reminded HR twice; the whole Finance window (procedures 6 to 24, "2 WD after completing 1–5") waits on it.', 'omar'),
      st('s7-2', 'Rawatib reads and proves the register', 'HR payroll system export → Rawatib (WF-10) · A3 supervised', { kind: 'action', action: { type: 'receivePayrollRegister' } }, { section: 'close', tab: 'payroll' },
        'The register arrives as totals by cost centre — never a person. Rawatib proves it three ways before anyone books it: net pay equals the WPS batch Tasweya already matched on the SNB statement, equals the GL payroll clearing, and the headcount equals last month plus three joiners less two leavers. Then it proposes two journals: payroll with its employer GOSI, and the provisions for end-of-service, leave and bonus.', 'omar'),
      st('s7-3', 'What the Accounting Manager sees', 'Inbox · the proof as a decision', { kind: 'show' }, { section: 'inbox', focus: 'pay:PR-2026-09' },
        'The proof arrives in Reem\'s inbox as one decision: the three checks, the register against August, the GOSI due on the 15th, and the two journals behind it. Nothing has been booked yet.', 'reem'),
      st('s7-4', 'The Accounting Manager signs the proof', 'Human step · proof signed', { kind: 'action', action: { type: 'approvePayroll', id: 'PR-2026-09' } }, { section: 'close', tab: 'payroll' },
        'She signs. The proof is on the trail with her name; the journals move to approval.', 'reem'),
      st('s7-5', 'Payroll and provisions posted', 'Journals approved → GL journal import', { kind: 'approvePayrollJournals' }, { section: 'close', tab: 'journals' },
        'Two approvals, two postings through the connector. Staff cost splits between cost of delivery and G&A, GOSI of SAR 134,900 is payable on 15 October, and the three provisions move with the month. Procedures 2 and 11 turn green.', 'reem'),
      st('s7-6', 'What the people cost, per client', 'Allocation by timesheet share (WF-10)', { kind: 'show' }, { section: 'close', tab: 'budget', focus: 'margin' },
        'The margin table no longer carries an illustrative ratio: each client shows the delivery payroll it consumed in September, from timesheets. KSIA is a milestone month; REDC shows seven people delivering on an expired PO — cost without revenue until the extension is recorded; Nordwind\'s RHQ engagement is staffed at four against a fee that covers three. That is the conversation the 23% target is for.', 'noura'),
    ],
  },
  {
    key: 'S8', num: 8, name: 'Day 5 — close the month', shape: 'close-out',
    summary: 'Every blocker the checklist named is resolved by the person who owns it, in Tasama\'s own order: the Masterworks match, REDC\'s PO extension, the Accenture invoice returned, the bank accounts signed, the Fixed Assets jobs read back — then the CFO closes and the Day-1 pack issues.',
    demonstrates: 'The close ends with a closed period, not a status meeting: each resolution is a real decision on the trail, and procedure 23 opens only when 1 to 22 are done.',
    blocked: (w) => {
      if (w.flags.periodClosed) return 'September is already closed. Reset the demo to run this scenario again.';
      const r = w.payrollRuns.find((x) => x.period === w.closingPeriod);
      if (!r || r.status !== 'posted') return 'Payroll is not yet booked — run S7 first; procedure 2 blocks the close until the register is in.';
      // The close-out resolves what the earlier scenarios leave open; it needs them to have run.
      const notRun = SCENARIOS.filter((x) => ['S1', 'S2', 'S3', 'S5'].includes(x.key) && x.blocked(w) === null).map((x) => x.key);
      return notRun.length ? `Run ${notRun.join(', ')} first — the close-out resolves what they leave open (billing, the missed invoice, the KSIA certificate, cash).` : null;
    },
    steps: [
      st('s8-1', 'What still blocks', 'Close Day 5 · checklist re-derived', { kind: 'show' }, { section: 'close', tab: 'checklist' },
        'Day 5. The checklist names what is open and who owns it. Each item below is resolved by that owner, in the order of Tasama\'s own list.', 'noura'),
      st('s8-2', 'Requesters: the Masterworks receipt and match', 'Vendor invoice → CogniDocs → Mawrid (WF-07) · 3-way match approved', { kind: 'upload', sample: 'masterworks' }, { section: 'documents' },
        'The Masterworks MS3 invoice arrives through CogniDocs; the requester confirms receipt in the ERP and Mawrid proposes the three-way match to vendor PO 3596. Procedure 3 closes when the Accountant approves it.', 'omar'),
      st('s8-3', 'The match approved', 'Human step · posted to AP', { kind: 'approveAllVendorMatches' }, { section: 'inbox' },
        'Reem approves; the invoice posts to AP and the vendor accrual proposed on Day 2 has an invoice behind it. Cost of delivery for SDB is now an invoice, not an estimate.', 'reem'),
      st('s8-4', 'D&T: REDC\'s PO extension', 'Sirion → Aqd · PO cover recorded (P5, P17)', { kind: 'action', action: { type: 'recordPoCover', eventId: 'DEMO-REDC-PO-0000061-L1/2026-09', poRef: 'DEMO-REDC-PO-0000061-A1', validTo: '2027-03-31' } }, { section: 'l2c', tab: 'billing' },
        'The verbal award becomes a PO amendment in Sirion. Majed records it; Aqd re-expands the schedule to March 2027. The 18 September days move from "no PO cover" to due, the D&T schedule is complete, and Mizaniya\'s variance driver shrinks from −160k to −70k.', 'majed'),
      st('s8-5', 'The REDC days invoiced', 'Billing event due → Fatoora drafts → released', { kind: 'action', action: { type: 'draftForEvent', eventId: 'DEMO-REDC-PO-0000061-L1/2026-09' } }, { section: 'inbox' },
        'Fatoora drafts the SAR 90,000 invoice the moment the gate opens; Faisal releases it in the next step.', 'faisal'),
      st('s8-6', 'Released, cleared', 'Release → ERP connector → ZATCA', { kind: 'releaseForEvent', eventId: 'DEMO-REDC-PO-0000061-L1/2026-09' }, { section: 'l2c', tab: 'billing' },
        'Posted to AR and cleared. Procedure 17 — every client invoice recorded — is done.', 'faisal'),
      st('s8-7', 'AP: the invoice without a PO goes back', 'Human step · rejected with reason (P8, P9)', { kind: 'action', action: { type: 'rejectVendor', id: 'DEMO-VI-0186', reason: 'CR-7 is outside PO 3051 scope; returned to Accenture for a PO against the change request' } }, { section: 'inbox' },
        'Mawrid refused to post it on Day 2; Procurement has confirmed CR-7 was never ordered. Reem returns it to the vendor with the reason on the trail. AP is complete and the ERP\'s Create Accounting for AP can run.', 'reem'),
      st('s8-8', 'Nothing rejected by ZATCA', 'Fatoora re-submits after the field fix', { kind: 'fixZatcaAll' }, { section: 'l2c', tab: 'collections' },
        'If S8 ran, this is already done; if not, Faisal adds the buyer VAT number and Fatoora re-submits. Procedure 21 — Create Accounting for AR — can run.', 'faisal'),
      st('s8-9', 'Every account signed', 'Human step · bank reconciliations signed (P6)', { kind: 'signOffAllBankRecs' }, { section: 'close', tab: 'bank' },
        'The remaining accounts: SNB operating with the service charge now booked and the Mastek payment as a dated timing item, and the SAB USD account. Each difference equals its open items; Reem signs.', 'reem'),
      st('s8-10', 'The cut-off journals, if still open', 'Journals approved (P10, P19, P20); reforecast accepted (P22)', { kind: 'approveAllJournals' }, { section: 'close', tab: 'journals' },
        'If S6 ran, nothing is left to approve here. Otherwise the six cut-off journals post now.', 'reem'),
      st('s8-11', 'The reforecast accepted', 'Human step · FP&A', { kind: 'action', action: { type: 'acceptReforecast' } }, { section: 'close', tab: 'budget' },
        'The CFO accepts the reforecast re-cut from the schedule and the pipeline — with REDC\'s extension now in it as a PO, not a verbal award.', 'noura'),
      st('s8-12', 'Fixed Assets and Leases, read back', 'ERP jobs → Iqfal (P12–P16)', { kind: 'action', action: { type: 'readBackErpJobs' } }, { section: 'close', tab: 'checklist', focus: 'P14' },
        'Depreciation and Create Accounting for Fixed Assets ran in the ERP overnight. Iqfal reads the job results back — zero errors, the FA sub-ledger ties to GL — and procedures 12 to 16 show as done without anyone pretending Mizan ran them.', 'omar'),
      st('s8-13', 'The CFO closes September', 'Human step · period closed in the ERP (P23)', { kind: 'action', action: { type: 'closePeriod' } }, { section: 'close', tab: 'checklist' },
        'Procedures 1 to 22 are done, so 23 opens. The CFO closes the period; the trail records who closed it and on what evidence.', 'noura'),
      st('s8-14', 'The Day-1 pack', 'Reports issued from the same figures (P24)', { kind: 'show' }, { section: 'close', tab: 'reports' },
        'The pack is the figures the screens have shown all along: the September P&L against budget with payroll in it, the balance sheet summary, cash by account, AR ageing, margin by client, headcount and cost by cost centre. Nothing is re-keyed into a spreadsheet.', 'noura'),
    ],
  },
  {
    key: 'S9', num: 9, name: 'The VAT return', shape: 'tax',
    summary: 'Not in Tasama\'s list of 24, but part of every KSA close: the monthly return to ZATCA, built after the books close from the cleared invoices and the posted AP. The vendor invoice returned without a PO shows up as VAT the return cannot claim.',
    demonstrates: 'The return ties to the ledger by construction: output VAT only on invoices ZATCA cleared, input VAT only on vendor invoices posted. The CFO approves; the settlement journal posts; filing on the portal is the one step outside Mizan.',
    blocked: (w) => { const v = w.vatReturns.find((x) => x.period === w.closingPeriod); return v && v.status === 'open' ? null : 'The September VAT return has already been prepared. Reset the demo to run this scenario again.'; },
    steps: [
      st('s9-1', 'The return follows the close', 'Line 25 — added by Cognirise · ZATCA monthly filing', { kind: 'show' }, { section: 'close', tab: 'vat' },
        'Tasama\'s list stops at the ERP close; a KSA business files VAT monthly by the end of the following month. With September closed, Iqfal shows the return as the ledger stands: output VAT on the twelve September invoices ZATCA cleared, input VAT on the Masterworks invoice posted to AP on Day 5. The Accenture invoice returned without a PO carries SAR 42,000 of VAT the return cannot claim — and says so.', 'reem'),
      st('s9-2', 'Every invoice of the month cleared', 'Output VAT only on ZATCA-cleared invoices (WF-11)', { kind: 'fixZatcaAll' }, { section: 'l2c', tab: 'collections' },
        'A rejected invoice is not a tax invoice; the return refuses to prepare while one remains in the period. Nordwind\'s was re-submitted on Day 5 after the buyer VAT number was added, so nothing is rejected now — the step confirms it rather than assumes it.', 'faisal'),
      st('s9-3', 'Iqfal freezes the figures', 'Return prepared from the ledger (WF-11) · A2 assisted', { kind: 'action', action: { type: 'prepareVatReturn' } }, { section: 'close', tab: 'vat' },
        'The figures are frozen from the ledger — standard-rated sales and output VAT, purchases and input VAT, net payable — with the invoices listed behind each box. Nobody types a number into the return.', 'reem'),
      st('s9-4', 'The CFO approves for filing', 'Human step · settlement journal posts', { kind: 'action', action: { type: 'approveVatReturn', id: 'VAT-2026-09' } }, { section: 'close', tab: 'vat' },
        'The CFO approves. The settlement journal moves output and input VAT into VAT payable to ZATCA; the return is filed on the portal and paid through SADAD by 31 October — outside Mizan, and the payment lands on the next bank statement for Tasweya to match.', 'noura'),
    ],
  },
];

export const scenarioByKey = (key: string) => SCENARIOS.find((s) => s.key === key);
