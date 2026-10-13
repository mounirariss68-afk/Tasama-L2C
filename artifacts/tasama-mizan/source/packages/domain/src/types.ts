/**
 * Tasama Mizan — the domain.
 *
 * Inputs are authored (contracts, PO lines, evidence, invoices, bank lines,
 * budget). Everything a screen shows about status, exposure, variance or
 * readiness is DERIVED in lib/derive.ts. No screen computes on its own —
 * that is how two screens stop contradicting each other.
 *
 * Money is a plain number in the contract currency with two decimals.
 * CogniDocs speaks integer ×10,000 ("Amount10k"); the conversion happens at
 * the CogniDocs boundary only (lib/cognidocs.ts).
 */

export type Segment = 'PIF' | 'Government' | 'Private' | 'International';
export type Currency = 'SAR' | 'USD';

export type BusinessLine =
  | '502' // Foundation Technology (D&T)
  | '504' // Enterprise Solutions (D&T)
  | '506' // Business Solutions (D&T)
  | 'SES-FIN' // Finance Managed Services
  | 'SES-HR' // HR & Payroll Managed Services
  | 'SES-PROC' // Procurement Managed Services
  | 'BES' // Business Enablement — Workplace, Soft Landing, Legal bundles
  | 'EVAS'; // Enterprise Value-Added — Innovation, Data & AI

export const BUSINESS_LINE_LABEL: Record<BusinessLine, string> = {
  '502': '502 · Foundation Technology',
  '504': '504 · Enterprise Solutions',
  '506': '506 · Business Solutions',
  'SES-FIN': 'SES · Finance Managed Services',
  'SES-HR': 'SES · HR & Payroll Services',
  'SES-PROC': 'SES · Procurement Services',
  BES: 'BES · Business Enablement',
  EVAS: 'EVAS · Value-Added Services',
};

export type ServiceTag =
  | 'AMS' | 'ERP' | 'TechF' | 'PMIS' | 'EPMO' | 'ServiceNow' | 'Licences'
  | 'Finance MS' | 'HR MS' | 'Procurement MS' | 'Workplace' | 'Soft Landing' | 'Legal' | 'Innovation' | 'Data & AI';

export type PricingModel =
  | 'monthly_fixed'
  | 'monthly_variable_days'
  | 'monthly_variable_volume'
  | 'milestone'
  | 'one_off'
  | 'pass_through'
  | 'advance';

export const PRICING_LABEL: Record<PricingModel, string> = {
  monthly_fixed: 'Monthly fixed fee',
  monthly_variable_days: 'Time & material — days × rate',
  monthly_variable_volume: 'Bundle with volume cap',
  milestone: 'Milestone (% of fixed fee)',
  one_off: 'One-off fee',
  pass_through: 'Pass-through at cost + mark-up',
  advance: 'Annual fee invoiced in advance',
};

export type Client = {
  id: string;
  code: string;
  name: string;
  short: string;
  segment: Segment;
  pif: boolean;
  kam: string;
  deliveryLead: string;
  vatNo: string | null;
  paymentTermsDays: number;
  currency: Currency;
  /** How this client pays — the collections agent changes tone and timing on it. */
  channel: 'bank transfer' | 'Etimad' | 'international wire';
};

export type Contract = {
  id: string;
  clientId: string;
  type: 'MSA' | 'Service Agreement' | 'Frame Agreement';
  status: 'active' | 'expiring' | 'expired';
  start: string;
  end: string;
  totalValue: number | null;
  paymentTermsDays: number;
  cocRequired: boolean;
  rateCardVersion: string;
  source: 'Sirion';
};

export type ClientPO = {
  id: string;
  clientId: string;
  contractId: string;
  proposalId: string;
  date: string;
  start: string;
  end: string;
  value: number;
  currency: Currency;
  status: 'open' | 'consumed' | 'expired' | 'closed';
  /** Confirmed by the Revenue & Treasury lead — until then Aqd's schedule is a proposal. */
  scheduleConfirmed: boolean;
  lines: POLine[];
};

export type POLine = {
  id: string;
  poId: string;
  activity: string;
  businessLine: BusinessLine;
  serviceTag: ServiceTag;
  pricingModel: PricingModel;
  unit: string;
  rate: number;
  qty: number;
  /** Cap for volume bundles; the included volume per month. */
  includedVolume?: number;
  unitPrice?: number;
  markupPct?: number;
  milestones?: { id: string; name: string; pct: number; planned: string }[];
  start: string;
  end: string;
  vendorPOId?: string;
  /** Mismatches Aqd found between PO line and quote line. */
  matchFlags: string[];
};

export type EvidenceKind = 'month_elapsed' | 'timesheet' | 'milestone' | 'licence' | 'volume' | 'vendor_match' | 'contract_start';

export type Evidence = {
  kind: EvidenceKind;
  value: number;
  label: string;
  source: 'PPM' | 'ServiceNow' | 'Timesheets' | 'Oracle Procurement' | 'Sirion' | 'Mizan';
  date: string;
};

export type CocStatus = 'not_required' | 'to_send' | 'sent' | 'reminded' | 'escalated' | 'signed' | 'disputed';

/** One expected billing occurrence, generated from a PO line's pricing model. */
export type BillingEvent = {
  id: string;
  lineId: string;
  poId: string;
  clientId: string;
  period: string; // YYYY-MM
  label: string;
  dueDate: string;
  expectedAmount: number;
  currency: Currency;
  evidenceRequired: EvidenceKind[];
  evidence: Evidence[];
  coc: CocStatus;
  cocSentOn?: string;
  invoiceId?: string;
  /** Authored only for the handful of edge cases the demo is built around. */
  note?: string;
  /** Delivery continuing without PO cover — the money exists, the right to bill does not. */
  noPoCover?: boolean;
};

export type ZatcaStatus = 'draft' | 'submitted' | 'cleared' | 'rejected';

export type Invoice = {
  id: string;
  clientId: string;
  poId: string;
  eventIds: string[];
  date: string;
  dueDate: string;
  currency: Currency;
  net: number;
  vat: number;
  gross: number;
  status: 'draft' | 'released' | 'posted' | 'paid' | 'part_paid' | 'credited';
  zatca: ZatcaStatus;
  zatcaReason?: string;
  erpRef?: string;
  creditNoteOf?: string;
  /** Rate actually used — Hares compares it with the contract rate. */
  billedRate?: number;
  description: string;
};

export type BankAccount = {
  id: string;
  bank: string;
  label: string;
  iban: string;
  currency: Currency;
  openingLedger: number;
  openingStatement: number;
  reconciledThrough: string;
  signedOff: boolean;
};

export type BankLine = {
  id: string;
  accountId: string;
  date: string;
  description: string;
  rawDescription: string;
  amount: number; // signed, in account currency
  direction: 'debit' | 'credit';
  type: 'receipt' | 'payment' | 'payroll' | 'charge' | 'tax' | 'transfer' | 'fx';
  reference?: string;
  /** Set when a statement line is reconciled to a ledger entry or to applied receipts. */
  matchedLedgerId?: string;
  receiptId?: string;
  source: 'CogniDocs' | 'Bank portal CSV';
};

export type LedgerEntry = {
  id: string;
  accountId: string;
  date: string;
  kind: 'receipt' | 'payment' | 'payroll' | 'charge' | 'tax' | 'transfer' | 'fx';
  description: string;
  amount: number;
  reference?: string;
  matchedBankLineId?: string;
};

export type ReceiptMatchMethod = 'reference' | 'amount_client' | 'tolerance' | 'one_to_many' | 'manual';

export type CashReceipt = {
  id: string;
  bankLineId: string;
  clientId: string | null;
  invoiceIds: string[];
  amount: number;
  method: ReceiptMatchMethod;
  confidence: number; // 0–1
  status: 'applied' | 'proposed' | 'unapplied';
  note?: string;
  /** The difference between what was paid and what was invoiced, when tolerance applied. */
  shortfall?: number;
};

export type VendorPO = {
  id: string; // 4-digit, Tasama's own format
  vendor: string;
  clientPOLineId: string;
  value: number;
  costCategory: 'Subscriptions & Professional Fees' | 'IT Consultancy' | 'Software License' | 'Support' | 'IT Infrastructure' | 'Staff';
  consumed: number;
};

export type VendorInvoice = {
  id: string;
  vendorKey: string;
  vendorName: string;
  invoiceRef: string;
  issueDate: string;
  dueDate: string;
  currency: Currency;
  net: number;
  vat: number;
  total: number;
  vendorPOId?: string;
  clientPOLineId?: string;
  matchStatus: 'matched' | 'proposed' | 'no_po' | 'duplicate' | 'rejected';
  matchNote?: string;
  lineItems: { description: string; qty: number; unitPrice: number; amount: number }[];
  source: 'CogniDocs' | 'Email';
  cognidocsJobId?: string;
};

export type BudgetRow = {
  businessLine: BusinessLine;
  month: number; // 1..12
  budget: number;
  target: number;
  forecast: number;
};

export type VarianceDriver = {
  businessLine: BusinessLine;
  kind: 'PO not received' | 'Timing (CoC / milestone)' | 'Expired PO cover' | 'Rate' | 'FX' | 'Scope added';
  amount: number; // signed vs budget
  explanation: string;
  provenance: 'synthetic' | 'illustrative';
};

/** The group a close procedure belongs to in Tasama's own calendar: departmental inputs (1–5) first, then Finance (6–24); 'added' marks the lines Cognirise added to Tasama's list (the VAT return). */
export type CloseGroup = 'inputs' | 'finance' | 'added';

/** How Mizan relates to a procedure: it derives the status from the data, it records a department's input, it is an ERP job Mizan only reads back, or it is outside Mizan entirely. */
export type CloseCoverage = 'derived' | 'input' | 'erp-job' | 'outside';

/** One of Tasama's 24 monthly closing procedures, as supplied by Tasama (number, area, action, responsible, deadline, automation), plus line 25 added by Cognirise. */
export type CloseItem = {
  id: string; // P01 … P25
  number: number; // 1..24 — Tasama's own numbering; 25 added
  group: CloseGroup;
  workstream: string; // Tasama's "Area / Department" column
  title: string; // the procedure, in Tasama's words, shortened
  owner: string; // persona id, or a department key (hr, requesters, operations, dt)
  agentId: string | null;
  /** Tasama's deadline, in their words. */
  deadline: string;
  dueDay: number; // business day of the close the deadline falls on, 0 = before month end
  /** Tasama's own "Automation" column: what their ERP does today. 'Not in list' for lines Cognirise added. */
  tasamaAutomation: 'Full' | 'Partial' | 'No' | 'Check with Department' | 'Not in list';
  coverage: CloseCoverage;
  status: 'done' | 'in_progress' | 'blocked' | 'not_started' | 'external';
  blocker?: string;
  evidence?: string;
  /** Derived items re-evaluate their status from the world; authored items keep theirs. */
  derivedFrom?: 'inputs' | 'payroll' | 'billing' | 'ar_tie' | 'bank' | 'cash_applied' | 'vendor_coc' | 'vendor_ap' | 'erp_ap' | 'erp_ar' | 'delivery_ops' | 'delivery_dt' | 'journal_vendor' | 'journal_manual' | 'journal_unbilled' | 'journal_deferred' | 'erp_job' | 'budget' | 'period_close' | 'reports' | 'vat';
};

/* ----------------------------------------------------------- payroll */

/** How the payroll register's employer cost was spent, by cost centre and client, from timesheets (HR / PPM). Aggregates only: no employee enters Mizan. */
export type PayrollAllocation = {
  costCentre: string; // CC-504, CC-SES, CC-GA …
  businessLine: BusinessLine | 'G&A';
  clientId: string | null; // null = overhead, not allocated to an engagement
  fte: number;
  cost: number; // employer cost allocated, SAR
  note?: string;
};

/** One month's payroll as Finance receives it from the HR payroll system: the register totals, the checks, the allocation. */
export type PayrollRun = {
  id: string; // PR-2026-09
  period: string; // YYYY-MM
  source: string; // the HR payroll system the register comes from
  paidOn: string; // the WPS pay-out date
  dueOn: string; // Tasama's deadline: 3 WD after pay-out
  receivedOn?: string; // when the register reached Finance
  wpsBatchRef: string;
  headcount: number; joiners: number; leavers: number;
  basic: number; allowances: number; overtime: number; grossPay: number;
  gosiEmployee: number; gosiEmployer: number; otherDeductions: number;
  finalSettlements: number; // included in gross — leavers' end-of-service settlements paid this month
  netPay: number; // what the WPS file paid: gross − employee GOSI − deductions
  eosbProvision: number; leaveProvision: number; bonusAccrual: number;
  employerCost: number; // gross + employer GOSI + provisions
  gosiDueOn: string; // GOSI payable date (15th of the following month)
  allocations: PayrollAllocation[];
  status: 'awaited' | 'received' | 'proved' | 'posted';
  /** Rawatib's three checks, written when the register is received. */
  proof?: { bankLineId: string | null; bankTies: boolean; headcountTies: boolean; glTies: boolean; note: string };
  journalIds: string[]; // the payroll journal and the provisions journal
};

/* --------------------------------------------------------------- VAT */

/** The monthly VAT return (KSA, 15%): output VAT from cleared tax invoices, input VAT from posted vendor invoices, filed on the ZATCA portal by the end of the following month. */
export type VatReturn = {
  id: string; // VAT-2026-09
  period: string;
  filingDueOn: string;
  status: 'open' | 'prepared' | 'approved' | 'filed';
  preparedOn?: string; approvedOn?: string; filedOn?: string;
  /** Frozen when prepared; before that the screens derive the live figures. */
  figures?: VatFigures;
  journalId?: string;
};

export type VatFigures = {
  standardRatedSales: number; outputVat: number; salesCount: number;
  zeroRatedSales: number;
  standardRatedPurchases: number; inputVat: number; purchaseCount: number;
  /** Input VAT on vendor invoices not yet approved — not claimable this period. */
  deferredInputVat: number; deferredNote: string;
  adjustments: number; adjustmentNote: string;
  netPayable: number;
  excluded: { ref: string; reason: string; vat: number }[];
  /** The invoices behind the boxes, so a screen can say which record is in the return and which came later. */
  salesRefs: string[]; purchaseRefs: string[];
};

/* ---------------------------------------------------------- ERP jobs */

/** An ERP accounting job Mizan does not run but reads back — Fixed Assets, Leases, Create Accounting. */
export type ErpJob = {
  id: string;
  procedure: number; // the close procedure it evidences
  module: 'Fixed Assets' | 'Leases' | 'Cash Management' | 'Payables' | 'Receivables';
  name: string;
  period: string;
  status: 'not_run' | 'scheduled' | 'completed' | 'errors';
  scheduledFor?: string; ranAt?: string;
  summary?: string;
  errors: number;
  /** For sub-ledger jobs: whether the sub-ledger ties to the GL after the run. */
  ties?: boolean;
};

/* ------------------------------------------------- department inputs */

/** What the departments owe the close (procedures 2–5) and where each input stands; Iqfal chases the late ones. */
export type DepartmentInput = {
  id: string;
  procedure: number;
  department: 'hr' | 'requesters' | 'operations' | 'dt';
  what: string;
  via: string; // the system or channel the input arrives through
  dueOn: string;
  receivedOn?: string;
  reminders: string[]; // dates Iqfal reminded the department
  note?: string;
};

export type Journal = {
  id: string;
  kind: 'Unbilled revenue accrual' | 'Deferred revenue release' | 'Vendor accrual' | 'Bank charges' | 'FX difference' | 'Rate correction (debit note)' | 'Payroll' | 'Payroll provisions' | 'VAT settlement';
  description: string;
  lines: { account: string; dr: number; cr: number }[];
  proposedBy: string; // agent id
  status: 'proposed' | 'approved' | 'posted';
  period: string;
  erpRef?: string;
};

export type TrailKind = 'observed' | 'proposed' | 'acted' | 'approved' | 'rejected' | 'overridden' | 'escalated';
export type Autonomy = 'observe' | 'recommend' | 'assisted' | 'supervised' | 'autonomous';

export type TrailEntry = {
  id: string;
  at: string; // ISO
  actor: { kind: 'agent'; id: string } | { kind: 'person'; id: string };
  kind: TrailKind;
  autonomy?: Autonomy;
  summary: string;
  detail?: string;
  recordRef?: string;
  override?: { from: string; to: string; reason: string };
};

export type Finding = {
  id: string;
  agentId: 'hares';
  kind: 'Missed billing' | 'Blocked billing' | 'Under-rate' | 'PO over-consumed' | 'Expired PO cover' | 'Unreasoned credit note' | 'Clearance rejected';
  clientId: string;
  amount: number;
  summary: string;
  detail: string;
  recordRef: string;
  acknowledged: boolean;
  resolvedBy?: string;
};

export type DunningStage = 'none' | 'reminder' | 'second' | 'formal' | 'escalated';

export type DunningItem = {
  id: string;
  invoiceId: string;
  clientId: string;
  stage: DunningStage;
  proposedStage: DunningStage;
  draft: string;
  status: 'proposed' | 'sent' | 'held';
  promiseToPay?: string;
  dispute?: string;
};

export type ParseJobStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type DeclaredType = 'invoice' | 'receipt' | 'bank_statement' | 'credit_card_statement' | 'auto';

/** Mirrors the CogniDocs ParseJob envelope (api guide §3). */
export type ParseJob = {
  id: string;
  declaredType: DeclaredType;
  detectedType: string | null;
  status: ParseJobStatus;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  startedAt: string | null;
  parserPath: string | null;
  confidence: number | null;
  error: string | null;
  aiPromptTokens: number | null;
  aiCompletionTokens: number | null;
  aiCostAmount10k: number | null;
  sandbox: boolean;
  result: CogniDocsResult | null;
  createdAt: string;
  completedAt: string | null;
  /** Mizan-side: where the completed result was routed. */
  mode: 'simulated' | 'live';
  routedTo?: string;
};

export type CogniDocsInvoice = {
  id: string;
  vendorKey: string;
  vendorName: string;
  invoiceRef: string;
  normalizedInvoiceRef: string;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  subtotalAmount10k: number;
  taxAmount10k: number;
  totalAmount10k: number;
  categoryKey: string | null;
  detailTier: 'itemized' | 'hybrid' | 'summary';
  fieldConfidence: Record<string, number>;
  fieldsMissing: string[];
  reconciliation: { lineItemSum10k: number; matchesTotal: boolean; delta10k: number } | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  associatedInvoiceRefs: string[];
  bankingDetails: { bankName: string | null; accountName: string | null; accountNumber: string | null; iban: string | null; swiftBic: string | null } | null;
  lineItems: {
    id: string; lineNumber: number; section: string | null; description: string;
    quantity10k: number; unitPriceAmount10k: number; amount10k: number; taxAmount10k: number;
    periodStart: string | null; periodEnd: string | null;
  }[];
};

export type CogniDocsTransaction = {
  id: string;
  date: string;
  description: string;
  rawDescription: string;
  amount10k: number;
  currency: string;
  direction: 'debit' | 'credit';
  type: string;
  balance10k: number | null;
  page: number | null;
  category: string;
  effectiveCategory: string;
  normalizedMerchant: string | null;
  matchConfidence: number | null;
  notes: string[];
};

export type CogniDocsStatement = {
  bankId: number | null;
  bankName: string;
  statementType: 'bank_statement' | 'credit_card_statement' | 'unknown';
  currency: string;
  accountRef: string | null;
  periodStart: string;
  periodEnd: string;
  templateId: string | null;
  templateGenerated: boolean;
  transactions: CogniDocsTransaction[];
};

export type CogniDocsResult = {
  documentType: 'invoice' | 'receipt' | 'bank_statement' | 'credit_card_statement';
  parserPath: string;
  confidence: number;
  statement: CogniDocsStatement | null;
  invoice: CogniDocsInvoice | null;
};

export type ErpSystem = 'oracle' | 'odoo';

export type Settings = {
  erp: ErpSystem;
  /** The API key itself never lives in the world: server environment, or this browser only in standalone mode. */
  cognidocs: { mode: 'simulated' | 'live'; baseUrl: string; sandbox: boolean };
  cashTolerance: number;
  autoDunningLimit: number;
  poConsumptionAlertPct: number;
  cocReminderDays: number[];
};

/** An opportunity as read from Salesforce (simulated) — Stage 1, Lead-to-Contract. Read-only for Mizan. */
export type Opportunity = {
  id: string;
  clientId: string;
  name: string;
  businessLine: BusinessLine;
  stage: 'Qualified' | 'Discovery' | 'Proposal submitted' | 'Negotiation' | 'Verbal award' | 'Closed won' | 'Closed lost';
  /** Monthly recurring amount, or a one-off amount, in SAR. */
  amount: number;
  recurring: boolean;
  probability: number; // 0–1
  expectedStart: string; // YYYY-MM-DD
  termMonths: number;
  owner: string;
  note: string;
};

export type World = {
  /** Versioned orchestration workspace; optional for old persisted demo worlds. */
  asOf: string; // ISO date of the demo
  closingPeriod: string; // YYYY-MM
  closeDay: number; // business day of the close
  clients: Client[];
  contracts: Contract[];
  pos: ClientPO[];
  events: BillingEvent[];
  invoices: Invoice[];
  bankAccounts: BankAccount[];
  bankLines: BankLine[];
  ledger: LedgerEntry[];
  receipts: CashReceipt[];
  vendorPOs: VendorPO[];
  vendorInvoices: VendorInvoice[];
  budget: BudgetRow[];
  drivers: VarianceDriver[];
  closeItems: CloseItem[];
  journals: Journal[];
  /** Payroll as Finance receives it: the prior month posted, the closing month awaited until HR sends the register. */
  payrollRuns: PayrollRun[];
  vatReturns: VatReturn[];
  erpJobs: ErpJob[];
  inputs: DepartmentInput[];
  findings: Finding[];
  dunning: DunningItem[];
  jobs: ParseJob[];
  trail: TrailEntry[];
  /** Rebillable expenses read from receipts (CogniDocs) awaiting re-billing. */
  expenses: { id: string; clientId: string; description: string; amount: number; date: string; status: 'queued' | 'billed'; jobId?: string }[];
  /** Flags the close keeps that are not derivable. */
  flags: { reforecastAccepted: boolean; periodClosed: boolean; seq: number; erpSeq: number; rev: number };
  /** Opportunities read from Salesforce (simulated). The weighted pipeline is derived from them. */
  opportunities: Opportunity[];
  /** Weighted pipeline by business line and month — derived from the opportunities; feeds the forecast only. */
  pipeline: { businessLine: BusinessLine; month: number; weighted: number; label: string }[];
  settings: Settings;
};
