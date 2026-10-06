/** Close orchestration records. No payroll PII, file bytes or ERP credentials. */
export type CloseField = { key: string; label: string; type: 'text' | 'textarea' | 'number' | 'date' | 'select'; required?: boolean; options?: string[] };
export type CloseProcedure = {
  number: number; title: string; description: string; department: string; owner: string; reviewer: string;
  automation: 'Full' | 'Partial' | 'No' | 'Check with Department';
  coverage: 'Strong demo' | 'Partial / adjacent' | 'External workpaper';
  deadline: '25th' | 'payroll+3' | 'month-end+2' | 'inputs+2';
  prerequisites: number[]; fields: CloseField[]; native?: 'bank' | 'billing' | 'collections' | 'journals' | 'budget' | 'inbox';
};
export type PaperState = 'draft' | 'submitted' | 'returned' | 'accepted';
export type AccountingState = 'Not run' | 'Running' | 'Error' | 'Accounted' | 'Transferred' | 'GL posted';
export type SupplierReceipt = { id: string; vendor: string; poRef: string; cocRef: string; receivedDate: string; amount: number; currency: 'SAR' | 'USD'; invoiceRef: string; description: string };
export type StatementLine = { id: string; account: string; kind: 'P&L' | 'Balance Sheet' | 'Trial balance'; actual: number; prior: number; budget: number; debit: number; credit: number; commentary: string; correctionRef: string };
export type ClosePaper = {
  procedure: number; owner: string; reviewer: string; version: number; state: PaperState;
  values: Record<string, string>; receipts: SupplierReceipt[]; statements: StatementLine[];
  preparedBy?: string; submittedAt?: string; reviewedBy?: string; acceptedAt?: string; reviewNote?: string;
  reviewedFingerprint?: string; updatedAt?: string;
  history: { at: string; actor: string; event: string; version: number; detail: string }[];
};
export type CloseException = {
  id: string; procedure: number; title: string; amount: number; currency: 'SAR' | 'USD'; severity: 'minor' | 'material' | 'critical';
  owner: string; source: 'manual' | 'native'; nonWaivable: boolean;
  status: 'open' | 'resolved' | 'waived'; reason?: string; decidedBy?: string; decidedAt?: string;
};
export type ClosePack = { generatedAt: string; generatedBy: string; fingerprint: string; content: string };
export type CloseInstance = {
  period: string; version: number; calendar: { confirmed: boolean; weekends: number[]; holidays: string[] };
  materiality: number; papers: Record<string, ClosePaper>; exceptions: CloseException[];
  reminders: { key: string; procedure: number; at: string; actor: string; note: string }[];
  status: 'open' | 'closed'; erpStatus: 'Not requested' | 'Closure requested' | 'Externally confirmed';
  erpReference?: string; erpEvidence?: string; pack?: ClosePack;
  closedAt?: string; closedBy?: string; lockedSnapshot?: string;
  snapshots?: { closedAt: string; closedBy: string; fingerprint: string; content: string }[];
  history: { at: string; actor: string; event: string; reason: string }[];
};
export type CloseWorkspace = { version: 1; periods: Record<string, CloseInstance> };
export type CloseCommand =
  | { kind: 'initialize'; period: string }
  | { kind: 'calendar'; period: string; expectedVersion: number; weekends: number[]; holidays: string[]; confirmed: boolean; materiality: number }
  | { kind: 'save'; period: string; procedure: number; expectedVersion: number; values: Record<string, string>; receipts: SupplierReceipt[]; statements: StatementLine[] }
  | { kind: 'submit'; period: string; procedure: number; expectedVersion: number }
  | { kind: 'review'; period: string; procedure: number; expectedVersion: number; decision: 'accept' | 'return'; reason: string }
  | { kind: 'delegate'; period: string; procedure: number; expectedVersion: number; owner: string; reviewer: string; reason: string }
  | { kind: 'remind'; period: string; procedure: number; expectedVersion: number; note: string }
  | { kind: 'exception'; period: string; expectedVersion: number; procedure: number; title: string; amount: number; currency: 'SAR' | 'USD'; severity: 'minor' | 'material' | 'critical' }
  | { kind: 'decideException'; period: string; expectedVersion: number; id: string; decision: 'resolve' | 'waive'; reason: string }
  | { kind: 'pack'; period: string; expectedVersion: number }
  | { kind: 'close' | 'requestErpClosure'; period: string; expectedVersion: number }
  | { kind: 'confirmErpClosure'; period: string; expectedVersion: number; reference: string; evidence: string }
  | { kind: 'reopen'; period: string; expectedVersion: number; reason: string };
export type ProcedureView = CloseProcedure & {
  paper: ClosePaper; due: string | null; overdue: boolean; status: 'Done' | 'Action needed' | 'Waiting for others';
  blockers: string[]; evidence: string[]; errors: string[];
};
