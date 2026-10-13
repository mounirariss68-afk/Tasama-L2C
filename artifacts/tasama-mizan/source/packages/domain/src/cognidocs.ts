/**
 * CogniDocs integration — the one real contract in the prototype.
 *
 * Two modes:
 *  - simulated: an in-app emulator that produces the canonical envelope with
 *    the real status transitions (queued → processing → completed/failed) and
 *    timings. Default. Every job is labelled "simulated".
 *  - live: POST /documents then poll GET /jobs/{id} with the backoff the guide
 *    prescribes (~2 s, then exponential with jitter to ~10 s). Through the
 *    server proxy (/api/cognidocs) when the app is served; direct when it is
 *    the standalone file and the deployment allows it.
 *
 * Money stays as integer ×10,000 inside the envelope. Conversion is display-only.
 */
import type { CogniDocsResult, DeclaredType, ParseJob } from './types';


const to10k = (n: number) => Math.round(n * 10_000);
const nowIso = () => new Date().toISOString();
let seq = 7000;
const jobId = () => `DEMO-JOB-${(seq++).toString(16)}`;

/* -------------------------------------------------------- sample docs */

export type SampleDoc = {
  id: string; label: string; fileName: string; declaredType: DeclaredType; description: string;
  /** What the emulator returns for this document. */
  result: () => CogniDocsResult;
  routeHint: string;
};

function invoiceResult(args: { vendorKey: string; vendorName: string; ref: string; issueDate: string; dueDate: string; currency: string; lines: { description: string; qty: number; unitPrice: number; periodStart?: string; periodEnd?: string }[]; confidence?: number; iban?: string; detailTier?: 'itemized' | 'hybrid' | 'summary'; missing?: string[]; parserPath?: string; documentType?: 'invoice' | 'receipt'; paymentMethod?: string | null }): CogniDocsResult {
  const net = args.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const tax = Math.round(net * 0.15 * 100) / 100;
  const lineSum10k = args.lines.reduce((s, l) => s + to10k(l.qty * l.unitPrice), 0);
  return {
    documentType: args.documentType ?? 'invoice', parserPath: args.parserPath ?? 'vendor_template', confidence: args.confidence ?? 96, statement: null,
    invoice: {
      id: `cd-${args.ref.toLowerCase().replace(/[^a-z0-9]/g, '')}`, vendorKey: args.vendorKey, vendorName: args.vendorName, invoiceRef: args.ref,
      normalizedInvoiceRef: args.ref.toUpperCase().replace(/[^A-Z0-9]/g, ''), issueDate: args.issueDate, dueDate: args.dueDate, currency: args.currency,
      subtotalAmount10k: to10k(net), taxAmount10k: to10k(tax), totalAmount10k: to10k(net + tax), categoryKey: 'professional_services',
      detailTier: args.detailTier ?? 'itemized',
      fieldConfidence: { vendorName: 0.99, invoiceRef: 0.98, issueDate: 0.97, totalAmount: 0.99, taxAmount: 0.98, dueDate: args.missing?.includes('dueDate') ? 0 : 0.9 },
      fieldsMissing: args.missing ?? [], reconciliation: { lineItemSum10k: lineSum10k, matchesTotal: lineSum10k === to10k(net), delta10k: to10k(net) - lineSum10k },
      paymentMethod: args.paymentMethod ?? null, paymentReference: null, associatedInvoiceRefs: [],
      bankingDetails: args.iban ? { bankName: 'Saudi National Bank', accountName: args.vendorName, accountNumber: null, iban: args.iban, swiftBic: 'NCBKSAJE' } : null,
      lineItems: args.lines.map((l, i) => ({ id: `li-${i + 1}`, lineNumber: i + 1, section: null, description: l.description, quantity10k: to10k(l.qty), unitPriceAmount10k: to10k(l.unitPrice), amount10k: to10k(l.qty * l.unitPrice), taxAmount10k: to10k(l.qty * l.unitPrice * 0.15), periodStart: l.periodStart ?? null, periodEnd: l.periodEnd ?? null })),
    },
  };
}

function statementResult(args: { bankName: string; bankId: number; accountRef: string; currency: string; periodStart: string; periodEnd: string; template: string; tx: { date: string; description: string; raw: string; amount: number; type: string; category: string; balance?: number }[]; confidence?: number }): CogniDocsResult {
  return {
    documentType: 'bank_statement', parserPath: `template_match:${args.template}`, confidence: args.confidence ?? 97, invoice: null,
    statement: {
      bankId: args.bankId, bankName: args.bankName, statementType: 'bank_statement', currency: args.currency, accountRef: args.accountRef, periodStart: args.periodStart, periodEnd: args.periodEnd, templateId: args.template, templateGenerated: false,
      transactions: args.tx.map((t, i) => ({
        id: `tx-${i + 1}`, date: t.date, description: t.description, rawDescription: t.raw, amount10k: to10k(t.amount), currency: args.currency,
        direction: t.amount < 0 ? 'debit' : 'credit', type: t.type, balance10k: t.balance !== undefined ? to10k(t.balance) : null, page: 1,
        category: t.category, effectiveCategory: t.category, normalizedMerchant: t.description.split(' — ')[0], matchConfidence: 0.9, notes: [],
      })),
    },
  };
}

export const SAMPLE_DOCS: SampleDoc[] = [
  {
    id: 'masterworks', label: 'Vendor invoice — Masterworks MW-INV-2609-031', fileName: 'Masterworks_MW-INV-2609-031.pdf', declaredType: 'invoice', description: 'ServiceNow implementation milestone 3 for the SDB engagement, SAR 270,000 + VAT. Matches vendor PO 3596.', routeHint: 'Mawrid — 3-way match to vendor PO 3596, cost allocated to SDB MS3',
    result: () => invoiceResult({ vendorKey: 'masterworks', vendorName: 'Masterworks', ref: 'MW-INV-2609-031', issueDate: '2026-09-28', dueDate: '2026-10-28', currency: 'SAR', iban: 'SA12 1000 0000 7781 2210 0453', lines: [{ description: 'ServiceNow ITSM implementation — milestone 3 (go-live preparation) services', qty: 1, unitPrice: 270_000, periodStart: '2026-07-01', periodEnd: '2026-09-25' }] }),
  },
  {
    id: 'oracle-dup', label: 'Vendor invoice — Oracle ORC-2026-00917 (duplicate)', fileName: 'Oracle_ORC-2026-00917.pdf', declaredType: 'invoice', description: 'The Oracle MT licence invoice already matched in February, submitted a second time. CogniDocs resolves it to the existing canonical invoice; Mawrid refuses to post it.', routeHint: 'Mawrid — refused: duplicate of DEMO-VI-0101',
    result: () => invoiceResult({ vendorKey: 'oracle-ksa', vendorName: 'Oracle Systems Saudi Arabia', ref: 'ORC-2026-00917', issueDate: '2026-02-05', dueDate: '2026-03-07', currency: 'SAR', lines: [{ description: 'Oracle Fusion Cloud ERP — Multi-Tenancy bundle, 25 hosted named users, 12 months', qty: 1, unitPrice: 162_500, periodStart: '2026-02-01', periodEnd: '2027-01-31' }], confidence: 98 }),
  },
  {
    id: 'accenture-nopo', label: 'Vendor invoice — Accenture ACN-SA-26-0533 (no PO)', fileName: 'Accenture_ACN-SA-26-0533.pdf', declaredType: 'invoice', description: 'Change request CR-7 on the KSIA PMIS programme, SAR 280,000. Cites "PO 3051-A", which does not exist.', routeHint: 'Mawrid — refused: no vendor PO; routed to Procurement',
    result: () => invoiceResult({ vendorKey: 'accenture-ksa', vendorName: 'Accenture Saudi Arabia', ref: 'ACN-SA-26-0533', issueDate: '2026-09-30', dueDate: '2026-10-30', currency: 'SAR', lines: [{ description: 'PMIS Phase D2 — change request CR-7, additional integrations (Aconex, Primavera)', qty: 1, unitPrice: 280_000 }], parserPath: 'ai_text', confidence: 91 }),
  },
  {
    id: 'receipt-travel', label: 'Receipt — Riyadh Air, consultant travel (rebillable)', fileName: 'RiyadhAir_receipt_RX-884120.pdf', declaredType: 'receipt', description: 'Flight for a Tasama consultant on the SDB engagement, SAR 1,840. Rebillable under the travel clause.', routeHint: 'Expense re-billing queue — SDB, travel clause 7.3',
    result: () => invoiceResult({ documentType: 'receipt', vendorKey: 'riyadh-air', vendorName: 'Riyadh Air', ref: 'RX-884120', issueDate: '2026-09-18', dueDate: '2026-09-18', currency: 'SAR', paymentMethod: 'card', lines: [{ description: 'RUH–JED–RUH economy, 17–18 Sep 2026, consultant travel', qty: 1, unitPrice: 1_600 }], detailTier: 'hybrid', confidence: 94, parserPath: 'ai_vision' }),
  },
  {
    id: 'snb-statement', label: 'Bank statement — SNB operating, September 2026', fileName: 'SNB_Operating_092026.pdf', declaredType: 'bank_statement', description: 'Seven lines: payroll, GOSI, VAT, a vendor payment, the sweep from collections, service charges.', routeHint: 'Tasweya — bank reconciliation, SNB operating',
    result: () => statementResult({ bankName: 'Saudi National Bank', bankId: 12, accountRef: '••••9012', currency: 'SAR', periodStart: '2026-09-01', periodEnd: '2026-09-30', template: 'snb-corp-v4', tx: [
      { date: '2026-09-09', description: 'Accenture Saudi Arabia — ACN-SA-26-0412', raw: 'OUTWARD TRF ACCENTURE SAUDI ARABIA ACN-SA-26-0412', amount: -402_500, type: 'transfer', category: 'Vendor payments' },
      { date: '2026-09-14', description: 'GOSI contributions — August', raw: 'GOSI SADAD 082026', amount: -133_800, type: 'payment', category: 'Government & tax' },
      { date: '2026-09-16', description: 'Transfer from collections account', raw: 'INTERNAL TRF FROM 6080 1016 7519', amount: 600_000, type: 'transfer', category: 'Payment & Transfers' },
      { date: '2026-09-25', description: 'Payroll — September', raw: 'WPS SALARY FILE 092026 MUDAD', amount: -804_300, type: 'payment', category: 'Payroll' },
      { date: '2026-09-28', description: 'ZATCA — VAT return August', raw: 'SADAD ZATCA VAT 082026', amount: -99_916.54, type: 'payment', category: 'Government & tax' },
      { date: '2026-09-30', description: 'Account maintenance and transfer fees', raw: 'SERVICE CHARGES SEP 2026', amount: -345, type: 'fee', category: 'Bank charges' },
    ] }),
  },
  {
    id: 'rajhi-statement', label: 'Bank statement — Al Rajhi collections, September 2026', fileName: 'AlRajhi_Collections_092026.pdf', declaredType: 'bank_statement', description: 'Client receipts including the KSIA payment run short by SAR 37.50 and an unreferenced REDC transfer.', routeHint: 'Tasweya — cash application + bank reconciliation, Al Rajhi',
    result: () => statementResult({ bankName: 'Al Rajhi Bank', bankId: 7, accountRef: '••••7519', currency: 'SAR', periodStart: '2026-09-01', periodEnd: '2026-09-30', template: 'rajhi-corp-v2', tx: [
      { date: '2026-09-16', description: 'Transfer to operating account', raw: 'INTERNAL TRF TO 1234 5678 9012', amount: -600_000, type: 'transfer', category: 'Payment & Transfers' },
      { date: '2026-09-22', description: 'Riyadh Expo Dev — unreferenced', raw: 'INWARD TRF RIYADH EXPO DEV', amount: 184_000, type: 'transfer', category: 'Customer receipts' },
      { date: '2026-09-29', description: 'KSIA — payment run 2609', raw: 'INWARD TRF KING SALMAN INTL AIRPORT DEV CO PAYMENT RUN 2609', amount: 203_429.7, type: 'transfer', category: 'Customer receipts' },
    ] }),
  },
];

/* --------------------------------------------------------- emulator */

export function emulateJob(file: { name: string; size: number; type: string }, declaredType: DeclaredType, sample: SampleDoc | null, sandbox: boolean): ParseJob {
  return {
    id: jobId(), declaredType, detectedType: null, status: 'queued', fileName: file.name, mimeType: file.type || 'application/pdf', fileSizeBytes: file.size,
    startedAt: null, parserPath: null, confidence: null, error: null, aiPromptTokens: null, aiCompletionTokens: null, aiCostAmount10k: null,
    sandbox, result: null, createdAt: nowIso(), completedAt: null, mode: 'simulated',
    routedTo: sample ? undefined : undefined,
  };
}

/** The emulator's completion step: what a real poll would return once the job is done. */
export function emulateCompletion(job: ParseJob, sample: SampleDoc | null): ParseJob {
  if (!sample) {
    // An unknown document: CogniDocs would still parse it. We cannot read PDFs
    // in the browser, so we say so rather than invent a result.
    return { ...job, status: 'failed', startedAt: nowIso(), completedAt: nowIso(), error: 'Simulated mode cannot read an arbitrary file. Use one of the sample documents, or switch CogniDocs to Live in Settings.', aiPromptTokens: 0, aiCompletionTokens: 0, aiCostAmount10k: 0 };
  }
  const result = sample.result();
  const ai = result.parserPath.startsWith('ai') ? { aiPromptTokens: 4210, aiCompletionTokens: 612, aiCostAmount10k: 142 } : { aiPromptTokens: 0, aiCompletionTokens: 0, aiCostAmount10k: 0 };
  return { ...job, status: 'completed', startedAt: job.startedAt ?? nowIso(), completedAt: nowIso(), detectedType: result.documentType, parserPath: result.parserPath, confidence: result.confidence, result, ...ai };
}

