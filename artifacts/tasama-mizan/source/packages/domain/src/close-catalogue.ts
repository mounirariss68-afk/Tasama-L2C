import type { CloseField, CloseProcedure } from './close-types';

const text = (key: string, label: string, required = true): CloseField => ({ key, label, required, type: 'text' });
const num = (key: string, label: string, required = true): CloseField => ({ key, label, required, type: 'number' });
const date = (key: string, label: string, required = true): CloseField => ({ key, label, required, type: 'date' });
const select = (key: string, label: string, options: string[]): CloseField => ({ key, label, options, required: true, type: 'select' });
const note = (key: string, label: string): CloseField => ({ key, label, required: true, type: 'textarea' });
const evidence: CloseField[] = [
  select('provenance', 'Evidence source', ['Demo', 'Manual external result', 'Imported external result']),
  text('evidenceRef', 'Document or evidence reference'),
  text('sourcePeriod', 'Evidence reporting period (YYYY-MM)'),
  date('sourceDate', 'Source as-of date'),
  select('currency', 'Currency', ['SAR', 'USD']),
  note('commentary', 'Review commentary / scope and completeness'),
];
const job: CloseField[] = [
  select('jobState', 'Externally recorded job outcome', ['Not run', 'Running', 'Error', 'Accounted', 'Transferred', 'GL posted']),
  text('runRef', 'ERP accounting run reference'), date('runDate', 'Accounting run date'),
  num('sourceTotal', 'Source control total'), num('accountedTotal', 'Accounted / posted control total'),
  text('transferRef', 'GL transfer reference', false), text('postingRef', 'GL posting reference', false),
  { key: 'jobErrors', label: 'Unresolved accounting errors (leave empty when clear)', type: 'textarea' },
];
const reconcile = [num('sourceTotal', 'Subledger / source balance'), num('glTotal', 'Independently supplied GL balance'), text('glRef', 'Independent GL export reference')];
const accrual = [num('amount', 'Accrual amount'), text('journalRef', 'Accrual journal / posting reference'), date('reversalDate', 'Planned reversal date'), text('reversalRef', 'Planned reversal reference')];
const rows: [string, string, string, CloseField[], CloseProcedure['native']?][] = [
  ['Closing coordination', 'Finance – Closing Coordination', 'Communicate and monitor the monthly closing calendar, cut-off dates and submissions. Follow up with HR, Requesters, Operations, Technology and other departments.', [date('communicatedDate', 'Calendar communicated on'), text('calendarRef', 'Calendar / cut-off reference'), note('submissionsRequired', 'Required submissions and accountable departments')]],
  ['Payroll output', 'Human Resources / Payroll', 'Complete salaries, allowances, deductions, approved adjustments and final settlements; provide final payroll output to Finance.', [date('paidDate', 'Payroll payment date'), num('salaries', 'Aggregate salaries'), num('allowances', 'Aggregate allowances'), num('deductions', 'Aggregate deductions'), num('adjustments', 'Approved adjustments (signed)'), num('settlements', 'Final settlements'), num('netPayroll', 'Net payroll paid'), text('paymentRef', 'Payment reference')]],
  ['Purchasing CoCs', 'Requesters / Business Owners', 'Complete ERP Certificates of Completion for goods/services received or completed during the month. These are inbound supplier receipts, not client delivery CoCs.', [num('expectedReceipts', 'Expected received goods/service records'), num('sourceTotal', 'Expected receipt control total')]],
  ['Operations delivery schedule', 'Operations', 'Submit the monthly completed-work/service schedule and related client invoices to Finance.', [num('completedCount', 'Completed works / services'), num('sourceTotal', 'Delivered schedule total'), num('invoicedTotal', 'Related invoice total'), num('unbilledTotal', 'Documented unbilled total'), text('invoiceRefs', 'Related invoice / unbilled schedule references')], 'billing'],
  ['D&T delivery schedule', 'D&T', 'Submit the monthly completed-work/service schedule and related client invoices to Finance.', [num('completedCount', 'Completed works / services'), num('sourceTotal', 'Delivered schedule total'), num('invoicedTotal', 'Related invoice total'), num('unbilledTotal', 'Documented unbilled total'), text('invoiceRefs', 'Related invoice / unbilled schedule references')], 'billing'],
  ['Bank reconciliations', 'Finance – Cash Management', 'Complete bank reconciliations and investigate all unmatched or outstanding transactions.', reconcile, 'bank'],
  ['Cash Create Accounting', 'Finance – Cash Management', 'Run Create Accounting, resolve accounting errors and transfer/post to GL.', job, 'journals'],
  ['AP invoice approvals', 'Finance – Accounts Payable', 'Complete required invoice approvals and follow up on material pending invoices.', [num('pendingInvoices', 'Unresolved required invoice approvals'), note('approvalScope', 'AP approval completeness / material pending invoices')], 'inbox'],
  ['AP Accounting / Multiperiod', 'Finance – Accounts Payable', 'Run Create Accounting/Multiperiod for AP, resolve errors and transfer/post to GL.', [...job, text('multiperiodRef', 'Multiperiod allocation schedule / run reference')]],
  ['Purchasing CoC accrual', 'Finance – AP / GL', 'Run Accrual for inbound purchasing CoCs, resolve errors and transfer/post to GL.', [...job, ...accrual, text('cocRefs', 'Accepted purchasing CoC references')], 'journals'],
  ['Cost review / manual accruals', 'Finance – GL', 'Review all costs and book all material manual accrual entries.', [...accrual, note('costScope', 'Cost completeness / material accrual assessment')], 'journals'],
  ['AP / Mass Additions', 'Finance – Fixed Assets', 'Transfer eligible asset purchases from AP/Mass Additions and verify completeness.', [num('eligibleTotal', 'Eligible AP asset purchases'), num('transferredTotal', 'Mass additions transferred'), text('assetRefs', 'Asset / Mass Additions references')]],
  ['CIP capitalization', 'Finance – Fixed Assets', 'Capitalize completed CIP/project items where applicable.', [num('completedCip', 'Completed CIP eligible for capitalization'), num('capitalized', 'CIP capitalized'), text('capitalizationRef', 'Capitalization posting or reviewed nil-return reference')]],
  ['Depreciation / amortization', 'Finance – Fixed Assets', 'Run monthly depreciation and amortization and review significant or unusual movements.', [num('depreciation', 'Monthly depreciation'), num('amortization', 'Monthly amortization'), text('depreciationRef', 'Run / posting reference'), note('movements', 'Significant movements and review')]],
  ['Lease interest / invoices', 'Finance – Leases', 'Run monthly interest and review outstanding lease invoices.', [num('interest', 'Monthly lease interest'), num('outstanding', 'Outstanding lease invoice total'), text('leaseScheduleRef', 'Lease interest / liability schedule'), text('leasePostingRef', 'Interest posting reference'), note('leaseReview', 'Outstanding invoice review and disposition')]],
  ['FA Accounting / GL tie', 'Finance – Fixed Assets', 'Run Create Accounting for Fixed Assets, resolve errors and reconcile FA subledger with GL.', [...job, ...reconcile]],
  ['Client invoices / credit notes', 'Finance – Receivables', 'Ensure and book all client invoices and credit notes in the ERP.', [num('pendingInvoices', 'Unrecorded invoices / credit notes'), text('creditNoteRefs', 'Credit-note register or reviewed nil-return reference'), text('erpRegisterRef', 'Complete ERP invoice / credit-note register')], 'billing'],
  ['Receivables / unapplied receipts', 'Finance – Receivables', 'Review outstanding receivables and unapplied receipts.', [note('ageingReview', 'Ageing / collection review'), note('receiptReview', 'Unapplied receipt resolution')], 'collections'],
  ['Delivery / revenue recognition', 'Finance – Receivables', 'Validate all services delivered to clients and book revenue where recognized.', [num('recognizedTotal', 'Recognized revenue'), text('recognitionRef', 'Recognition schedule / journal reference'), note('recognitionPolicy', 'Delivery completeness and recognition basis')], 'billing'],
  ['Unearned / unbilled balances', 'Finance – Receivables', 'Review both unearned and unbilled revenue balances.', [num('unbilled', 'Reviewed unbilled balance'), num('unearned', 'Reviewed unearned balance'), note('balanceReview', 'Balance roll-forward and journal review')], 'journals'],
  ['AR Create Accounting', 'Finance – Receivables', 'Run Create Accounting for AR, resolve errors and transfer/post to GL.', [...job, ...reconcile]],
  ['Financial statement review', 'Finance – Reporting', 'Review monthly P&L and Balance Sheet against prior month, budget and expectations; investigate variances and post corrections.', [text('trialBalanceRef', 'Trial-balance export reference'), num('expectedAccounts', 'Expected trial-balance account count'), note('expectations', 'Expectations and significant variances'), text('correctionRefs', 'Correction journal references or reviewed nil-return')], 'budget'],
  ['Final approval / ERP close', 'Finance – Reporting', 'Complete final review and approvals, then close the accounting period in the ERP.', [text('approvalRef', 'Final review approval reference'), note('finalReview', 'Final review / approval conclusions')]],
  ['Reports / dashboard', 'Finance – Reporting', 'Prepare monthly reports and update the dashboard.', [text('reportRef', 'Reviewed report / dashboard references'), note('distribution', 'Report audience and dashboard refresh scope')]],
];
const owners = ['omar', 'hr', 'requester', 'operations', 'technology', 'omar', 'omar', 'omar', 'omar', 'omar', 'omar', 'omar', 'omar', 'omar', 'omar', 'omar', 'omar', 'faisal', 'faisal', 'omar', 'omar', 'reem', 'reem', 'reem'];
export const CLOSE_PROCEDURES: CloseProcedure[] = rows.map(([title, department, description, fields, native], i) => {
  const number = i + 1;
  const automation = number === 2 || number === 4 || number === 5 ? 'Check with Department' : [1, 19, 22, 24].includes(number) ? 'No' : [11, 18, 20].includes(number) ? 'Partial' : 'Full';
  const coverage = [6, 18, 19, 20].includes(number) ? 'Strong demo' : [1, 4, 5, 7, 8, 11, 17, 22, 23, 24].includes(number) ? 'Partial / adjacent' : 'External workpaper';
  return { number, title, department, description, owner: owners[i], reviewer: number <= 5 ? 'reem' : owners[i] === 'reem' ? 'noura' : 'reem', automation, coverage,
    deadline: number === 1 ? '25th' : number === 2 ? 'payroll+3' : number <= 5 ? 'month-end+2' : 'inputs+2',
    prerequisites: number <= 5 ? [] : [1, 2, 3, 4, 5], fields: [...evidence, ...fields], native };
});
export const ACCOUNTING_PROCEDURES = [7, 9, 10, 16, 21];
export const procedureByNumber = (number: number) => CLOSE_PROCEDURES.find(p => p.number === number);
