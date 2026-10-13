/**
 * The action reducer — every change a person or an agent can make to the
 * world, as a pure function. The server applies it and persists the result
 * to PostgreSQL; the standalone file applies the same function in the
 * browser. One implementation, two homes, no drift.
 *
 * Each action writes its own trail entries, so the decision trail is a
 * by-product of acting, never a separate log someone has to remember.
 */
import type {
  BankLine, CashReceipt, DunningStage, Invoice, Journal, LedgerEntry, ParseJob, Settings, TrailEntry, VendorInvoice, World,
} from './types';
import { addDays, vatOf } from './world';
import { clientOf, deriveCloseItems, eventStatus, poOf, unbilledEvents, toSAR, vatFigures } from './derive';
import { creditMemoCall, erpRef, invoiceCall, journalCall, receiptCall, vendorInvoiceCall } from './erp';

export type Action =
  | { type: 'releaseInvoice'; id: string }
  | { type: 'rejectDraft'; id: string; reason: string }
  | { type: 'draftForEvent'; eventId: string }
  | { type: 'runBillingRun' }
  | { type: 'fixZatca'; invoiceId: string; vatNo: string }
  | { type: 'sendCoc'; eventId: string }
  | { type: 'escalateCoc'; eventId: string }
  | { type: 'signCoc'; eventId: string }
  | { type: 'approveDunning'; id: string; stage?: DunningStage; reason?: string }
  | { type: 'holdDunning'; id: string; reason: string }
  | { type: 'applyReceipt'; id: string }
  | { type: 'rejectReceipt'; id: string; reason: string }
  | { type: 'approveVendor'; id: string }
  | { type: 'rejectVendor'; id: string; reason: string }
  | { type: 'approveJournal'; id: string }
  | { type: 'signOffBankRec'; accountId: string }
  | { type: 'acknowledgeFinding'; id: string }
  | { type: 'confirmSchedule'; poId: string }
  | { type: 'acceptReforecast' }
  | { type: 'completeCloseItem'; id: string }
  | { type: 'closePeriod' }
  /** Rawatib reads the month's payroll register from the HR payroll system and proves it to the bank, the GL and the headcount. */
  | { type: 'receivePayrollRegister'; period?: string }
  /** The Accounting Manager signs the proof; the payroll and provisions journals go to approval. */
  | { type: 'approvePayroll'; id: string }
  /** Iqfal freezes the VAT return figures from the ledger. */
  | { type: 'prepareVatReturn'; period?: string }
  /** The CFO approves the return for filing; the settlement journal posts. */
  | { type: 'approveVatReturn'; id: string }
  /** The KAM records the PO extension received from the client; delivery on the event is covered again. */
  | { type: 'recordPoCover'; eventId: string; poRef: string; validTo: string }
  /** Iqfal reads the Fixed Assets and Leases job results back from the ERP. */
  | { type: 'readBackErpJobs' }
  | { type: 'addJob'; job: ParseJob }
  | { type: 'updateJob'; job: ParseJob }
  | { type: 'routeJob'; jobId: string }
  | { type: 'updateSettings'; patch: Partial<Omit<Settings, 'cognidocs'>> & { cognidocs?: Partial<Settings['cognidocs']> } }
  | { type: 'logPersonTrail'; summary: string; detail?: string; recordRef?: string };

export type ActionContext = { personaId: string; now: string };
export type ActionResult = { world: World; created?: string; count?: number; error?: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function applyAction(prev: World, action: Action, ctx: ActionContext): ActionResult {
  const w = structuredClone(prev) as World;
  const me = { kind: 'person' as const, id: ctx.personaId };
  const ag = (id: string) => ({ kind: 'agent' as const, id });
  const t = (e: Omit<TrailEntry, 'id' | 'at'> & { at?: string }) => { w.trail.push({ id: `TR-${++w.flags.seq}`, at: e.at ?? ctx.now, ...e }); };
  const erp = w.settings.erp;
  const nextErp = (kind: 'AR' | 'AP' | 'GL' | 'RCPT') => erpRef(erp, kind, w.flags.erpSeq++);
  const nid = (p: string) => `${p}-${++w.flags.seq}`;
  let created: string | undefined; let count: number | undefined;

  const draft = (eventId: string, catchUp: boolean): string | null => {
    const e = w.events.find((x) => x.id === eventId); if (!e || e.invoiceId) return null;
    const s = eventStatus(w, e); if (s !== 'due' && s !== 'missed') return null;
    const client = clientOf(w, e.clientId);
    const date = w.asOf; const k = date.slice(0, 7).replace('-', '');
    const n = w.invoices.filter((i) => i.id.startsWith(`DEMO-${k}`)).length + 1;
    const inv: Invoice = { id: `DEMO-${k}${String(n).padStart(4, '0')}`, clientId: e.clientId, poId: e.poId, eventIds: [e.id], date, dueDate: addDays(date, client.paymentTermsDays), currency: e.currency, net: e.expectedAmount, vat: vatOf(e.expectedAmount), gross: r2(e.expectedAmount + vatOf(e.expectedAmount)), status: 'draft', zatca: 'draft', description: e.label };
    w.invoices.push(inv); e.invoiceId = inv.id;
    t({ actor: ag('fatoora'), kind: 'proposed', autonomy: 'assisted', summary: `Drafted ${inv.id} for ${client.short} — ${e.label} (${inv.currency} ${inv.gross.toLocaleString('en-US')})${catchUp ? ' — catch-up for a missed event' : ''}`, recordRef: inv.id });
    const f = w.findings.find((x) => x.recordRef === e.id && !x.acknowledged); if (f) { f.acknowledged = true; f.resolvedBy = inv.id; }
    return inv.id;
  };

  switch (action.type) {
    case 'releaseInvoice': {
      const inv = w.invoices.find((i) => i.id === action.id); if (!inv || inv.status !== 'draft') return { world: prev, error: 'not a draft' };
      const client = clientOf(w, inv.clientId);
      inv.status = 'released';
      t({ actor: me, kind: 'approved', summary: `Released ${inv.id} — ${client.short} ${inv.currency} ${inv.gross.toLocaleString('en-US')}`, recordRef: inv.id });
      const call = invoiceCall(erp, inv, client, inv.poId);
      if (!client.vatNo) {
        inv.zatca = 'rejected'; inv.zatcaReason = 'Buyer VAT registration number missing (BR-KSA-14).';
        t({ actor: ag('fatoora'), kind: 'rejected', autonomy: 'supervised', summary: `${inv.id} posted (${call.method} ${call.path}) but rejected by ZATCA: buyer VAT number missing`, recordRef: inv.id, detail: `${call.method} ${call.path}\n${JSON.stringify(call.body, null, 1)}` });
        break;
      }
      inv.status = 'posted'; inv.zatca = 'cleared'; inv.erpRef = nextErp('AR');
      t({ actor: ag('fatoora'), kind: 'acted', autonomy: 'supervised', summary: `${inv.id} posted to ${erp === 'oracle' ? 'Oracle AR' : 'Odoo'} as ${inv.erpRef}; ZATCA cleared`, detail: `${call.method} ${call.path}\n${JSON.stringify(call.body, null, 1)}`, recordRef: inv.id });
      break;
    }
    case 'rejectDraft': {
      const idx = w.invoices.findIndex((i) => i.id === action.id); if (idx < 0) return { world: prev, error: 'no such draft' };
      const inv = w.invoices[idx];
      for (const e of w.events) if (inv.eventIds.includes(e.id)) e.invoiceId = undefined;
      w.invoices.splice(idx, 1);
      t({ actor: me, kind: 'rejected', summary: `Draft ${inv.id} rejected — ${action.reason}`, recordRef: inv.id, detail: action.reason });
      break;
    }
    case 'draftForEvent': {
      const e = w.events.find((x) => x.id === action.eventId);
      const id = draft(action.eventId, e ? eventStatus(w, e) === 'missed' : false);
      if (!id) return { world: prev, error: 'event not due' };
      created = id; break;
    }
    case 'runBillingRun': {
      const due = w.events.filter((e) => eventStatus(w, e) === 'due');
      count = 0;
      for (const e of due) if (draft(e.id, false)) count++;
      const withheld = w.events.filter((e) => e.period === w.closingPeriod && eventStatus(w, e).startsWith('blocked'));
      t({ actor: ag('fatoora'), kind: 'proposed', autonomy: 'assisted', summary: `Billing run: ${count} ${w.closingPeriod} invoice(s) drafted for release; ${withheld.length} withheld (${withheld.map((e) => eventStatus(w, e).replace('blocked_', '')).join(', ') || 'none'})` });
      break;
    }
    case 'fixZatca': {
      const inv = w.invoices.find((i) => i.id === action.invoiceId); if (!inv) return { world: prev, error: 'no such invoice' };
      const client = clientOf(w, inv.clientId); client.vatNo = action.vatNo;
      inv.zatca = 'cleared'; inv.zatcaReason = undefined; inv.status = 'posted'; inv.erpRef = inv.erpRef ?? nextErp('AR');
      t({ actor: me, kind: 'approved', summary: `Buyer VAT number ${action.vatNo} added to ${client.short} customer master`, recordRef: inv.id });
      t({ actor: ag('fatoora'), kind: 'acted', autonomy: 'supervised', summary: `${inv.id} re-submitted and cleared by ZATCA (${inv.erpRef})`, recordRef: inv.id });
      const f = w.findings.find((x) => x.recordRef === inv.id); if (f) { f.acknowledged = true; f.resolvedBy = 'resubmitted'; }
      break;
    }
    case 'sendCoc': {
      const e = w.events.find((x) => x.id === action.eventId); if (!e) return { world: prev, error: 'no such event' };
      e.coc = 'sent'; e.cocSentOn = w.asOf;
      t({ actor: me, kind: 'approved', summary: `CoC request approved for ${clientOf(w, e.clientId).short} — ${e.label}`, recordRef: e.id });
      t({ actor: ag('shahid'), kind: 'acted', autonomy: 'assisted', summary: `CoC request sent with the evidence pack (${e.evidence.map((v) => v.label).join('; ')})`, recordRef: e.id });
      break;
    }
    case 'escalateCoc': {
      const e = w.events.find((x) => x.id === action.eventId); if (!e) return { world: prev, error: 'no such event' };
      e.coc = 'escalated';
      t({ actor: me, kind: 'approved', summary: `Escalation to the client sponsor approved — ${clientOf(w, e.clientId).short} ${e.label}`, recordRef: e.id });
      t({ actor: ag('shahid'), kind: 'escalated', autonomy: 'assisted', summary: `Escalation email sent to the ${clientOf(w, e.clientId).short} sponsor with the acceptance report and the reminder history`, recordRef: e.id });
      break;
    }
    case 'signCoc': {
      const e = w.events.find((x) => x.id === action.eventId); if (!e) return { world: prev, error: 'no such event' };
      e.coc = 'signed';
      t({ actor: ag('shahid'), kind: 'observed', autonomy: 'supervised', summary: `CoC signed by ${clientOf(w, e.clientId).short} — ${e.label} is now ready to invoice`, recordRef: e.id });
      const f = w.findings.find((x) => x.recordRef === e.id && !x.acknowledged); if (f) { f.acknowledged = true; f.resolvedBy = 'coc signed'; }
      break;
    }
    case 'approveDunning': {
      const dn = w.dunning.find((x) => x.id === action.id); if (!dn) return { world: prev, error: 'no such notice' };
      const final = action.stage ?? dn.proposedStage;
      if (action.stage && action.stage !== dn.proposedStage) t({ actor: me, kind: 'overridden', summary: `Changed Tahseel's proposed ${dn.proposedStage} notice to ${action.stage}`, override: { from: dn.proposedStage, to: action.stage, reason: action.reason ?? 'no reason given' }, recordRef: dn.id });
      else t({ actor: me, kind: 'approved', summary: `Approved ${final} notice for ${clientOf(w, dn.clientId).short} ${dn.invoiceId}`, recordRef: dn.id });
      dn.stage = final; dn.status = 'sent';
      t({ actor: ag('tahseel'), kind: 'acted', autonomy: 'assisted', summary: `${final} notice sent to ${clientOf(w, dn.clientId).short} for ${dn.invoiceId}`, recordRef: dn.id });
      break;
    }
    case 'holdDunning': {
      const dn = w.dunning.find((x) => x.id === action.id); if (!dn) return { world: prev, error: 'no such notice' };
      dn.status = 'held'; dn.promiseToPay = action.reason;
      t({ actor: me, kind: 'overridden', summary: `Held dunning on ${dn.invoiceId}`, override: { from: dn.proposedStage, to: 'held', reason: action.reason }, recordRef: dn.id });
      break;
    }
    case 'applyReceipt': {
      const r = w.receipts.find((x) => x.id === action.id); if (!r || r.status === 'applied') return { world: prev, error: 'not applicable' };
      const bl = w.bankLines.find((b) => b.id === r.bankLineId)!;
      r.status = 'applied';
      const le: LedgerEntry = { id: nid('LE'), accountId: bl.accountId, date: bl.date, kind: 'receipt', description: `Receipt ${r.invoiceIds.join(', ')} ${r.clientId ? clientOf(w, r.clientId).short : ''}`.trim(), amount: bl.amount, reference: r.invoiceIds[0], matchedBankLineId: bl.id };
      w.ledger.push(le); bl.matchedLedgerId = le.id; bl.receiptId = r.id;
      for (const invId of r.invoiceIds) { const inv = w.invoices.find((i) => i.id === invId); if (inv) inv.status = 'paid'; }
      const client = r.clientId ? clientOf(w, r.clientId) : null;
      t({ actor: me, kind: 'approved', summary: `Applied receipt ${r.amount.toLocaleString('en-US')} to ${r.invoiceIds.join(', ')}${r.shortfall ? ` (SAR ${r.shortfall} shortfall to bank charges)` : ''}`, recordRef: r.id });
      const call = receiptCall(erp, { clientCode: client?.code ?? '', amount: r.amount, currency: bl.accountId === 'sab-usd' ? 'USD' : 'SAR', date: bl.date, invoiceIds: r.invoiceIds, bankAccount: bl.accountId });
      t({ actor: ag('tasweya'), kind: 'acted', autonomy: 'assisted', summary: `Receipt posted as ${nextErp('RCPT')} and applied`, detail: `${call.method} ${call.path}\n${JSON.stringify(call.body, null, 1)}`, recordRef: r.id });
      break;
    }
    case 'rejectReceipt': {
      const r = w.receipts.find((x) => x.id === action.id); if (!r) return { world: prev, error: 'no such receipt' };
      r.status = 'unapplied'; r.note = `${r.note ?? ''}\nRejected: ${action.reason}`.trim();
      t({ actor: me, kind: 'rejected', summary: `Proposed match rejected — ${action.reason}`, recordRef: r.id });
      break;
    }
    case 'approveVendor': {
      const v = w.vendorInvoices.find((x) => x.id === action.id); if (!v) return { world: prev, error: 'no such vendor invoice' };
      v.matchStatus = 'matched';
      const po = w.vendorPOs.find((p) => p.id === v.vendorPOId); if (po) po.consumed = Math.min(po.value, po.consumed + v.net);
      t({ actor: me, kind: 'approved', summary: `Approved 3-way match — ${v.vendorName} ${v.invoiceRef} to vendor PO ${v.vendorPOId}`, recordRef: v.id });
      const call = vendorInvoiceCall(erp, v);
      t({ actor: ag('mawrid'), kind: 'acted', autonomy: 'assisted', summary: `AP invoice posted as ${nextErp('AP')}; cost allocated to ${v.clientPOLineId}`, detail: `${call.method} ${call.path}\n${JSON.stringify(call.body, null, 1)}`, recordRef: v.id });
      break;
    }
    case 'rejectVendor': {
      const v = w.vendorInvoices.find((x) => x.id === action.id); if (!v) return { world: prev, error: 'no such vendor invoice' };
      v.matchStatus = 'rejected'; v.matchNote = `${v.matchNote ?? ''}\nRejected: ${action.reason}`.trim();
      t({ actor: me, kind: 'rejected', summary: `${v.vendorName} ${v.invoiceRef} rejected — ${action.reason}`, recordRef: v.id });
      break;
    }
    case 'approveJournal': {
      const j = w.journals.find((x) => x.id === action.id); if (!j || j.status === 'posted') return { world: prev, error: 'not approvable' };
      if (j.kind === 'Unbilled revenue accrual') {
        const amt = r2(unbilledEvents(w).reduce((s, e) => s + toSAR(e.expectedAmount, e.currency), 0));
        j.lines = [{ account: '1210 Unbilled receivables (contract asset)', dr: amt, cr: 0 }, { account: '4100 Service revenue', dr: 0, cr: amt }];
      }
      j.status = 'posted'; j.erpRef = nextErp('GL');
      t({ actor: me, kind: 'approved', summary: `Approved ${j.id} — ${j.kind} (SAR ${j.lines.reduce((s, l) => s + l.dr, 0).toLocaleString('en-US')})`, recordRef: j.id });
      const call = journalCall(erp, j);
      t({ actor: ag(j.proposedBy), kind: 'acted', autonomy: 'assisted', summary: `${j.id} posted as ${j.erpRef}`, detail: `${call.method} ${call.path}\n${JSON.stringify(call.body, null, 1)}`, recordRef: j.id });
      if (j.kind === 'Bank charges') {
        // The charge lines were on the statement with nothing in the ledger; posting the journal books them and matches the lines.
        for (const bl of w.bankLines.filter((b) => b.type === 'charge' && !b.matchedLedgerId && b.date.startsWith(j.period))) {
          const le: LedgerEntry = { id: nid('LE'), accountId: bl.accountId, date: bl.date, kind: 'charge', description: `Bank charges ${bl.description}`, amount: bl.amount, matchedBankLineId: bl.id };
          w.ledger.push(le); bl.matchedLedgerId = le.id;
        }
      }
      if (j.kind === 'Payroll' || j.kind === 'Payroll provisions') {
        const run = w.payrollRuns.find((r) => r.journalIds.includes(j.id));
        if (run && run.journalIds.every((id) => w.journals.find((x) => x.id === id)?.status === 'posted')) {
          run.status = 'posted';
          t({ actor: ag('rawatib'), kind: 'acted', autonomy: 'assisted', summary: `${run.period} payroll booked: employer cost SAR ${run.employerCost.toLocaleString('en-US')} to ${run.allocations.filter((a) => a.clientId).length} engagements and overhead; GOSI SAR ${(run.gosiEmployee + run.gosiEmployer).toLocaleString('en-US')} due ${run.gosiDueOn}`, recordRef: run.id });
        }
      }
      if (j.kind === 'Rate correction (debit note)') {
        const f = w.findings.find((x) => x.kind === 'Under-rate'); if (f) { f.acknowledged = true; f.resolvedBy = j.id; }
        const inv = w.invoices.find((i) => i.billedRate); if (inv) { const cm = creditMemoCall(erp, inv, 11_872, 'rate correction'); t({ actor: ag('fatoora'), kind: 'acted', autonomy: 'assisted', summary: `Debit note issued against ${inv.id} for SAR 13,652.80`, detail: `${cm.method} ${cm.path}`, recordRef: inv.id }); }
      }
      break;
    }
    case 'signOffBankRec': {
      const a = w.bankAccounts.find((x) => x.id === action.accountId); if (!a) return { world: prev, error: 'no such account' };
      a.signedOff = true; a.reconciledThrough = `${w.closingPeriod}-30`;
      t({ actor: me, kind: 'approved', summary: `Bank reconciliation signed off — ${a.bank} ${a.label}, ${w.closingPeriod}`, recordRef: a.id });
      break;
    }
    case 'acknowledgeFinding': {
      const f = w.findings.find((x) => x.id === action.id); if (!f) return { world: prev, error: 'no such finding' };
      f.acknowledged = true; f.resolvedBy = 'acknowledged';
      t({ actor: me, kind: 'approved', summary: `Acknowledged finding ${f.id} — ${f.kind}, ${clientOf(w, f.clientId).short}`, recordRef: f.id });
      break;
    }
    case 'confirmSchedule': {
      const p = poOf(w, action.poId); p.scheduleConfirmed = true;
      t({ actor: me, kind: 'approved', summary: `Billing schedule confirmed — ${p.id}`, recordRef: p.id });
      break;
    }
    case 'acceptReforecast': {
      w.flags.reforecastAccepted = true;
      t({ actor: me, kind: 'approved', summary: 'Reforecast accepted — FY2026 forecast re-cut from the schedule and the weighted pipeline; Q4 moved for KSIA Phase 2 (Nov), REDC extension (Oct–Dec), SDB MS3 (Dec)', recordRef: 'P22' });
      break;
    }
    case 'completeCloseItem': {
      const c = w.closeItems.find((x) => x.id === action.id); if (!c || c.derivedFrom || c.status === 'external') return { world: prev, error: 'This procedure is derived from the data or sits outside Mizan; it cannot be ticked.' };
      c.status = 'done';
      t({ actor: me, kind: 'approved', summary: `Close procedure ${c.number} recorded as complete — ${c.title}`, recordRef: c.id });
      break;
    }
    case 'closePeriod': {
      const items = deriveCloseItems(w);
      const open = items.filter((i) => i.number < 23 && !['done', 'external'].includes(i.status));
      if (open.length) return { world: prev, error: `${open.length} procedure(s) still open: ${open.map((i) => `P${i.number}`).join(', ')}` };
      w.flags.periodClosed = true;
      t({ actor: me, kind: 'approved', summary: `${w.closingPeriod} closed in the ERP — final review and approvals complete; close pack issued`, recordRef: 'P23' });
      break;
    }
    case 'receivePayrollRegister': {
      const run = w.payrollRuns.find((r) => r.period === (action.period ?? w.closingPeriod)); if (!run) return { world: prev, error: 'no payroll run for that period' };
      if (run.status !== 'awaited') return { world: prev, error: 'The register has already been received.' };
      const prior = [...w.payrollRuns].filter((r) => r.period < run.period).sort((a, b) => b.period.localeCompare(a.period))[0];
      const bl = w.bankLines.find((b) => b.type === 'payroll' && b.date.startsWith(run.period));
      const le = w.ledger.find((l) => l.kind === 'payroll' && l.date.startsWith(run.period));
      const bankTies = !!bl && Math.abs(Math.abs(bl.amount) - run.netPay) < 0.01;
      const glTies = !!le && Math.abs(Math.abs(le.amount) - run.netPay) < 0.01;
      const headcountTies = !prior || prior.headcount + run.joiners - run.leavers === run.headcount;
      run.status = 'received'; run.receivedOn = w.asOf;
      run.proof = { bankLineId: bl?.id ?? null, bankTies, headcountTies, glTies, note: `Register net SAR ${run.netPay.toLocaleString('en-US')} ${bankTies ? '=' : '≠'} WPS payment ${bl ? bl.date : '(none)'} ${glTies ? '=' : '≠'} GL payroll clearing; ${run.headcount} heads ${headcountTies ? '=' : '≠'} ${prior ? `${prior.headcount} + ${run.joiners} joiners − ${run.leavers} leavers` : 'prior month'}.` };
      const inp = w.inputs.find((i) => i.procedure === 2); if (inp) inp.receivedOn = w.asOf;
      const delivery = run.allocations.filter((a) => a.clientId).reduce((s, a) => s + a.cost, 0); const total = run.allocations.reduce((s, a) => s + a.cost, 0);
      const share = total ? delivery / total : 1;
      const k = run.period.slice(2, 4) + run.period.slice(5, 7);
      const n = w.journals.filter((j) => j.period === run.period).length;
      const jPay: Journal = { id: `DEMO-JE-${k}-${String(n + 1).padStart(2, '0')}`, kind: 'Payroll', period: run.period, proposedBy: 'rawatib', status: 'proposed', description: `${run.period} payroll from the HR register: ${run.headcount} heads, gross SAR ${run.grossPay.toLocaleString('en-US')} (basic, allowances, overtime, ${run.leavers} final settlement(s)), employer GOSI SAR ${run.gosiEmployer.toLocaleString('en-US')}. Net pay SAR ${run.netPay.toLocaleString('en-US')} was paid through WPS on ${run.paidOn} and sits in payroll clearing; GOSI SAR ${(run.gosiEmployee + run.gosiEmployer).toLocaleString('en-US')} is due ${run.gosiDueOn}. Delivery cost is split to engagements by timesheet share; the rest is overhead.`,
        lines: [
          { account: '5100 Staff cost — cost of delivery', dr: r2(run.grossPay * share), cr: 0 }, { account: '6100 Staff cost — G&A', dr: r2(run.grossPay - r2(run.grossPay * share)), cr: 0 }, { account: '5110 Employer GOSI contributions', dr: run.gosiEmployer, cr: 0 },
          { account: '2110 Payroll clearing (settled by WPS 25 Sep)', dr: 0, cr: run.netPay }, { account: '2120 GOSI payable', dr: 0, cr: r2(run.gosiEmployee + run.gosiEmployer) }, { account: '2130 Other deductions payable', dr: 0, cr: run.otherDeductions },
        ] };
      const jProv: Journal = { id: `DEMO-JE-${k}-${String(n + 2).padStart(2, '0')}`, kind: 'Payroll provisions', period: run.period, proposedBy: 'rawatib', status: 'proposed', description: `${run.period} provisions computed from the register: end-of-service benefits (Saudi Labour Law, half a month per year of service), annual leave (30 days) and the bonus pool at the budgeted rate.`,
        lines: [
          { account: '5120 End-of-service benefits expense', dr: run.eosbProvision, cr: 0 }, { account: '2510 End-of-service benefits provision', dr: 0, cr: run.eosbProvision },
          { account: '5130 Annual leave expense', dr: run.leaveProvision, cr: 0 }, { account: '2520 Leave provision', dr: 0, cr: run.leaveProvision },
          { account: '5140 Bonus expense', dr: run.bonusAccrual, cr: 0 }, { account: '2530 Bonus accrual', dr: 0, cr: run.bonusAccrual },
        ] };
      w.journals.push(jPay, jProv); run.journalIds = [jPay.id, jProv.id];
      t({ actor: ag('rawatib'), kind: 'observed', autonomy: 'supervised', summary: `${run.period} payroll register read from the ${run.source}: ${run.headcount} heads (+${run.joiners} / −${run.leavers}), gross SAR ${run.grossPay.toLocaleString('en-US')}, net SAR ${run.netPay.toLocaleString('en-US')} — totals by cost centre only`, recordRef: run.id });
      t({ actor: ag('rawatib'), kind: bankTies && glTies && headcountTies ? 'acted' : 'escalated', autonomy: 'supervised', summary: `Proof ${bankTies && glTies && headcountTies ? 'passed' : 'FAILED'}: ${run.proof.note}`, recordRef: run.id });
      t({ actor: ag('rawatib'), kind: 'proposed', autonomy: 'assisted', summary: `${jPay.id} payroll (SAR ${jPay.lines.reduce((x, l) => x + l.dr, 0).toLocaleString('en-US')}) and ${jProv.id} provisions (SAR ${jProv.lines.reduce((x, l) => x + l.dr, 0).toLocaleString('en-US')}) proposed; cost of delivery allocated to ${run.allocations.filter((a) => a.clientId).length} engagements by timesheet share`, recordRef: run.id });
      created = run.id;
      break;
    }
    case 'approvePayroll': {
      const run = w.payrollRuns.find((r) => r.id === action.id); if (!run) return { world: prev, error: 'no such payroll run' };
      if (run.status !== 'received') return { world: prev, error: run.status === 'awaited' ? 'The register has not been received yet.' : 'The proof is already signed.' };
      run.status = 'proved';
      t({ actor: me, kind: 'approved', summary: `Payroll proof signed — ${run.period}: register = WPS = GL, headcount ties; journals released for approval`, recordRef: run.id });
      break;
    }
    case 'prepareVatReturn': {
      const ret = w.vatReturns.find((v) => v.period === (action.period ?? w.closingPeriod)); if (!ret) return { world: prev, error: 'no VAT return for that period' };
      if (ret.status !== 'open') return { world: prev, error: 'The return is already prepared.' };
      const rejected = w.invoices.filter((i) => i.date.startsWith(ret.period) && i.zatca === 'rejected');
      if (rejected.length) return { world: prev, error: `${rejected.length} invoice(s) in ${ret.period} rejected by ZATCA (${rejected.map((i) => i.id).join(', ')}) — clear them before preparing the return.` };
      ret.figures = vatFigures(w, ret.period); ret.status = 'prepared'; ret.preparedOn = w.asOf;
      t({ actor: ag('iqfal'), kind: 'proposed', autonomy: 'assisted', summary: `VAT return ${ret.period} prepared from the ledger: output SAR ${ret.figures.outputVat.toLocaleString('en-US')} on ${ret.figures.salesCount} cleared invoices, input SAR ${ret.figures.inputVat.toLocaleString('en-US')} on ${ret.figures.purchaseCount} posted vendor invoice(s), net payable SAR ${ret.figures.netPayable.toLocaleString('en-US')}${ret.figures.deferredInputVat ? `; SAR ${ret.figures.deferredInputVat.toLocaleString('en-US')} input VAT held back (${ret.figures.deferredNote})` : ''}`, recordRef: ret.id });
      break;
    }
    case 'approveVatReturn': {
      const ret = w.vatReturns.find((v) => v.id === action.id); if (!ret || !ret.figures) return { world: prev, error: 'no prepared return' };
      if (ret.status !== 'prepared') return { world: prev, error: 'The return is not awaiting approval.' };
      ret.status = 'approved'; ret.approvedOn = w.asOf;
      const k = ret.period.slice(2, 4) + ret.period.slice(5, 7);
      const j: Journal = { id: `DEMO-JE-${k}-${String(w.journals.filter((x) => x.period === ret.period).length + 1).padStart(2, '0')}`, kind: 'VAT settlement', period: ret.period, proposedBy: 'iqfal', status: 'posted', erpRef: nextErp('GL'), description: `${ret.period} VAT return approved: output VAT on cleared invoices settled against recoverable input VAT; the net is payable to ZATCA by ${ret.filingDueOn}.`,
        lines: [{ account: '2300 VAT output', dr: ret.figures.outputVat, cr: 0 }, { account: '1400 VAT input recoverable', dr: 0, cr: ret.figures.inputVat }, { account: '2310 VAT payable — ZATCA', dr: 0, cr: ret.figures.netPayable }] };
      w.journals.push(j); ret.journalId = j.id;
      t({ actor: me, kind: 'approved', summary: `VAT return ${ret.period} approved for filing — SAR ${ret.figures.netPayable.toLocaleString('en-US')} payable to ZATCA by ${ret.filingDueOn}`, recordRef: ret.id });
      const call = journalCall(erp, j);
      t({ actor: ag('iqfal'), kind: 'acted', autonomy: 'assisted', summary: `${j.id} VAT settlement posted as ${j.erpRef}; the return is ready to file on the ZATCA portal`, detail: `${call.method} ${call.path}\n${JSON.stringify(call.body, null, 1)}`, recordRef: ret.id });
      break;
    }
    case 'recordPoCover': {
      const e = w.events.find((x) => x.id === action.eventId); if (!e) return { world: prev, error: 'no such event' };
      if (!e.noPoCover) return { world: prev, error: 'This event already has PO cover.' };
      const po = poOf(w, e.poId); const client = clientOf(w, e.clientId);
      e.noPoCover = false; e.note = `PO cover restored by ${action.poRef} (valid to ${action.validTo}), recorded ${w.asOf}. The September days are billable.`;
      if (!e.evidence.some((v) => v.kind === 'timesheet')) e.evidence.push({ kind: 'timesheet', value: 18, label: '18 consultant days — timesheets approved', source: 'Timesheets', date: `${e.period}-30` });
      po.end = action.validTo; po.status = 'open';
      const contract = w.contracts.find((c) => c.id === po.contractId); if (contract) { contract.end = action.validTo; contract.status = 'active'; }
      const opp = w.opportunities.find((o) => o.clientId === e.clientId && o.stage === 'Verbal award'); if (opp) opp.stage = 'Closed won';
      const f = w.findings.find((x) => x.recordRef === e.id && !x.acknowledged); if (f) { f.acknowledged = true; f.resolvedBy = action.poRef; }
      const drv = w.drivers.find((d) => d.kind === 'Expired PO cover'); if (drv) { drv.amount = r2(drv.amount + toSAR(e.expectedAmount, e.currency)); drv.explanation = `REDC EPMO continuation budgeted at 32 days/month. PO extension ${action.poRef} received ${w.asOf}: the 18 September days are recognised and billable; the remaining variance is 14 days less demand than planned.`; }
      t({ actor: me, kind: 'approved', summary: `PO extension ${action.poRef} recorded for ${client.short} — valid to ${action.validTo}; ${e.label} is covered`, recordRef: e.id });
      t({ actor: ag('aqd'), kind: 'acted', autonomy: 'assisted', summary: `${action.poRef} read from Sirion and matched to ${po.id}: term extended to ${action.validTo}, schedule re-expanded; the September event moves from "no PO cover" to due`, recordRef: po.id });
      break;
    }
    case 'readBackErpJobs': {
      const jobs = w.erpJobs.filter((j) => j.period === w.closingPeriod && j.status !== 'completed');
      if (!jobs.length) return { world: prev, error: 'Every ERP job for the period has already been read back as completed.' };
      const RESULT: Record<number, { summary: string; ties?: boolean }> = {
        14: { summary: 'Depreciation and amortisation SAR 61,300 for September (IT equipment, fit-out, software); no asset class moved more than 3% on the prior month' },
        16: { summary: 'Create Accounting — Fixed Assets: 0 errors; FA sub-ledger SAR 2,418,900 ties to GL accounts 1500–1590', ties: true },
        12: { summary: 'Mass Additions complete' }, 13: { summary: 'CIP capitalisation complete' }, 15: { summary: 'Lease interest and invoices complete' },
      };
      for (const j of jobs) { const r = RESULT[j.procedure]; j.status = 'completed'; j.ranAt = ctx.now; j.errors = 0; if (r) { j.summary = r.summary; if (r.ties !== undefined) j.ties = r.ties; } }
      t({ actor: ag('iqfal'), kind: 'observed', autonomy: 'supervised', summary: `ERP job status read back for ${w.closingPeriod}: ${jobs.map((j) => `${j.name} — completed`).join('; ')}. Fixed Assets sub-ledger ties to GL.`, recordRef: 'P16' });
      count = jobs.length;
      break;
    }
    case 'addJob': { w.jobs = [action.job, ...w.jobs.filter((j) => j.id !== action.job.id)]; break; }
    case 'updateJob': { const i = w.jobs.findIndex((j) => j.id === action.job.id); if (i >= 0) w.jobs[i] = { ...w.jobs[i], ...action.job }; else w.jobs.unshift(action.job); break; }
    case 'routeJob': {
      const j = w.jobs.find((x) => x.id === action.jobId); if (!j) return { world: prev, error: 'no such job' };
      routeJob(w, j, t, ag);
      break;
    }
    case 'updateSettings': {
      const { cognidocs, ...rest } = action.patch;
      w.settings = { ...w.settings, ...rest, cognidocs: { ...w.settings.cognidocs, ...(cognidocs ?? {}) } };
      t({ actor: me, kind: 'observed', summary: `Settings changed: ${Object.keys(action.patch).join(', ')}` });
      break;
    }
    case 'logPersonTrail': { t({ actor: me, kind: 'observed', summary: action.summary, detail: action.detail, recordRef: action.recordRef }); break; }
    default: return { world: prev, error: `Unknown action type: ${(action as { type: string }).type}` };
  }
  w.flags.rev++;
  return { world: w, created, count };
}

/** Where a completed CogniDocs job goes: vendor invoice matching, expense re-billing, or cash and bank. */
function routeJob(w: World, j: ParseJob, t: (e: Omit<TrailEntry, 'id' | 'at'>) => void, ag: (id: string) => { kind: 'agent'; id: string }) {
  if (j.status !== 'completed' || !j.result) return;
  const res = j.result;
  const nid = (p: string) => `${p}-${++w.flags.seq}`;
  if (res.invoice) {
    const inv = res.invoice;
    const net = inv.subtotalAmount10k / 10_000; const vat = inv.taxAmount10k / 10_000;
    if (res.documentType === 'receipt') {
      const id = `DEMO-EXP-${w.expenses.length + 1}`;
      w.expenses.push({ id, clientId: 'sdb', description: `${inv.vendorName} ${inv.invoiceRef} — ${inv.lineItems[0]?.description ?? 'expense'}`, amount: inv.totalAmount10k / 10_000, date: inv.issueDate ?? w.asOf, status: 'queued', jobId: j.id });
      j.routedTo = `Rebillable expense queue — ${id}`;
      t({ actor: ag('mawrid'), kind: 'proposed', autonomy: 'recommend', summary: `Receipt ${inv.vendorName} ${inv.invoiceRef} (SAR ${(inv.totalAmount10k / 10_000).toLocaleString('en-US')}) queued for re-billing to SDB under the travel clause`, recordRef: id });
      return;
    }
    const dup = w.vendorInvoices.find((v) => v.vendorKey === inv.vendorKey && v.invoiceRef.toUpperCase().replace(/[^A-Z0-9]/g, '') === inv.normalizedInvoiceRef);
    if (dup && dup.matchStatus === 'matched') {
      j.routedTo = `Refused — duplicate of ${dup.id} (already matched and posted)`;
      t({ actor: ag('mawrid'), kind: 'rejected', autonomy: 'assisted', summary: `${inv.vendorName} ${inv.invoiceRef} refused — CogniDocs resolved it to the canonical invoice already matched and posted (${dup.id}). Nothing posted.`, recordRef: dup.id });
      return;
    }
    if (dup) {
      dup.cognidocsJobId = j.id; dup.source = 'CogniDocs';
      j.routedTo = `Already on file as ${dup.id} (${dup.matchStatus.replace('_', ' ')}) — no second record created`;
      t({ actor: ag('mawrid'), kind: 'observed', autonomy: 'assisted', summary: `${inv.vendorName} ${inv.invoiceRef} re-submitted — resolves to ${dup.id}, still ${dup.matchStatus.replace('_', ' ')}; nothing duplicated`, recordRef: dup.id });
      return;
    }
    const po = w.vendorPOs.find((p) => p.vendor === inv.vendorName && p.value - p.consumed >= net - 0.01);
    const id = `DEMO-VI-${200 + w.vendorInvoices.length}`;
    const v: VendorInvoice = { id, vendorKey: inv.vendorKey, vendorName: inv.vendorName, invoiceRef: inv.invoiceRef, issueDate: inv.issueDate ?? w.asOf, dueDate: inv.dueDate ?? addDays(w.asOf, 30), currency: inv.currency as 'SAR' | 'USD', net, vat, total: inv.totalAmount10k / 10_000, vendorPOId: po?.id, clientPOLineId: po?.clientPOLineId, matchStatus: po ? 'proposed' : 'no_po', matchNote: po ? `Amount within vendor PO ${po.id} balance (SAR ${(po.value - po.consumed).toLocaleString('en-US')} open). CogniDocs confidence ${res.confidence}; reconciliation ${inv.reconciliation?.matchesTotal ? 'line items match total' : `delta ${inv.reconciliation?.delta10k}`}.` : `No vendor PO found for ${inv.vendorName} with sufficient balance. Routed to Procurement.`, lineItems: inv.lineItems.map((l) => ({ description: l.description, qty: l.quantity10k / 10_000, unitPrice: l.unitPriceAmount10k / 10_000, amount: l.amount10k / 10_000 })), source: 'CogniDocs', cognidocsJobId: j.id };
    w.vendorInvoices.push(v);
    j.routedTo = po ? `Mawrid — 3-way match proposed to vendor PO ${po.id} (${v.id})` : `Mawrid — no vendor PO; routed to Procurement (${v.id})`;
    t({ actor: ag('mawrid'), kind: po ? 'proposed' : 'rejected', autonomy: 'assisted', summary: po ? `${inv.vendorName} ${inv.invoiceRef} — 3-way match proposed to vendor PO ${po.id}, cost to ${po.clientPOLineId}` : `${inv.vendorName} ${inv.invoiceRef} — no vendor PO; refused and routed to Procurement`, recordRef: v.id });
    return;
  }
  if (res.statement) {
    const st = res.statement;
    const accountId = st.bankName.includes('Rajhi') ? 'rajhi-coll' : st.bankName.includes('Awwal') ? 'sab-usd' : 'snb-ops';
    const tolerance = w.settings.cashTolerance;
    let added = 0, applied = 0, proposed = 0, unapplied = 0;
    for (const tx of st.transactions) {
      const amount = tx.amount10k / 10_000;
      const exists = w.bankLines.find((b) => b.accountId === accountId && b.date === tx.date && Math.abs(b.amount - amount) < 0.005 && b.rawDescription === tx.rawDescription);
      if (exists) continue;
      added++;
      const bl: BankLine = { id: nid('BL'), accountId, date: tx.date, description: tx.description, rawDescription: tx.rawDescription, amount, direction: tx.direction, type: tx.type === 'fee' ? 'charge' : amount > 0 ? 'receipt' : 'payment', source: 'CogniDocs' };
      w.bankLines.push(bl);
      if (tx.direction === 'credit') {
        const refMatch = w.invoices.find((i) => tx.rawDescription.includes(i.id.replace('DEMO-', '')) && i.status !== 'paid');
        if (refMatch) { const r: CashReceipt = { id: nid('RC'), bankLineId: bl.id, clientId: refMatch.clientId, invoiceIds: [refMatch.id], amount, method: 'reference', confidence: 1, status: 'applied' }; w.receipts.push(r); bl.receiptId = r.id; refMatch.status = 'paid'; const le: LedgerEntry = { id: nid('LE'), accountId, date: tx.date, kind: 'receipt', description: `Receipt ${refMatch.id}`, amount, reference: refMatch.id, matchedBankLineId: bl.id }; w.ledger.push(le); bl.matchedLedgerId = le.id; applied++; continue; }
        const open = w.invoices.filter((i) => ['posted', 'released'].includes(i.status) && i.zatca !== 'rejected' && i.currency === (accountId === 'sab-usd' ? 'USD' : 'SAR'));
        const byAmount = open.find((i) => Math.abs(i.gross - amount) < 0.005);
        if (byAmount) { const r: CashReceipt = { id: nid('RC'), bankLineId: bl.id, clientId: byAmount.clientId, invoiceIds: [byAmount.id], amount, method: 'amount_client', confidence: 0.78, status: 'proposed', note: `No reference on the transfer; amount equals ${byAmount.id} (${clientOf(w, byAmount.clientId).short}).` }; w.receipts.push(r); proposed++; continue; }
        const client = w.clients.find((c) => tx.rawDescription.toUpperCase().includes(c.short.toUpperCase()) || tx.rawDescription.toUpperCase().includes(c.name.toUpperCase().slice(0, 12)));
        if (client) {
          const theirs = open.filter((i) => i.clientId === client.id);
          const total = theirs.reduce((s, i) => s + i.gross, 0);
          if (theirs.length && Math.abs(total - amount) <= tolerance) { const r: CashReceipt = { id: nid('RC'), bankLineId: bl.id, clientId: client.id, invoiceIds: theirs.map((i) => i.id), amount, method: 'tolerance', confidence: 0.93, status: 'proposed', shortfall: r2(total - amount), note: `Amount equals ${theirs.length} open invoice(s) less SAR ${r2(total - amount)} — within the SAR ${tolerance} tolerance (bank charge).` }; w.receipts.push(r); proposed++; continue; }
        }
        if (tx.type !== 'transfer' || !tx.rawDescription.startsWith('INTERNAL')) { const r: CashReceipt = { id: nid('RC'), bankLineId: bl.id, clientId: null, invoiceIds: [], amount, method: 'manual', confidence: 0, status: 'unapplied', note: 'No reference, no amount match. Needs a person.' }; w.receipts.push(r); unapplied++; continue; }
      }
      const le = w.ledger.find((l) => l.accountId === accountId && !l.matchedBankLineId && Math.abs(l.amount - amount) < 0.005);
      if (le) { le.matchedBankLineId = bl.id; bl.matchedLedgerId = le.id; }
    }
    j.routedTo = `Tasweya — ${added} new line(s) on ${st.bankName}: ${applied} applied, ${proposed} proposed, ${unapplied} unapplied`;
    t({ actor: ag('tasweya'), kind: added ? 'acted' : 'observed', autonomy: 'supervised', summary: `${st.bankName} statement ${st.periodStart}→${st.periodEnd} read (${res.parserPath}, confidence ${res.confidence}): ${st.transactions.length} transactions, ${added} new; ${applied} receipt(s) applied by reference, ${proposed} proposed, ${unapplied} unapplied`, recordRef: j.id });
  }
}
