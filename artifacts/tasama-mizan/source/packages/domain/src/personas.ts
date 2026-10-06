/**
 * Personas. Switching one changes the inbox, the approvable set, the amounts
 * and the menu. Names are demo placeholders unless supplied by the user;
 * roles follow Tasama's organisation
 * (Chief Finance → Accounting, Revenue & Treasury, Reporting & Budgeting;
 * Chief Commercial → Key Account Management; Chief Operations → Service
 * Delivery). Amount limits are placeholders until Tasama's DoA is supplied.
 */
export type Section = 'overview' | 'inbox' | 'l2c' | 'documents' | 'close' | 'agents' | 'settings';

export type PersonaDef = {
  id: string;
  name: string;
  role: string;
  initials: string;
  remit: string;
  authority: string;
  restrictions: string;
  limit: number | null;
  nav: Section[];
  /** Client ids this persona is restricted to; empty = all. */
  clients: string[];
};

export const PERSONAS: PersonaDef[] = [
  { id: 'noura', name: 'Saed Hussein', role: 'Chief Financial Officer', initials: 'SH', remit: 'Owns the close, the forecast and the numbers that go to the board.', authority: 'Close sign-off; write-offs; credit notes above SAR 250,000; reforecast; anything below.', restrictions: 'None.', limit: null, nav: ['overview', 'inbox', 'l2c', 'documents', 'close', 'agents', 'settings'], clients: [] },
  { id: 'faisal', name: 'Faisal Al-Dossary', role: 'Head of Revenue & Treasury', initials: 'FD', remit: 'Billing, collections, cash and bank — from the signed PO to the applied receipt.', authority: 'Invoice release (any amount); dunning to PIF and Government accounts; cash-application overrides; billing-schedule confirmation.', restrictions: 'Cannot post journals or sign the close.', limit: 5_000_000, nav: ['overview', 'inbox', 'l2c', 'documents', 'close', 'agents', 'settings'], clients: [] },
  { id: 'reem', name: 'Reem Al-Qahtani', role: 'Accounting Manager', initials: 'RQ', remit: 'The ledger: journals, vendor matches, bank reconciliations, the close checklist.', authority: 'Journals (accruals, deferrals, adjustments); vendor invoice matches; bank reconciliation sign-off; close items.', restrictions: 'Does not release client invoices or approve dunning.', limit: 1_000_000, nav: ['inbox', 'documents', 'close', 'agents', 'settings'], clients: [] },
  { id: 'omar', name: 'Omar Siddiqui', role: 'Accountant', initials: 'OS', remit: 'Prepares: uploads statements and vendor invoices, reviews matches, runs reconciliations.', authority: 'Approves nothing above SAR 50,000; applies cash the agent proposed up to that amount.', restrictions: 'No journal approval, no invoice release, no sign-off.', limit: 50_000, nav: ['inbox', 'documents', 'close', 'settings'], clients: [] },
  { id: 'majed', name: 'Majed Al-Otaibi', role: 'Key Account Manager — PIF accounts', initials: 'MO', remit: 'The commercial relationship with KSIA, GPLC and REDC after the deal.', authority: 'CoC requests and escalations to his clients; dunning tone and timing; disputes.', restrictions: 'Sees his accounts only; no ledger, no close.', limit: null, nav: ['inbox', 'l2c', 'settings'], clients: ['ksia', 'gplc', 'redc'] },
  { id: 'sarah', name: 'Sarah Al-Amri', role: 'Key Account Manager — Government & International', initials: 'SA', remit: 'Social Development Bank and the Soft Landing clients.', authority: 'CoC requests and escalations to her clients; dunning tone and timing; disputes.', restrictions: 'Sees her accounts only; no ledger, no close.', limit: null, nav: ['inbox', 'l2c', 'settings'], clients: ['sdb', 'nordwind'] },
  { id: 'dina', name: 'Dina Haddad', role: 'Service Delivery Lead', initials: 'DH', remit: 'Confirms what was delivered: days, milestones, service months.', authority: 'Delivery evidence and milestone acceptance.', restrictions: 'No commercial figures beyond her lines; no approvals of money.', limit: null, nav: ['inbox', 'l2c', 'settings'], clients: ['ksia', 'redc', 'sdb'] },
];

export const personaById = (id: string) => PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
