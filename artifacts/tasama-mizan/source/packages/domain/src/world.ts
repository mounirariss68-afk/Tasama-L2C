/**
 * The synthetic world — authored inputs, generated deterministically.
 *
 * SEED = 20261006 (the demo date). A reset reproduces exactly this world.
 *
 * Fifteen edge cases are AUTHORED here on purpose (see design §8) — each one
 * is a scenario or an inbox item, never a coincidence of the random draw.
 * Everything else about status is derived in lib/derive.ts.
 *
 * Client names are real PIF-portfolio companies that appear in Tasama's own
 * PO ledger. Every contract, figure, person and event is fictional, and every
 * identifier carries the DEMO- prefix.
 */
import type {
  BankAccount, BankLine, BillingEvent, BudgetRow, Client, ClientPO, CloseItem, Contract, DunningItem,
  Evidence, Finding, Invoice, Journal, LedgerEntry, CashReceipt, Opportunity, POLine, Settings, TrailEntry, VarianceDriver,
  VendorInvoice, VendorPO, World, BusinessLine, Currency, DepartmentInput, ErpJob, PayrollRun, VatReturn,
} from './types';

export const SEED = 20261006;
export const AS_OF = '2026-10-06';
export const CLOSING_PERIOD = '2026-09';
export const CLOSE_DAY = 4;
export const VAT_RATE = 0.15;
export const USD_SAR = 3.75;

/* ------------------------------------------------------------------ utils */

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];

export const ym = (m: number) => `2026-${String(m).padStart(2, '0')}`;
export const monthEnd = (m: number) => `2026-${String(m).padStart(2, '0')}-${String(new Date(Date.UTC(2026, m, 0)).getUTCDate()).padStart(2, '0')}`;
const d = (m: number, day: number) => `2026-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
export function addDays(iso: string, n: number) {
  const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
export const monthOf = (iso: string) => Number(iso.slice(5, 7));
const r2 = (n: number) => Math.round(n * 100) / 100;
export const vatOf = (net: number) => r2(net * VAT_RATE);
let seq = 0;
const nid = (p: string) => `${p}-${String(++seq).padStart(4, '0')}`;

/* ---------------------------------------------------------------- clients */

const PERSON = {
  kamMajed: 'Majed Al-Otaibi', kamNayef: 'Nayef Al-Shammari', kamSarah: 'Sarah Al-Amri',
  dlDina: 'Dina Haddad', dlKareem: 'Kareem Mansour', dlCharles: 'Charles Okafor',
};

export const CLIENTS: Client[] = [
  { id: 'ksia', code: '351', name: 'King Salman International Airport Development Company', short: 'KSIA', segment: 'PIF', pif: true, kam: PERSON.kamMajed, deliveryLead: PERSON.dlDina, vatNo: '300351000000003', paymentTermsDays: 60, currency: 'SAR', channel: 'bank transfer' },
  { id: 'gplc', code: '379', name: 'Global Ports & Logistics Company', short: 'GPLC', segment: 'PIF', pif: true, kam: PERSON.kamMajed, deliveryLead: PERSON.dlKareem, vatNo: '300379000000003', paymentTermsDays: 45, currency: 'SAR', channel: 'bank transfer' },
  { id: 'salwan', code: '362', name: 'Salwan Tourism Real Estate Development Company', short: 'Salwan', segment: 'PIF', pif: true, kam: PERSON.kamNayef, deliveryLead: PERSON.dlKareem, vatNo: '300362000000003', paymentTermsDays: 30, currency: 'SAR', channel: 'bank transfer' },
  { id: 'jada', code: '322', name: 'Jada Fund of Funds Company', short: 'Jada', segment: 'PIF', pif: true, kam: PERSON.kamNayef, deliveryLead: PERSON.dlCharles, vatNo: '300322000000003', paymentTermsDays: 30, currency: 'SAR', channel: 'bank transfer' },
  { id: 'redc', code: '373', name: 'Riyadh Expo Development Company', short: 'REDC', segment: 'PIF', pif: true, kam: PERSON.kamMajed, deliveryLead: PERSON.dlDina, vatNo: '300373000000003', paymentTermsDays: 45, currency: 'SAR', channel: 'bank transfer' },
  { id: 'faic', code: '372', name: 'Future Artificial Intelligence Company', short: 'FAIC', segment: 'PIF', pif: true, kam: PERSON.kamNayef, deliveryLead: PERSON.dlCharles, vatNo: '300372000000003', paymentTermsDays: 30, currency: 'SAR', channel: 'bank transfer' },
  { id: 'rlc', code: '369', name: 'Riyadh Lake Company', short: 'RLC', segment: 'PIF', pif: true, kam: PERSON.kamNayef, deliveryLead: PERSON.dlCharles, vatNo: '300369000000003', paymentTermsDays: 30, currency: 'SAR', channel: 'bank transfer' },
  { id: 'sdb', code: '410', name: 'Social Development Bank', short: 'SDB', segment: 'Government', pif: false, kam: PERSON.kamSarah, deliveryLead: PERSON.dlDina, vatNo: '300410000000003', paymentTermsDays: 45, currency: 'SAR', channel: 'Etimad' },
  { id: 'nordwind', code: '455', name: 'Nordwind Robotics GmbH — Riyadh RHQ', short: 'Nordwind', segment: 'International', pif: false, kam: PERSON.kamSarah, deliveryLead: PERSON.dlKareem, vatNo: null, paymentTermsDays: 30, currency: 'USD', channel: 'international wire' },
];

const CONTRACTS: Contract[] = [
  { id: 'DEMO-KSIA-MSA-2025-001', clientId: 'ksia', type: 'MSA', status: 'active', start: '2025-03-01', end: '2028-02-28', totalValue: null, paymentTermsDays: 60, cocRequired: true, rateCardVersion: 'RC-2026-01', source: 'Sirion' },
  { id: 'DEMO-GPLC-2025-002', clientId: 'gplc', type: 'MSA', status: 'active', start: '2025-05-15', end: '2028-05-14', totalValue: null, paymentTermsDays: 45, cocRequired: true, rateCardVersion: 'RC-2026-01', source: 'Sirion' },
  { id: 'DEMO-SALWAN-SA-2026-003', clientId: 'salwan', type: 'Service Agreement', status: 'active', start: '2026-02-01', end: '2027-01-31', totalValue: 1_200_000, paymentTermsDays: 30, cocRequired: false, rateCardVersion: 'RC-2026-01', source: 'Sirion' },
  { id: 'DEMO-JADA-MSA-2025-004', clientId: 'jada', type: 'MSA', status: 'active', start: '2025-12-01', end: '2027-11-30', totalValue: null, paymentTermsDays: 30, cocRequired: false, rateCardVersion: 'RC-2026-01', source: 'Sirion' },
  { id: 'DEMO-REDC-SA-2025-005', clientId: 'redc', type: 'Service Agreement', status: 'expired', start: '2025-10-01', end: '2026-08-31', totalValue: 1_760_000, paymentTermsDays: 45, cocRequired: false, rateCardVersion: 'RC-2025-02', source: 'Sirion' },
  { id: 'DEMO-FAIC-MSA-2026-006', clientId: 'faic', type: 'MSA', status: 'active', start: '2026-04-01', end: '2029-03-31', totalValue: null, paymentTermsDays: 30, cocRequired: false, rateCardVersion: 'RC-2026-01', source: 'Sirion' },
  { id: 'DEMO-RLC-SA-2026-007', clientId: 'rlc', type: 'Service Agreement', status: 'active', start: '2026-05-01', end: '2027-04-30', totalValue: 1_018_000, paymentTermsDays: 30, cocRequired: false, rateCardVersion: 'RC-2026-01', source: 'Sirion' },
  { id: 'DEMO-SDB-ETIMAD-2026-008', clientId: 'sdb', type: 'Service Agreement', status: 'active', start: '2026-01-20', end: '2026-12-31', totalValue: 1_850_000, paymentTermsDays: 45, cocRequired: true, rateCardVersion: 'RC-2026-01', source: 'Sirion' },
  { id: 'DEMO-NWR-SA-2026-009', clientId: 'nordwind', type: 'Service Agreement', status: 'active', start: '2026-06-01', end: '2027-05-31', totalValue: 162_000, paymentTermsDays: 30, cocRequired: false, rateCardVersion: 'RC-2026-01', source: 'Sirion' },
];

/* ---------------------------------------------------------- PO + lines */

type LineSpec = Omit<POLine, 'id' | 'poId' | 'matchFlags'> & { matchFlags?: string[] };
function po(spec: Omit<ClientPO, 'lines' | 'scheduleConfirmed'> & { scheduleConfirmed?: boolean }, lines: LineSpec[]): ClientPO {
  return {
    ...spec,
    scheduleConfirmed: spec.scheduleConfirmed ?? true,
    lines: lines.map((l, i) => ({ ...l, id: `${spec.id}-L${i + 1}`, poId: spec.id, matchFlags: l.matchFlags ?? [] })),
  };
}

export const POS: ClientPO[] = [
  po({ id: 'DEMO-KSIA-PO-00000524', clientId: 'ksia', contractId: 'DEMO-KSIA-MSA-2025-001', proposalId: 'DEMO-T39948_1225', date: '2026-01-10', start: '2026-01-01', end: '2026-12-31', value: 3_361_755, currency: 'SAR', status: 'open' }, [
    { activity: 'Oracle Fusion application managed services', businessLine: '504', serviceTag: 'AMS', pricingModel: 'monthly_fixed', unit: 'month', rate: 95_000, qty: 12, start: '2026-01-01', end: '2026-12-31', vendorPOId: '3443' },
    { activity: 'Functional specialist (Finance, HCM) — onshore', businessLine: '504', serviceTag: 'TechF', pricingModel: 'monthly_variable_days', unit: 'day', rate: 4_312, qty: 240, start: '2026-01-01', end: '2026-12-31' },
    { activity: 'Oracle Multi-Tenancy bundle — 25 users (licence pass-through)', businessLine: '502', serviceTag: 'Licences', pricingModel: 'pass_through', unit: 'year', rate: 162_500, qty: 1, markupPct: 15, start: '2026-02-01', end: '2027-01-31', vendorPOId: '3443' },
  ]),
  po({ id: 'DEMO-KSIA-PO-00000611', clientId: 'ksia', contractId: 'DEMO-KSIA-MSA-2025-001', proposalId: 'DEMO-T39984_0226', date: '2026-03-02', start: '2026-03-02', end: '2026-12-31', value: 2_447_200, currency: 'SAR', status: 'open' }, [
    { activity: 'PMIS implementation — Phase D2 (fixed fee, milestones)', businessLine: '504', serviceTag: 'PMIS', pricingModel: 'milestone', unit: 'fee', rate: 2_447_200, qty: 1, start: '2026-03-02', end: '2026-12-31', vendorPOId: '3051',
      milestones: [
        { id: 'D2.11', name: 'Design sign-off', pct: 20, planned: '2026-04-30' },
        { id: 'D2.12', name: 'Build complete', pct: 25, planned: '2026-06-30' },
        { id: 'D2.13', name: 'UAT complete', pct: 25, planned: '2026-08-31' },
        { id: 'D2.14', name: 'Deployment', pct: 20, planned: '2026-11-15' },
        { id: 'D2.15', name: 'Hypercare exit', pct: 10, planned: '2026-12-20' },
      ] },
  ]),
  po({ id: 'DEMO-GPLC-PO-011', clientId: 'gplc', contractId: 'DEMO-GPLC-2025-002', proposalId: 'DEMO-T39999_1225', date: '2026-01-05', start: '2026-01-01', end: '2026-12-31', value: 2_031_000, currency: 'SAR', status: 'open' }, [
    { activity: 'F&A managed services bundle underpinned by ERP', businessLine: 'SES-FIN', serviceTag: 'Finance MS', pricingModel: 'monthly_fixed', unit: 'month', rate: 39_969, qty: 12, start: '2026-01-01', end: '2026-12-31' },
    { activity: 'HR shared services bundle (≤ 30 employees)', businessLine: 'SES-HR', serviceTag: 'HR MS', pricingModel: 'monthly_fixed', unit: 'month', rate: 33_482, qty: 12, start: '2026-01-01', end: '2026-12-31' },
    { activity: 'Procurement bundle — 20 PRs/POs included, SAR 182.75 per additional', businessLine: 'SES-PROC', serviceTag: 'Procurement MS', pricingModel: 'monthly_variable_volume', unit: 'month', rate: 39_649, qty: 12, includedVolume: 20, unitPrice: 182.75, start: '2026-01-01', end: '2026-12-31' },
    { activity: 'General operation & support services (AMS)', businessLine: '504', serviceTag: 'AMS', pricingModel: 'monthly_fixed', unit: 'month', rate: 52_500, qty: 12, start: '2026-01-01', end: '2026-12-31' },
  ]),
  po({ id: 'DEMO-SALWAN-PO-202600118', clientId: 'salwan', contractId: 'DEMO-SALWAN-SA-2026-003', proposalId: 'DEMO-T40012_0126', date: '2026-02-01', start: '2026-02-01', end: '2027-01-31', value: 1_200_000, currency: 'SAR', status: 'open' }, [
    { activity: 'HCM Time & Labour implementation (fixed fee)', businessLine: '504', serviceTag: 'ERP', pricingModel: 'milestone', unit: 'fee', rate: 480_000, qty: 1, start: '2026-02-01', end: '2026-11-30', vendorPOId: '3413',
      milestones: [
        { id: 'M1', name: 'Configuration complete', pct: 40, planned: '2026-04-15' },
        { id: 'M2', name: 'Go-live', pct: 60, planned: '2026-10-31' },
      ] },
    { activity: 'HCM functional support — onshore specialist', businessLine: '504', serviceTag: 'TechF', pricingModel: 'monthly_variable_days', unit: 'day', rate: 4_312, qty: 160, start: '2026-02-01', end: '2027-01-31',
      matchFlags: ['PO line carries the 2025 rate (SAR 4,100/day); contract rate card RC-2026-01 says SAR 4,312/day. PO issued before the rate-card update.'] },
  ]),
  po({ id: 'DEMO-JADA_PO_0449', clientId: 'jada', contractId: 'DEMO-JADA-MSA-2025-004', proposalId: 'DEMO-T39920_1125', date: '2025-12-15', start: '2026-01-01', end: '2026-12-31', value: 760_000, currency: 'SAR', status: 'open' }, [
    { activity: 'Oracle application support & management services', businessLine: '504', serviceTag: 'AMS', pricingModel: 'monthly_fixed', unit: 'month', rate: 58_583, qty: 12, start: '2026-01-01', end: '2026-12-31' },
    { activity: 'Change requests — manager consultant (T&M, same PO cap)', businessLine: '504', serviceTag: 'ERP', pricingModel: 'monthly_variable_days', unit: 'day', rate: 3_883, qty: 20, start: '2026-01-01', end: '2026-12-31' },
  ]),
  po({ id: 'DEMO-REDC-PO-0000061', clientId: 'redc', contractId: 'DEMO-REDC-SA-2025-005', proposalId: 'DEMO-T39871_0925', date: '2025-10-01', start: '2025-10-01', end: '2026-08-31', value: 1_760_000, currency: 'SAR', status: 'expired' }, [
    { activity: 'EPMO support — programme office consultants', businessLine: '504', serviceTag: 'EPMO', pricingModel: 'monthly_variable_days', unit: 'day', rate: 5_000, qty: 352, start: '2025-10-01', end: '2026-08-31' },
  ]),
  po({ id: 'DEMO-FAIC-PO-2026-004', clientId: 'faic', contractId: 'DEMO-FAIC-MSA-2026-006', proposalId: 'DEMO-T40055_0326', date: '2026-04-01', start: '2026-04-01', end: '2027-03-31', value: 1_965_000, currency: 'SAR', status: 'open' }, [
    { activity: 'Data & AI platform subscription — 12 months, invoiced in advance', businessLine: 'EVAS', serviceTag: 'Data & AI', pricingModel: 'advance', unit: 'year', rate: 1_200_000, qty: 1, start: '2026-04-01', end: '2027-03-31' },
    { activity: 'Innovation programme management (accelerator cohort 3)', businessLine: 'EVAS', serviceTag: 'Innovation', pricingModel: 'monthly_fixed', unit: 'month', rate: 85_000, qty: 9, start: '2026-04-01', end: '2026-12-31' },
  ]),
  po({ id: 'DEMO-RLC-PO-00017', clientId: 'rlc', contractId: 'DEMO-RLC-SA-2026-007', proposalId: 'DEMO-T40071_0426', date: '2026-05-01', start: '2026-05-01', end: '2027-04-30', value: 1_018_000, currency: 'SAR', status: 'open' }, [
    { activity: 'Workplace as a Service — 48 desks, serviced', businessLine: 'BES', serviceTag: 'Workplace', pricingModel: 'monthly_fixed', unit: 'month', rate: 64_000, qty: 12, start: '2026-05-01', end: '2027-04-30' },
    { activity: 'Legal services bundle — 100 hours', businessLine: 'BES', serviceTag: 'Legal', pricingModel: 'one_off', unit: 'bundle', rate: 250_000, qty: 1, start: '2026-05-01', end: '2027-04-30' },
  ]),
  po({ id: 'DEMO-SDB-ETIMAD-2026-0931', clientId: 'sdb', contractId: 'DEMO-SDB-ETIMAD-2026-008', proposalId: 'DEMO-T39960_1225', date: '2026-01-20', start: '2026-01-20', end: '2026-12-31', value: 1_850_000, currency: 'SAR', status: 'open' }, [
    { activity: 'ServiceNow implementation & digital advisory (fixed fee)', businessLine: '506', serviceTag: 'ServiceNow', pricingModel: 'milestone', unit: 'fee', rate: 1_850_000, qty: 1, start: '2026-01-20', end: '2026-12-31', vendorPOId: '3596',
      milestones: [
        { id: 'MS1', name: 'Design & mobilisation', pct: 30, planned: '2026-03-31' },
        { id: 'MS2', name: 'Build complete', pct: 40, planned: '2026-06-30' },
        { id: 'MS3', name: 'Go-live & handover', pct: 30, planned: '2026-12-15' }, // budgeted for 31 Oct; re-planned to December after the build hand-over slipped
      ] },
  ]),
  po({ id: 'DEMO-NWR-PO-0007', clientId: 'nordwind', contractId: 'DEMO-NWR-SA-2026-009', proposalId: 'DEMO-T40090_0526', date: '2026-06-01', start: '2026-06-01', end: '2027-05-31', value: 162_000, currency: 'USD', status: 'open' }, [
    { activity: 'Soft Landing package — entity set-up, activation, concierge', businessLine: 'BES', serviceTag: 'Soft Landing', pricingModel: 'one_off', unit: 'package', rate: 48_000, qty: 1, start: '2026-06-01', end: '2026-08-31' },
    { activity: 'Finance Managed Services — starter package', businessLine: 'SES-FIN', serviceTag: 'Finance MS', pricingModel: 'monthly_fixed', unit: 'month', rate: 9_500, qty: 12, start: '2026-07-01', end: '2027-06-30' },
  ]),
];

/* --------------------------------------------- delivery facts (authored) */

/** Days delivered per T&M line per month. Authored where the story needs it, drawn otherwise. */
const DAYS: Record<string, Partial<Record<number, number>>> = {
  'DEMO-KSIA-PO-00000524-L2': { 1: 18, 2: 20, 3: 21, 4: 19, 5: 20, 6: 17, 7: 20, 8: 19, 9: 21 },
  'DEMO-SALWAN-PO-202600118-L2': { 2: 12, 3: 14, 4: 15, 5: 16, 6: 15, 7: 14, 8: 15, 9: 56 },
  'DEMO-JADA_PO_0449-L2': { 1: 4, 2: 6, 3: 5, 4: 7, 5: 8, 6: 6, 7: 5, 8: 6, 9: 5 },
  'DEMO-REDC-PO-0000061': { 1: 34, 2: 30, 3: 36, 4: 33, 5: 31, 6: 29, 7: 35, 8: 32, 9: 18 },
};
/** Extra PRs/POs above the 20 included, per month (GPLC procurement bundle). */
const VOLUMES: Partial<Record<number, number>> = { 1: 22, 2: 25, 3: 31, 4: 28, 5: 24, 6: 19, 7: 27, 8: 33, 9: 30 };
/** Milestone acceptances actually recorded in PPM (date) — absent means not yet accepted. */
const ACCEPTED: Record<string, string> = {
  'DEMO-KSIA-PO-00000611-L1/D2.11': '2026-05-06',
  'DEMO-KSIA-PO-00000611-L1/D2.12': '2026-07-02',
  'DEMO-KSIA-PO-00000611-L1/D2.13': '2026-09-24', // UAT complete in PPM; CoC requested, not signed → blocked
  'DEMO-SALWAN-PO-202600118-L1/M1': '2026-04-20',
  'DEMO-SDB-ETIMAD-2026-0931-L1/MS1': '2026-04-02',
  'DEMO-SDB-ETIMAD-2026-0931-L1/MS2': '2026-06-20',
};

/* ------------------------------------------------------ billing events */

const CLIENT = Object.fromEntries(CLIENTS.map((c) => [c.id, c]));
const CONTRACT = Object.fromEntries(CONTRACTS.map((c) => [c.id, c]));

function elapsed(iso: string) { return iso <= AS_OF; }

function buildEvents(): BillingEvent[] {
  const out: BillingEvent[] = [];
  for (const p of POS) {
    const contract = CONTRACT[p.contractId];
    for (const l of p.lines) {
      const mStart = Math.max(1, l.start.startsWith('2026') ? monthOf(l.start) : 1);
      const mEnd = l.end.startsWith('2026') ? monthOf(l.end) : 12;
      const cocBase = contract.cocRequired && ['AMS', 'PMIS', 'ServiceNow', 'ERP'].includes(l.serviceTag);
      const monthly = (m: number, amount: number, label: string, ev: Evidence[], req: Evidence['kind'][]) => {
        const due = monthEnd(m);
        const isPast = elapsed(due);
        out.push({
          id: `${l.id}/${ym(m)}`, lineId: l.id, poId: p.id, clientId: p.clientId, period: ym(m), label, dueDate: due,
          expectedAmount: r2(amount), currency: p.currency, evidenceRequired: req, evidence: isPast ? ev : [],
          coc: cocBase ? (isPast ? 'signed' : 'not_required') : 'not_required',
          noPoCover: due > p.end,
        });
      };
      switch (l.pricingModel) {
        case 'monthly_fixed':
          for (let m = mStart; m <= mEnd; m++) {
            monthly(m, l.rate, `${l.activity} — ${ym(m)}`, [{ kind: 'month_elapsed', value: 1, label: 'Service month elapsed', source: 'Mizan', date: monthEnd(m) }], ['month_elapsed']);
          }
          break;
        case 'monthly_variable_days':
          for (let m = mStart; m <= mEnd + (l.id === 'DEMO-REDC-PO-0000061-L1' ? 1 : 0); m++) {
            const days = DAYS[l.id]?.[m] ?? DAYS[l.poId]?.[m] ?? (elapsed(monthEnd(m)) ? between(12, 20) : 0);
            if (!elapsed(monthEnd(m))) { monthly(m, l.rate * 16, `${l.activity} — ${ym(m)} (forecast 16 days)`, [], ['timesheet']); continue; }
            monthly(m, l.rate * days, `${l.activity} — ${ym(m)} · ${days} days`, [{ kind: 'timesheet', value: days, label: `${days} days approved in timesheets`, source: 'Timesheets', date: addDays(monthEnd(m), 2) }], ['timesheet']);
          }
          break;
        case 'monthly_variable_volume':
          for (let m = mStart; m <= mEnd; m++) {
            const vol = VOLUMES[m] ?? 20;
            const extra = Math.max(0, vol - (l.includedVolume ?? 0));
            const amount = l.rate + extra * (l.unitPrice ?? 0);
            monthly(m, amount, `${l.activity} — ${ym(m)} · ${vol} PRs/POs (${extra} above cap)`, [{ kind: 'volume', value: vol, label: `${vol} PRs/POs processed (ServiceNow)`, source: 'ServiceNow', date: addDays(monthEnd(m), 1) }], ['volume']);
          }
          break;
        case 'milestone':
          for (const ms of l.milestones ?? []) {
            const acc = ACCEPTED[`${l.id}/${ms.id}`];
            const due = acc ?? ms.planned;
            out.push({
              id: `${l.id}/${ms.id}`, lineId: l.id, poId: p.id, clientId: p.clientId, period: due.slice(0, 7),
              label: `${ms.id} ${ms.name} — ${ms.pct}% of fee`, dueDate: due, expectedAmount: r2(l.rate * ms.pct / 100), currency: p.currency,
              evidenceRequired: ['milestone'],
              evidence: acc ? [{ kind: 'milestone', value: ms.pct, label: `${ms.name} accepted in PPM`, source: 'PPM', date: acc }] : [],
              coc: cocBase ? (acc ? 'signed' : 'to_send') : 'not_required',
            });
          }
          break;
        case 'one_off':
          out.push({ id: `${l.id}/once`, lineId: l.id, poId: p.id, clientId: p.clientId, period: l.start.slice(0, 7), label: l.activity, dueDate: l.start, expectedAmount: l.rate, currency: p.currency, evidenceRequired: ['contract_start'], evidence: [{ kind: 'contract_start', value: 1, label: 'Service started (Sirion)', source: 'Sirion', date: l.start }], coc: 'not_required' });
          break;
        case 'advance':
          out.push({ id: `${l.id}/advance`, lineId: l.id, poId: p.id, clientId: p.clientId, period: l.start.slice(0, 7), label: `${l.activity} — annual fee`, dueDate: l.start, expectedAmount: l.rate, currency: p.currency, evidenceRequired: ['contract_start'], evidence: [{ kind: 'contract_start', value: 12, label: 'Subscription started (Sirion)', source: 'Sirion', date: l.start }], coc: 'not_required' });
          break;
        case 'pass_through': {
          const amount = r2(l.rate * (1 + (l.markupPct ?? 0) / 100));
          out.push({ id: `${l.id}/passthrough`, lineId: l.id, poId: p.id, clientId: p.clientId, period: l.start.slice(0, 7), label: `${l.activity} — cost + ${l.markupPct}%`, dueDate: l.start, expectedAmount: amount, currency: p.currency, evidenceRequired: ['vendor_match'], evidence: [{ kind: 'vendor_match', value: l.rate, label: 'Vendor invoice ORC-2026-00917 matched to vendor PO 3443', source: 'Oracle Procurement', date: '2026-02-11' }], coc: 'not_required' });
          break;
        }
      }
    }
  }

  /* ---- the authored edge cases that live on events ---- */
  const E = (id: string) => { const e = out.find((x) => x.id === id); if (!e) throw new Error('no event ' + id); return e; };

  // 2. KSIA UAT milestone: evidence complete, CoC requested 12 days ago and not signed.
  const uat = E('DEMO-KSIA-PO-00000611-L1/D2.13');
  uat.coc = 'reminded'; uat.cocSentOn = '2026-09-24';
  uat.note = 'CoC request sent to the KSIA PMO director on 24 Sep with the UAT exit report; reminders on 29 Sep and 3 Oct. Invoice of SAR 611,800 is blocked until it is signed.';

  // 1. GPLC AMS August — delivered, evidenced, never invoiced (handled by not creating the invoice below).
  E('DEMO-GPLC-PO-011-L4/2026-08').note = 'August service month closed in ServiceNow, CoC signed 3 Sep; no invoice was raised. In Tasama\'s tracker this is the row that reads "To Invoice: Missed".';

  // 5. REDC — September days delivered on an expired PO.
  const redcSep = E('DEMO-REDC-PO-0000061-L1/2026-09');
  redcSep.noPoCover = true;
  redcSep.note = 'PO and service agreement ended 31 Aug. 18 consultant days were delivered in September on a verbal extension. There is no instrument to bill against.';

  return out;
}

export const EVENTS = buildEvents();

/* -------------------------------------------------------------- invoices */

const invoiceCounter: Record<string, number> = {};
function invoiceNo(date: string) {
  const k = date.slice(0, 7).replace('-', '');
  invoiceCounter[k] = (invoiceCounter[k] ?? 0) + 1;
  return `DEMO-${k}${String(invoiceCounter[k]).padStart(4, '0')}`;
}

function buildInvoices(events: BillingEvent[]): Invoice[] {
  const out: Invoice[] = [];
  const skip = new Set<string>([
    'DEMO-GPLC-PO-011-L4/2026-08', // 1. missed
    'DEMO-KSIA-PO-00000611-L1/D2.13', // 2. blocked on CoC
    'DEMO-REDC-PO-0000061-L1/2026-09', // 5. no PO cover
  ]);
  // September events are not yet invoiced except where noted — that is what the month-end billing run is for.
  const septemberAlreadyInvoiced = new Set<string>([
    'DEMO-SALWAN-PO-202600118-L2/2026-09', // 3. under-rate, invoiced early by the delivery team
    'DEMO-NWR-PO-0007-L2/2026-09', // 14. ZATCA rejected
    'DEMO-KSIA-PO-00000524-L1/2026-09', // issued 1 Oct, open
    'DEMO-GPLC-PO-011-L1/2026-09', // issued 1 Oct, open
  ]);
  const sorted = [...events].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  for (const e of sorted) {
    if (skip.has(e.id)) continue;
    if (!elapsed(e.dueDate)) continue;
    const due = e.dueDate;
    const isSep = e.period === '2026-09';
    if (isSep && !septemberAlreadyInvoiced.has(e.id)) continue;
    if (e.evidence.length === 0) continue;
    const client = CLIENT[e.clientId];
    const invDate = e.id === 'DEMO-SDB-ETIMAD-2026-0931-L1/MS2' ? '2026-06-22' : addDays(due, e.id.includes('/M') || e.id.includes('/D2') ? 2 : 1);
    let net = e.expectedAmount;
    let billedRate: number | undefined;
    if (e.id === 'DEMO-SALWAN-PO-202600118-L2/2026-09') { net = 56 * 4_100; billedRate = 4_100; }
    const vat = client.vatNo ? vatOf(net) : vatOf(net); // VAT applies to services consumed in KSA even for the RHQ
    const inv: Invoice = {
      id: invoiceNo(invDate), clientId: e.clientId, poId: e.poId, eventIds: [e.id], date: invDate,
      dueDate: addDays(invDate, client.paymentTermsDays), currency: e.currency, net: r2(net), vat, gross: r2(net + vat),
      status: 'posted', zatca: 'cleared', erpRef: '', billedRate, description: e.label,
    };
    e.invoiceId = inv.id;
    out.push(inv);
  }
  // Payment state is set in buildCash(). ZATCA rejection (14):
  const nw = out.find((i) => i.eventIds[0] === 'DEMO-NWR-PO-0007-L2/2026-09')!;
  nw.zatca = 'rejected'; nw.status = 'released';
  nw.zatcaReason = 'Buyer VAT registration number missing (BR-KSA-14): standard tax invoice to a KSA-registered buyer requires the 15-digit VAT number.';
  return out;
}

export const INVOICES = buildInvoices(EVENTS);

/* ------------------------------------------------------------- vendors */

export const VENDOR_POS: VendorPO[] = [
  { id: '3443', vendor: 'Oracle Systems Saudi Arabia', clientPOLineId: 'DEMO-KSIA-PO-00000524-L3', value: 162_500, costCategory: 'Software License', consumed: 162_500 },
  { id: '3051', vendor: 'Accenture Saudi Arabia', clientPOLineId: 'DEMO-KSIA-PO-00000611-L1', value: 1_400_000, costCategory: 'IT Consultancy', consumed: 630_000 },
  { id: '3413', vendor: 'Mastek Middle East', clientPOLineId: 'DEMO-SALWAN-PO-202600118-L1', value: 180_000, costCategory: 'IT Consultancy', consumed: 180_000 },
  { id: '3596', vendor: 'Masterworks', clientPOLineId: 'DEMO-SDB-ETIMAD-2026-0931-L1', value: 900_000, costCategory: 'IT Consultancy', consumed: 630_000 },
  { id: '3602', vendor: 'STC Solutions', clientPOLineId: 'DEMO-RLC-PO-00017-L1', value: 96_000, costCategory: 'IT Infrastructure', consumed: 40_000 },
];

function vinv(spec: Omit<VendorInvoice, 'vat' | 'total' | 'source'> & { source?: VendorInvoice['source'] }): VendorInvoice {
  const vat = vatOf(spec.net);
  return { ...spec, vat, total: r2(spec.net + vat), source: spec.source ?? 'Email' };
}

export const VENDOR_INVOICES: VendorInvoice[] = [
  vinv({ id: 'DEMO-VI-0101', vendorKey: 'oracle-ksa', vendorName: 'Oracle Systems Saudi Arabia', invoiceRef: 'ORC-2026-00917', issueDate: '2026-02-05', dueDate: '2026-03-07', currency: 'SAR', net: 162_500, vendorPOId: '3443', clientPOLineId: 'DEMO-KSIA-PO-00000524-L3', matchStatus: 'matched', lineItems: [{ description: 'Oracle Fusion Cloud ERP — Multi-Tenancy bundle, 25 hosted named users, 12 months', qty: 1, unitPrice: 162_500, amount: 162_500 }], source: 'CogniDocs' }),
  vinv({ id: 'DEMO-VI-0144', vendorKey: 'accenture-ksa', vendorName: 'Accenture Saudi Arabia', invoiceRef: 'ACN-SA-26-0412', issueDate: '2026-07-08', dueDate: '2026-08-07', currency: 'SAR', net: 350_000, vendorPOId: '3051', clientPOLineId: 'DEMO-KSIA-PO-00000611-L1', matchStatus: 'matched', lineItems: [{ description: 'PMIS Phase D2 — build sprint services, milestone D2.12', qty: 1, unitPrice: 350_000, amount: 350_000 }] }),
  vinv({ id: 'DEMO-VI-0171', vendorKey: 'mastek-me', vendorName: 'Mastek Middle East', invoiceRef: 'MME/2026/0882', issueDate: '2026-08-30', dueDate: '2026-09-29', currency: 'SAR', net: 180_000, vendorPOId: '3413', clientPOLineId: 'DEMO-SALWAN-PO-202600118-L1', matchStatus: 'matched', lineItems: [{ description: 'Offshore HCM developers — Time & Labour configuration, Feb–Aug 2026', qty: 1, unitPrice: 180_000, amount: 180_000 }] }),
  vinv({ id: 'DEMO-VI-0186', vendorKey: 'accenture-ksa', vendorName: 'Accenture Saudi Arabia', invoiceRef: 'ACN-SA-26-0533', issueDate: '2026-09-30', dueDate: '2026-10-30', currency: 'SAR', net: 280_000, matchStatus: 'no_po', matchNote: 'Invoice cites "PO 3051-A". No such vendor PO exists; 3051 has SAR 770,000 open but this invoice describes "change request CR-7 — additional integrations", which is not in its scope. Routed to Procurement.', lineItems: [{ description: 'PMIS Phase D2 — change request CR-7 additional integrations', qty: 1, unitPrice: 280_000, amount: 280_000 }], source: 'CogniDocs' }),
];

/* ------------------------------------------------- bank, ledger, cash */

export const BANK_ACCOUNTS: BankAccount[] = [
  { id: 'snb-ops', bank: 'Saudi National Bank', label: 'Operating account', iban: 'SA03 1000 0000 1234 5678 9012', currency: 'SAR', openingLedger: 4_250_000, openingStatement: 4_250_000, reconciledThrough: '2026-08-31', signedOff: false },
  { id: 'rajhi-coll', bank: 'Al Rajhi Bank', label: 'Collections account', iban: 'SA44 8000 0000 6080 1016 7519', currency: 'SAR', openingLedger: 1_100_000, openingStatement: 1_100_000, reconciledThrough: '2026-08-31', signedOff: false },
  { id: 'sab-usd', bank: 'Saudi Awwal Bank', label: 'USD account', iban: 'SA71 4500 0000 0120 4411 0098', currency: 'USD', openingLedger: 120_000, openingStatement: 120_000, reconciledThrough: '2026-08-31', signedOff: false },
];

type CashBuild = { bankLines: BankLine[]; ledger: LedgerEntry[]; receipts: CashReceipt[] };

function buildCash(invoices: Invoice[]): CashBuild {
  const bankLines: BankLine[] = [];
  const ledger: LedgerEntry[] = [];
  const receipts: CashReceipt[] = [];
  const openIds = new Set<string>([
    // invoices still open on 6 Oct
    ...invoices.filter((i) => i.date >= '2026-09-01').map((i) => i.id), // all September-dated and later
    invoices.find((i) => i.eventIds[0] === 'DEMO-SDB-ETIMAD-2026-0931-L1/MS2')!.id, // 7. 61 days overdue
    invoices.find((i) => i.eventIds[0] === 'DEMO-GPLC-PO-011-L4/2026-07')!.id, // GPLC AMS July, 20 days overdue
    invoices.find((i) => i.eventIds[0] === 'DEMO-JADA_PO_0449-L1/2026-08')!.id, // Jada Aug, due 1 Oct — just overdue
    invoices.find((i) => i.eventIds[0] === 'DEMO-FAIC-PO-2026-004-L2/2026-08')!.id, // FAIC Aug — due 1 Oct
    invoices.find((i) => i.eventIds[0] === 'DEMO-RLC-PO-00017-L1/2026-08')!.id, // RLC Aug — due 1 Oct
  ]);
  // 8. KSIA pays two August invoices in one transfer, short by the bank charge.
  const ksiaAms8 = invoices.find((i) => i.eventIds[0] === 'DEMO-KSIA-PO-00000524-L1/2026-08')!;
  const ksiaTf8 = invoices.find((i) => i.eventIds[0] === 'DEMO-KSIA-PO-00000524-L2/2026-08')!;
  // 9. REDC August paid without a reference.
  const redc8 = invoices.find((i) => i.eventIds[0] === 'DEMO-REDC-PO-0000061-L1/2026-08')!;
  // 12. Nordwind July paid in USD at 3.7512.
  const nw7 = invoices.find((i) => i.eventIds[0] === 'DEMO-NWR-PO-0007-L2/2026-07')!;
  const special = new Set([ksiaAms8.id, ksiaTf8.id, redc8.id, nw7.id]);
  const sepPaid: { inv: Invoice; payDate: string }[] = [];

  // Pre-September receipts: paid on time-ish, all reconciled.
  for (const inv of invoices) {
    if (openIds.has(inv.id) || special.has(inv.id)) continue;
    const client = CLIENT[inv.clientId];
    const payDate = addDays(inv.dueDate, between(-6, 9));
    if (payDate > '2026-09-30') { openIds.add(inv.id); continue; }
    if (payDate > '2026-08-31') { sepPaid.push({ inv, payDate }); continue; }
    const acct = inv.currency === 'USD' ? 'sab-usd' : (client.segment === 'PIF' ? 'rajhi-coll' : 'snb-ops');
    const bl: BankLine = { id: nid('DEMO-BL'), accountId: acct, date: payDate, description: `${client.short} — ${inv.id}`, rawDescription: `INWARD TRF ${client.name.toUpperCase().slice(0, 28)} REF ${inv.id.replace('DEMO-', '')}`, amount: inv.gross, direction: 'credit', type: 'receipt', reference: inv.id, source: 'Bank portal CSV' };
    const le: LedgerEntry = { id: nid('DEMO-LE'), accountId: acct, date: payDate, kind: 'receipt', description: `Receipt ${inv.id} ${client.short}`, amount: inv.gross, reference: inv.id };
    bl.matchedLedgerId = le.id; le.matchedBankLineId = bl.id;
    const rc: CashReceipt = { id: nid('DEMO-RC'), bankLineId: bl.id, clientId: inv.clientId, invoiceIds: [inv.id], amount: inv.gross, method: 'reference', confidence: 1, status: 'applied' };
    bl.receiptId = rc.id;
    inv.status = 'paid';
    bankLines.push(bl); ledger.push(le); receipts.push(rc);
  }

  // ---- September statement, SNB operating ----
  const sep = (day: number) => d(9, day);
  const push = (bl: Omit<BankLine, 'id' | 'source'>, le?: Omit<LedgerEntry, 'id'> | null) => {
    const b: BankLine = { ...bl, id: nid('DEMO-BL'), source: 'CogniDocs' };
    if (le) { const l: LedgerEntry = { ...le, id: nid('DEMO-LE') }; b.matchedLedgerId = l.id; l.matchedBankLineId = b.id; ledger.push(l); }
    bankLines.push(b); return b;
  };
  // Payroll, GOSI, VAT, vendor payments, fees — matched to ledger (13).
  push({ accountId: 'snb-ops', date: sep(25), description: 'Payroll — September', rawDescription: 'WPS SALARY FILE 092026 MUDAD', amount: -804_300, direction: 'debit', type: 'payroll' }, { accountId: 'snb-ops', date: sep(25), kind: 'payroll', description: 'Payroll September 2026 (WPS)', amount: -804_300 });
  push({ accountId: 'snb-ops', date: sep(14), description: 'GOSI contributions — August', rawDescription: 'GOSI SADAD 082026', amount: -133_800, direction: 'debit', type: 'tax' }, { accountId: 'snb-ops', date: sep(14), kind: 'tax', description: 'GOSI August 2026', amount: -133_800 });
  push({ accountId: 'snb-ops', date: sep(28), description: 'ZATCA — VAT return August', rawDescription: 'SADAD ZATCA VAT 082026', amount: -99_916.54, direction: 'debit', type: 'tax' }, { accountId: 'snb-ops', date: sep(28), kind: 'tax', description: 'VAT payable August 2026', amount: -99_916.54 });
  push({ accountId: 'snb-ops', date: sep(9), description: 'Accenture Saudi Arabia — ACN-SA-26-0412', rawDescription: 'OUTWARD TRF ACCENTURE SAUDI ARABIA ACN-SA-26-0412', amount: -402_500, direction: 'debit', type: 'payment', reference: 'ACN-SA-26-0412' }, { accountId: 'snb-ops', date: sep(9), kind: 'payment', description: 'Vendor payment Accenture ACN-SA-26-0412', amount: -402_500, reference: 'ACN-SA-26-0412' });
  push({ accountId: 'snb-ops', date: sep(16), description: 'Transfer from collections account', rawDescription: 'INTERNAL TRF FROM 6080 1016 7519', amount: 600_000, direction: 'credit', type: 'transfer' }, { accountId: 'snb-ops', date: sep(16), kind: 'transfer', description: 'Sweep from Al Rajhi collections', amount: 600_000 });
  // Bank fee with no ledger entry → proposed journal.
  push({ accountId: 'snb-ops', date: sep(30), description: 'Account maintenance and transfer fees', rawDescription: 'SERVICE CHARGES SEP 2026', amount: -345, direction: 'debit', type: 'charge' }, null);
  // Mastek payment: in ledger 30 Sep, not on the September statement (clears 2 Oct) → ledger unmatched (timing).
  ledger.push({ id: nid('DEMO-LE'), accountId: 'snb-ops', date: sep(30), kind: 'payment', description: 'Vendor payment Mastek MME/2026/0882', amount: -207_000, reference: 'MME/2026/0882' });
  // SDB — nothing received (7). GPLC July AMS — nothing received.

  // ---- September statement, Al Rajhi collections ----
  for (const { inv, payDate: date } of sepPaid.filter((x) => x.inv.currency === 'SAR')) {
    const client = CLIENT[inv.clientId];
    const b = push({ accountId: 'rajhi-coll', date, description: `${client.short} — ${inv.id}`, rawDescription: `INWARD TRF ${client.name.toUpperCase().slice(0, 28)} REF ${inv.id.replace('DEMO-', '')}`, amount: inv.gross, direction: 'credit', type: 'receipt', reference: inv.id },
      { accountId: 'rajhi-coll', date, kind: 'receipt', description: `Receipt ${inv.id} ${client.short}`, amount: inv.gross, reference: inv.id });
    const rc: CashReceipt = { id: nid('DEMO-RC'), bankLineId: b.id, clientId: inv.clientId, invoiceIds: [inv.id], amount: inv.gross, method: 'reference', confidence: 1, status: 'applied' };
    b.receiptId = rc.id; receipts.push(rc); inv.status = 'paid';
  }
  push({ accountId: 'rajhi-coll', date: sep(16), description: 'Transfer to operating account', rawDescription: 'INTERNAL TRF TO 1234 5678 9012', amount: -600_000, direction: 'debit', type: 'transfer' }, { accountId: 'rajhi-coll', date: sep(16), kind: 'transfer', description: 'Sweep to SNB operating', amount: -600_000 });
  // 8. KSIA one transfer, two invoices, short SAR 37.50 → proposed tolerance match.
  const ksiaTotal = r2(ksiaAms8.gross + ksiaTf8.gross);
  const ksiaBl = push({ accountId: 'rajhi-coll', date: sep(29), description: 'KSIA — August AMS and specialist days', rawDescription: 'INWARD TRF KING SALMAN INTL AIRPORT DEV CO PAYMENT RUN 2609', amount: r2(ksiaTotal - 37.5), direction: 'credit', type: 'receipt' }, null);
  receipts.push({ id: nid('DEMO-RC'), bankLineId: ksiaBl.id, clientId: 'ksia', invoiceIds: [ksiaAms8.id, ksiaTf8.id], amount: r2(ksiaTotal - 37.5), method: 'tolerance', confidence: 0.93, status: 'proposed', shortfall: 37.5, note: 'Amount equals the two open August invoices less SAR 37.50 — a correspondent bank charge. Proposed: apply both in full and post the charge to bank fees.' });
  // 9. REDC — unreferenced credit equal to the August invoice gross.
  const redcBl = push({ accountId: 'rajhi-coll', date: sep(22), description: 'Riyadh Expo Dev — unreferenced', rawDescription: 'INWARD TRF RIYADH EXPO DEV', amount: redc8.gross, direction: 'credit', type: 'receipt' }, null);
  receipts.push({ id: nid('DEMO-RC'), bankLineId: redcBl.id, clientId: 'redc', invoiceIds: [redc8.id], amount: redc8.gross, method: 'amount_client', confidence: 0.78, status: 'proposed', note: 'No invoice reference on the transfer. Amount equals REDC\'s only open invoice (August EPMO days). Proposed by amount + client; needs approval.' });

  // ---- SAB USD: Nordwind July paid at 3.7512 (12) ----
  const nwBl = push({ accountId: 'sab-usd', date: sep(4), description: 'Nordwind Robotics — July FMS', rawDescription: 'SWIFT MT103 NORDWIND ROBOTICS GMBH INV 2026080018', amount: nw7.gross, direction: 'credit', type: 'receipt', reference: nw7.id },
    { accountId: 'sab-usd', date: sep(4), kind: 'receipt', description: `Receipt ${nw7.id} Nordwind (USD)`, amount: nw7.gross, reference: nw7.id });
  receipts.push({ id: nid('DEMO-RC'), bankLineId: nwBl.id, clientId: 'nordwind', invoiceIds: [nw7.id], amount: nw7.gross, method: 'reference', confidence: 1, status: 'applied', note: 'Booked at 3.75; bank converted at 3.7512 — SAR 13.11 FX gain proposed by Tasweya.' });
  nwBl.receiptId = receipts[receipts.length - 1].id;
  nw7.status = 'paid';

  // Mark remaining opens.
  for (const inv of invoices) if (openIds.has(inv.id) && inv.status !== 'paid') inv.status = inv.status === 'released' ? 'released' : 'posted';
  return { bankLines, ledger, receipts };
}

const CASH = buildCash(INVOICES);

/* ---------------------------------------------------------- budget */

const LINES: BusinessLine[] = ['502', '504', '506', 'SES-FIN', 'SES-HR', 'SES-PROC', 'BES', 'EVAS'];

/** Recognised (delivered) revenue by line × month from the events — the generator's own truth. */
function recognisedByLineMonth(events: BillingEvent[]): Record<BusinessLine, number[]> {
  const out = Object.fromEntries(LINES.map((l) => [l, Array(13).fill(0)])) as Record<BusinessLine, number[]>;
  const lineOf = Object.fromEntries(POS.flatMap((p) => p.lines.map((l) => [l.id, l])));
  for (const e of events) {
    const l = lineOf[e.lineId];
    const fx = e.currency === 'USD' ? USD_SAR : 1;
    if (l.pricingModel === 'advance') {
      const m0 = monthOf(l.start);
      for (let m = m0; m <= 12; m++) out[l.businessLine][m] += (e.expectedAmount / 12) * fx;
      continue;
    }
    if (e.noPoCover) continue; // delivered without an instrument: not recognised
    if (e.evidence.length === 0 && elapsed(e.dueDate)) continue;
    const m = monthOf(e.dueDate);
    out[l.businessLine][m] += e.expectedAmount * fx;
  }
  return out;
}

/* ----------------------------------------------------- opportunities (Stage 1, read from Salesforce — simulated) */

export const OPPORTUNITIES: Opportunity[] = [
  { id: 'DEMO-OPP-0061', clientId: 'ksia', name: 'PMIS Phase 2 — portfolio roll-out (AMS + change capacity)', businessLine: '504', stage: 'Proposal submitted', amount: 280_000, recurring: true, probability: 0.7, expectedStart: '2026-11-01', termMonths: 12, owner: 'Majed Al-Otaibi', note: 'Budgeted from September. Client procurement now expects the PO in November. Proposal DEMO-T40120_0926 submitted 14 Sep; deal review 3 passed.' },
  { id: 'DEMO-OPP-0074', clientId: 'redc', name: 'EPMO support — extension to March 2027', businessLine: '504', stage: 'Verbal award', amount: 80_000, recurring: true, probability: 0.9, expectedStart: '2026-10-01', termMonths: 6, owner: 'Majed Al-Otaibi', note: 'Verbal extension from the REDC programme director on 28 Aug; PO not yet issued. 18 days were delivered in September on this verbal commitment.' },
  { id: 'DEMO-OPP-0082', clientId: 'rlc', name: 'Finance Managed Services — starter package', businessLine: 'SES-FIN', stage: 'Qualified', amount: 42_000, recurring: true, probability: 0.5, expectedStart: '2026-12-01', termMonths: 12, owner: 'Nayef Al-Shammari', note: 'Follows the Workplace contract. Discovery call held 22 Sep; budget confirmed by the client CFO.' },
  { id: 'DEMO-OPP-0088', clientId: 'nordwind', name: 'HR & payroll add-on for the RHQ (USD 6,500/month)', businessLine: 'SES-HR', stage: 'Discovery', amount: 24_375, recurring: true, probability: 0.4, expectedStart: '2027-01-01', termMonths: 12, owner: 'Sarah Al-Amri', note: 'Outside FY2026. Needs headcount confirmation from the parent company.' },
  { id: 'DEMO-OPP-0091', clientId: 'salwan', name: 'HCM Phase 2 — Talent and Performance modules (fixed fee)', businessLine: '504', stage: 'Negotiation', amount: 360_000, recurring: false, probability: 0.35, expectedStart: '2027-02-01', termMonths: 1, owner: 'Nayef Al-Shammari', note: 'Outside FY2026. Pricing re-approval pending at the deal review committee.' },
  { id: 'DEMO-OPP-0055', clientId: 'gplc', name: 'Data platform and analytics foundation', businessLine: 'EVAS', stage: 'Closed lost', amount: 95_000, recurring: true, probability: 0, expectedStart: '2026-09-01', termMonths: 12, owner: 'Majed Al-Otaibi', note: 'Lost to the incumbent integrator on price. Loss review recorded 2 Sep.' },
];

/** Weighted pipeline by line × month for the current fiscal year, derived from the opportunities. */
export function derivePipeline(opps: Opportunity[]): World['pipeline'] {
  const out: World['pipeline'] = [];
  for (const o of opps) {
    if (o.probability <= 0 || o.stage.startsWith('Closed')) continue;
    if (!o.expectedStart.startsWith('2026')) continue;
    const m0 = monthOf(o.expectedStart);
    const months = o.recurring ? Array.from({ length: Math.min(o.termMonths, 12 - m0 + 1) }, (_, i) => m0 + i) : [m0];
    for (const m of months) out.push({ businessLine: o.businessLine, month: m, weighted: Math.round(o.amount * o.probability), label: `${o.name} — ${CLIENT[o.clientId].short}, ${Math.round(o.probability * 100)}%${o.recurring ? `, SAR ${o.amount.toLocaleString('en-US')}/month` : ''}` });
  }
  return out;
}

function buildBudget(events: BillingEvent[]): { budget: BudgetRow[]; drivers: VarianceDriver[]; pipeline: World['pipeline'] } {
  const rec = recognisedByLineMonth(events);
  const budget: BudgetRow[] = [];
  // The plan as it stood in January: contracted schedule + assumptions the budget made.
  for (const line of LINES) {
    for (let m = 1; m <= 12; m++) {
      let plan = rec[line][m];
      // Assumptions the budget carried (and reality did not):
      if (line === '504') {
        if (m >= 9) plan += 280_000; // KSIA Phase 2 PO expected from September
        if (m >= 9) plan += 160_000; // REDC EPMO continuation assumed at 32 days/month
        if (m === 8) plan += 611_800; // UAT milestone planned for August
        if (m === 9) plan -= 611_800; // …and therefore not in September
      }
      if (line === '506') { if (m === 10) plan += 555_000; if (m === 12) plan -= 555_000; } // SDB MS3 budgeted for October; re-planned to December
      if (line === 'SES-FIN' && m >= 7) plan += 42_000; // one more Finance MS client assumed from July
      if (line === 'EVAS' && m >= 6) plan += 60_000; // second accelerator cohort assumed from June
      // Future months: plan is schedule-based; budget rounds.
      const b = Math.round(plan / 1000) * 1000;
      budget.push({ businessLine: line, month: m, budget: b, target: Math.round(b * 1.15 / 1000) * 1000, forecast: 0 });
    }
  }
  // Forecast = actual for elapsed months, schedule for the rest, plus weighted pipeline.
  const pipeline = derivePipeline(OPPORTUNITIES);
  for (const row of budget) {
    const elapsedMonth = row.month <= 9;
    const sched = rec[row.businessLine][row.month];
    const pipe = pipeline.filter((p) => p.businessLine === row.businessLine && p.month === row.month).reduce((s, p) => s + p.weighted, 0);
    let f = elapsedMonth ? sched : sched + pipe;
    if (row.businessLine === '504' && row.month === 9) f += 80_000; // forecast at the start of September carried REDC at 16 days on the verbal extension
    row.forecast = Math.round(f);
  }
  // Variance drivers for the closing month, by line (sum to actual − budget; the remainder is labelled).
  const drivers: VarianceDriver[] = [
    { businessLine: '504', kind: 'PO not received', amount: -280_000, explanation: 'KSIA Phase 2 purchase order budgeted from September; client procurement now expects November. Weighted into the forecast at 70%.', provenance: 'synthetic' },
    { businessLine: '504', kind: 'Expired PO cover', amount: -160_000, explanation: 'REDC EPMO continuation budgeted at 32 days/month. 18 days were delivered in September on a verbal extension with no PO — SAR 90,000 of work that cannot be recognised or billed, and 14 days less demand than planned.', provenance: 'synthetic' },
    { businessLine: '504', kind: 'Timing (CoC / milestone)', amount: 611_800, explanation: 'KSIA UAT milestone (D2.13) was budgeted in August and accepted in PPM on 24 September. Positive in September, negative in August; neutral for the year — if the CoC is signed.', provenance: 'synthetic' },
    { businessLine: 'SES-FIN', kind: 'Scope added', amount: -42_000, explanation: 'Budget assumed a further Finance Managed Services client from July. Riyadh Lake is in the pipeline at 50% for December.', provenance: 'synthetic' },
    { businessLine: 'EVAS', kind: 'Scope added', amount: -60_000, explanation: 'Second accelerator cohort assumed from June has not been sold.', provenance: 'synthetic' },
  ];
  return { budget, drivers, pipeline };
}

const BUDGET = buildBudget(EVENTS);

/* ----------------------------------------------------- close & journals */

/**
 * Tasama's own monthly closing procedures — the 24 rows of their "Monthly
 * Closing Procedures" table (area, action, responsible, deadline, automation),
 * in their order and numbering. Departmental inputs (1–5) come first; Finance
 * starts the close when they are in (6–24, each "2 WD after completing 1–5").
 * Status is derived from the world where Mizan covers the procedure; ERP jobs
 * Mizan only reads back (Fixed Assets, Leases) are labelled as such and carry
 * the job result. Line 25, the VAT return, was added by Cognirise.
 */
const P = (number: number, group: CloseItem['group'], workstream: string, title: string, owner: string, agentId: string | null, deadline: string, dueDay: number,
  tasamaAutomation: CloseItem['tasamaAutomation'], coverage: CloseItem['coverage'], status: CloseItem['status'], extra: Partial<CloseItem> = {}): CloseItem =>
  ({ id: `P${String(number).padStart(2, '0')}`, number, group, workstream, title, owner, agentId, deadline, dueDay, tasamaAutomation, coverage, status, ...extra });

export const CLOSE_ITEMS: CloseItem[] = [
  P(1, 'inputs', 'Finance – Closing Coordination', 'Communicate and monitor the closing calendar, cut-off dates and required submissions; follow up outstanding inputs from HR, Requesters, Operations and D&T', 'omar', 'iqfal', '25th of each month', 0, 'No', 'derived', 'in_progress', { derivedFrom: 'inputs' }),
  P(2, 'inputs', 'Human Resources / Payroll', 'Complete the monthly payroll run (salaries, allowances, deductions, adjustments, final settlements) and provide the final payroll output to Finance', 'hr', 'rawatib', '3 WD after the payroll has been paid out', 2, 'Check with Department', 'derived', 'blocked', { derivedFrom: 'payroll' }),
  P(3, 'inputs', 'Requesters / Business Owners', 'Complete the Certificate of Completion in the ERP for all goods and services received or completed during the month', 'requesters', 'mawrid', '2 WD after month-end', 2, 'Full', 'derived', 'in_progress', { derivedFrom: 'vendor_coc' }),
  P(4, 'inputs', 'Operations', 'Submit the monthly schedule of completed works and services and the related client invoices', 'operations', 'shahid', '2 WD after month-end', 2, 'Check with Department', 'derived', 'in_progress', { derivedFrom: 'delivery_ops' }),
  P(5, 'inputs', 'D&T', 'Submit the monthly schedule of completed works and services and the related client invoices', 'dt', 'shahid', '2 WD after month-end', 2, 'Check with Department', 'derived', 'in_progress', { derivedFrom: 'delivery_dt' }),
  P(6, 'finance', 'Finance – Cash Management', 'Complete bank reconciliations and investigate all unmatched or outstanding transactions', 'reem', 'tasweya', '2 WD after completing 1–5', 4, 'Full', 'derived', 'in_progress', { derivedFrom: 'bank' }),
  P(7, 'finance', 'Finance – Cash Management', 'Run Create Accounting for Cash Management and resolve accounting errors before posting to GL', 'omar', 'tasweya', '2 WD after completing 1–5', 4, 'Full', 'erp-job', 'in_progress', { derivedFrom: 'cash_applied' }),
  P(8, 'finance', 'Finance – Accounts Payable', 'Ensure all required invoice approvals are completed and follow up material pending invoices', 'omar', 'mawrid', '2 WD after completing 1–5', 4, 'Full', 'derived', 'in_progress', { derivedFrom: 'vendor_ap' }),
  P(9, 'finance', 'Finance – Accounts Payable', 'Run Create Accounting / Multiperiod for AP and resolve accounting errors before posting to GL', 'omar', 'mawrid', '2 WD after completing 1–5', 4, 'Full', 'erp-job', 'not_started', { derivedFrom: 'erp_ap' }),
  P(10, 'finance', 'Finance – AP / GL', 'Run the accrual for CoCs and resolve accounting errors before posting to GL', 'reem', 'mawrid', '2 WD after completing 1–5', 4, 'Full', 'derived', 'not_started', { derivedFrom: 'journal_vendor' }),
  P(11, 'finance', 'Finance – GL', 'Review all costs and book all material manual accrual entries', 'reem', 'iqfal', '2 WD after completing 1–5', 4, 'Partial', 'derived', 'not_started', { derivedFrom: 'journal_manual' }),
  P(12, 'finance', 'Finance – Fixed Assets', 'Transfer eligible asset purchases from AP / Mass Additions and verify completeness of additions', 'omar', 'iqfal', '2 WD after completing 1–5', 4, 'Full', 'erp-job', 'not_started', { derivedFrom: 'erp_job' }),
  P(13, 'finance', 'Finance – Fixed Assets', 'Capitalise completed CIP / project items where applicable', 'omar', 'iqfal', '2 WD after completing 1–5', 4, 'Full', 'erp-job', 'not_started', { derivedFrom: 'erp_job' }),
  P(14, 'finance', 'Finance – Fixed Assets', 'Run monthly depreciation and amortisation and review significant or unusual movements', 'omar', 'iqfal', '2 WD after completing 1–5', 4, 'Full', 'erp-job', 'not_started', { derivedFrom: 'erp_job' }),
  P(15, 'finance', 'Finance – Leases', 'Run monthly lease interest and outstanding lease invoices', 'omar', 'iqfal', '2 WD after completing 1–5', 4, 'Full', 'erp-job', 'not_started', { derivedFrom: 'erp_job' }),
  P(16, 'finance', 'Finance – Fixed Assets', 'Run Create Accounting for Fixed Assets, resolve errors and reconcile the FA sub-ledger with GL', 'omar', 'iqfal', '2 WD after completing 1–5', 4, 'Full', 'erp-job', 'not_started', { derivedFrom: 'erp_job' }),
  P(17, 'finance', 'Finance – Receivables', 'Ensure all client invoices and credit notes are recorded in the ERP', 'faisal', 'fatoora', '2 WD after completing 1–5', 4, 'Full', 'derived', 'in_progress', { derivedFrom: 'billing' }),
  P(18, 'finance', 'Finance – Receivables', 'Review outstanding receivables and unapplied receipts', 'faisal', 'tahseel', '2 WD after completing 1–5', 4, 'Partial', 'derived', 'in_progress', { derivedFrom: 'ar_tie' }),
  P(19, 'finance', 'Finance – Receivables', 'Validate all services delivered to clients and book the revenue where it is recognised', 'reem', 'iqfal', '2 WD after completing 1–5', 4, 'No', 'derived', 'not_started', { derivedFrom: 'journal_unbilled' }),
  P(20, 'finance', 'Finance – Receivables', 'Review both unearned and unbilled revenue balances', 'reem', 'iqfal', '2 WD after completing 1–5', 4, 'Partial', 'derived', 'not_started', { derivedFrom: 'journal_deferred' }),
  P(21, 'finance', 'Finance – Receivables', 'Run Create Accounting for AR and resolve accounting errors before posting to GL', 'omar', 'fatoora', '2 WD after completing 1–5', 4, 'Full', 'erp-job', 'blocked', { derivedFrom: 'erp_ar' }),
  P(22, 'finance', 'Finance – Reporting', 'Review the monthly P&L and balance sheet against prior month, budget and expectations; investigate variances and post corrections', 'noura', 'mizaniya', '2 WD after completing 1–5', 4, 'No', 'derived', 'in_progress', { derivedFrom: 'budget' }),
  P(23, 'finance', 'Finance – Reporting', 'Complete the final review and approvals, then close the accounting period in the ERP', 'noura', 'iqfal', '2 WD after completing 1–5', 4, 'Full', 'derived', 'not_started', { derivedFrom: 'period_close' }),
  P(24, 'finance', 'Finance – Reporting', 'Prepare the monthly reports and update the dashboard', 'reem', 'iqfal', '2 WD after completing 1–5', 4, 'No', 'derived', 'not_started', { derivedFrom: 'reports' }),
  // Added by Cognirise — not in Tasama's list. A KSA VAT-registered business files monthly once taxable supplies exceed SAR 40M a year; the return is due by the last day of the following month.
  P(25, 'added', 'Finance – Tax (added by Cognirise)', 'Prepare the monthly VAT return from the cleared tax invoices and the posted vendor invoices; file on the ZATCA portal and pay by the end of the following month', 'reem', 'iqfal', 'Last day of the following month (ZATCA)', 10, 'Not in list', 'derived', 'not_started', { derivedFrom: 'vat' }),
];

export const JOURNALS: Journal[] = [
  { id: 'DEMO-JE-2609-01', kind: 'Unbilled revenue accrual', period: '2026-09', proposedBy: 'iqfal', status: 'proposed', description: 'September services delivered and evidenced but not yet invoiced at close: AMS, managed-service bundles, specialist days and the KSIA UAT milestone (blocked on CoC). Reverses on invoice.', lines: [{ account: '1210 Unbilled receivables (contract asset)', dr: 0, cr: 0 }, { account: '4100 Service revenue', dr: 0, cr: 0 }] },
  { id: 'DEMO-JE-2609-02', kind: 'Deferred revenue release', period: '2026-09', proposedBy: 'iqfal', status: 'proposed', description: 'FAIC Data & AI subscription invoiced in advance (SAR 1,200,000 for Apr 2026–Mar 2027): release of the September twelfth.', lines: [{ account: '2400 Deferred revenue (contract liability)', dr: 100_000, cr: 0 }, { account: '4100 Service revenue', dr: 0, cr: 100_000 }] },
  { id: 'DEMO-JE-2609-03', kind: 'Vendor accrual', period: '2026-09', proposedBy: 'mawrid', status: 'proposed', description: 'Masterworks MS3 services delivered 25 Sep (hand-over evidence in PPM); vendor invoice MW-INV-2609-031 dated 28 Sep is expected through CogniDocs. Accrue cost of delivery to September; reverses on match.', lines: [{ account: '5200 Cost of revenue — IT consultancy', dr: 270_000, cr: 0 }, { account: '2100 Accrued liabilities', dr: 0, cr: 270_000 }] },
  { id: 'DEMO-JE-2609-04', kind: 'Bank charges', period: '2026-09', proposedBy: 'tasweya', status: 'proposed', description: 'SNB service charges September (SAR 345) and correspondent charge on the KSIA receipt (SAR 37.50) — on the statement, not in the ledger.', lines: [{ account: '6300 Bank charges', dr: 382.5, cr: 0 }, { account: '1010 Bank — SNB operating', dr: 0, cr: 345 }, { account: '1020 Bank — Al Rajhi collections', dr: 0, cr: 37.5 }] },
  { id: 'DEMO-JE-2609-05', kind: 'FX difference', period: '2026-09', proposedBy: 'tasweya', status: 'proposed', description: 'Nordwind July receipt USD 10,925 booked at 3.75, converted by SAB at 3.7512.', lines: [{ account: '1030 Bank — SAB USD', dr: 13.11, cr: 0 }, { account: '7100 FX gains', dr: 0, cr: 13.11 }] },
  { id: 'DEMO-JE-2609-06', kind: 'Rate correction (debit note)', period: '2026-09', proposedBy: 'hares', status: 'proposed', description: 'Salwan September specialist days invoiced at SAR 4,100 against contract rate SAR 4,312 (56 days): debit note for SAR 11,872 + VAT.', lines: [{ account: '1200 Trade receivables', dr: 13_652.8, cr: 0 }, { account: '4100 Service revenue', dr: 0, cr: 11_872 }, { account: '2300 VAT output', dr: 0, cr: 1_780.8 }] },
];

/* ------------------------------------------------------------ payroll */

/**
 * Payroll as Finance receives it. HR runs payroll in the HR payroll system and
 * pays through WPS; Tasama's procedure 2 says the final output reaches Finance
 * three working days after pay-out. Mizan holds totals by cost centre and the
 * allocation to engagements from timesheets — never an employee record.
 * September's register is late on Day 4: paid 25 Sep, due 30 Sep, not received.
 */
const PA = (costCentre: string, businessLine: BusinessLine | 'G&A', clientId: string | null, fte: number, cost: number, note?: string): PayrollRun['allocations'][number] => ({ costCentre, businessLine, clientId, fte, cost, ...(note ? { note } : {}) });

export const PAYROLL_RUNS: PayrollRun[] = [
  {
    id: 'PR-2026-08', period: '2026-08', source: 'HR payroll system (Oracle HCM Cloud Payroll)', paidOn: '2026-08-25', dueOn: '2026-08-30', receivedOn: '2026-08-27', wpsBatchRef: 'WPS SALARY FILE 082026 MUDAD',
    headcount: 111, joiners: 1, leavers: 1,
    basic: 622_900, allowances: 218_000, overtime: 8_000, grossPay: 848_900,
    gosiEmployee: 45_100, gosiEmployer: 88_700, otherDeductions: 5_900, finalSettlements: 11_800, netPay: 797_900,
    eosbProvision: 35_000, leaveProvision: 70_700, bonusAccrual: 51_600, employerCost: 1_094_900, gosiDueOn: '2026-09-15',
    allocations: [
      PA('CC-504', '504', 'ksia', 17, 188_000), PA('CC-504', '504', 'salwan', 11, 138_000), PA('CC-504', '504', 'gplc', 3, 35_000), PA('CC-504', '504', 'jada', 4, 43_000), PA('CC-504', '504', 'redc', 7, 76_000),
      PA('CC-506', '506', 'sdb', 11, 111_000), PA('CC-502', '502', 'ksia', 6, 47_500),
      PA('CC-SES', 'SES-FIN', 'gplc', 9, 60_500), PA('CC-SES', 'SES-FIN', 'nordwind', 4, 36_500), PA('CC-BES', 'BES', 'rlc', 5, 33_800), PA('CC-EVAS', 'EVAS', 'faic', 13, 121_000),
      PA('CC-GA', 'G&A', null, 21, 204_600, 'Finance, HR, Legal, Admin, Management — overhead, not allocated to engagements'),
    ],
    status: 'posted', proof: { bankLineId: null, bankTies: true, headcountTies: true, glTies: true, note: 'Register SAR 797,900 = WPS batch 25 Aug = GL 2110; 111 heads = 111 in July + 1 joiner − 1 leaver.' }, journalIds: [],
  },
  {
    id: 'PR-2026-09', period: '2026-09', source: 'HR payroll system (Oracle HCM Cloud Payroll)', paidOn: '2026-09-25', dueOn: '2026-09-30', wpsBatchRef: 'WPS SALARY FILE 092026 MUDAD',
    headcount: 112, joiners: 3, leavers: 2,
    basic: 627_600, allowances: 219_700, overtime: 8_700, grossPay: 856_000,
    gosiEmployee: 45_500, gosiEmployer: 89_400, otherDeductions: 6_200, finalSettlements: 23_400, netPay: 804_300,
    eosbProvision: 35_300, leaveProvision: 71_300, bonusAccrual: 52_000, employerCost: 1_104_000, gosiDueOn: '2026-10-15',
    allocations: [
      PA('CC-504', '504', 'ksia', 17, 190_000, 'PMIS Phase D2 team — the UAT milestone month'), PA('CC-504', '504', 'salwan', 11, 140_000), PA('CC-504', '504', 'gplc', 3, 36_000), PA('CC-504', '504', 'jada', 4, 44_000),
      PA('CC-504', '504', 'redc', 7, 76_000, '18 EPMO days delivered on the expired PO — cost without revenue until the extension is recorded'),
      PA('CC-506', '506', 'sdb', 11, 112_000, 'MS3 build — milestone revenue falls in December'), PA('CC-502', '502', 'ksia', 6, 48_000),
      PA('CC-SES', 'SES-FIN', 'gplc', 9, 61_000), PA('CC-SES', 'SES-FIN', 'nordwind', 4, 37_000, 'RHQ Finance MS — staffed at 4 against a fee that covers 3'), PA('CC-BES', 'BES', 'rlc', 5, 34_000), PA('CC-EVAS', 'EVAS', 'faic', 13, 122_000),
      PA('CC-GA', 'G&A', null, 22, 204_000, 'Finance, HR, Legal, Admin, Management — overhead, not allocated to engagements'),
    ],
    status: 'awaited', journalIds: [],
  },
];

/* ---------------------------------------------------------------- VAT */

/** KSA VAT at 15%, filed monthly on the ZATCA portal. August is filed and paid (28 Sep, on the SNB statement); September opens with the close. */
export const VAT_RETURNS: VatReturn[] = [
  { id: 'VAT-2026-08', period: '2026-08', filingDueOn: '2026-09-30', status: 'filed', preparedOn: '2026-09-08', approvedOn: '2026-09-10', filedOn: '2026-09-28',
    figures: { standardRatedSales: 846_110.25, outputVat: 126_916.54, salesCount: 13, zeroRatedSales: 0, standardRatedPurchases: 180_000, inputVat: 27_000, purchaseCount: 1, deferredInputVat: 0, deferredNote: '', adjustments: 0, adjustmentNote: '', netPayable: 99_916.54, excluded: [], salesRefs: [], purchaseRefs: ['DEMO-VI-0171'] } },
  { id: 'VAT-2026-09', period: '2026-09', filingDueOn: '2026-10-31', status: 'open' },
];

/* ----------------------------------------------------------- ERP jobs */

/** The accounting jobs the ERP runs for Fixed Assets and Leases. Mizan reads their status back; it never runs them. */
export const ERP_JOBS: ErpJob[] = [
  { id: 'EJ-FA-ADD-2609', procedure: 12, module: 'Fixed Assets', name: 'Mass Additions — transfer from Payables', period: '2026-09', status: 'completed', ranAt: '2026-10-02T09:12:00+03:00', summary: '3 additions posted from AP (laptops ×24, two licences capitalised) — SAR 184,500; no untransferred invoice lines', errors: 0 },
  { id: 'EJ-FA-CIP-2609', procedure: 13, module: 'Fixed Assets', name: 'Capitalise CIP / project items', period: '2026-09', status: 'completed', ranAt: '2026-10-02T09:20:00+03:00', summary: 'No CIP items open in September', errors: 0 },
  { id: 'EJ-FA-DEP-2609', procedure: 14, module: 'Fixed Assets', name: 'Depreciation and amortisation', period: '2026-09', status: 'scheduled', scheduledFor: '2026-10-07', summary: 'Scheduled for Day 5, after additions and CIP', errors: 0 },
  { id: 'EJ-LEASE-2609', procedure: 15, module: 'Leases', name: 'Lease interest and lease invoices (IFRS 16)', period: '2026-09', status: 'completed', ranAt: '2026-10-03T08:40:00+03:00', summary: '2 leases (Riyadh HQ, Jeddah office): interest SAR 18,420; 2 lease invoices matched', errors: 0 },
  { id: 'EJ-FA-CA-2609', procedure: 16, module: 'Fixed Assets', name: 'Create Accounting — Fixed Assets', period: '2026-09', status: 'not_run', summary: 'Runs after depreciation', errors: 0 },
];

/* ------------------------------------------------- department inputs */

/** What the departments owe the close (procedures 2–5) and where it stands on Day 4. Iqfal issued the calendar on 25 Sep and chases the late ones. */
export const DEPARTMENT_INPUTS: DepartmentInput[] = [
  { id: 'DI-02', procedure: 2, department: 'hr', what: 'Final payroll register — September: totals by cost centre, GOSI, deductions, final settlements', via: 'HR payroll system export → Rawatib', dueOn: '2026-09-30', reminders: ['2026-10-01', '2026-10-05'], note: 'HR confirmed the run was paid on 25 Sep; the register is held for two final settlements.' },
  { id: 'DI-03', procedure: 3, department: 'requesters', what: 'Certificates of completion in the ERP for goods and services received', via: 'Oracle Procurement receiving → Mawrid', dueOn: '2026-10-02', receivedOn: '2026-10-02', reminders: [], note: 'Receipts confirmed for the vendor deliveries on file; Masterworks MS3 receipt awaited with the invoice.' },
  { id: 'DI-04', procedure: 4, department: 'operations', what: 'Schedule of completed works and services — Operations lines', via: 'Derived by Shahid from PPM / ServiceNow / timesheets; confirmed by the Service Delivery Lead', dueOn: '2026-10-02', receivedOn: '2026-10-02', reminders: [] },
  { id: 'DI-05', procedure: 5, department: 'dt', what: 'Schedule of completed works and services — D&T lines', via: 'Derived by Shahid from PPM / ServiceNow / timesheets; confirmed by the D&T delivery lead', dueOn: '2026-10-02', receivedOn: '2026-10-02', reminders: [], note: 'REDC September days flagged: delivered on an expired PO.' },
];

/* ----------------------------------------------------- findings, dunning */

const INV = (eventId: string) => INVOICES.find((i) => i.eventIds[0] === eventId);

export const FINDINGS: Finding[] = [
  { id: 'DEMO-RA-0912', agentId: 'hares', kind: 'Missed billing', clientId: 'gplc', amount: 52_500, summary: 'GPLC AMS August — delivered, CoC signed 3 Sep, never invoiced', detail: 'Billing event DEMO-GPLC-PO-011-L4/2026-08 is 36 days past due with full evidence and a signed CoC. No invoice references it. Fatoora can draft a catch-up invoice now; the July invoice for the same line is also 20 days overdue.', recordRef: 'DEMO-GPLC-PO-011-L4/2026-08', acknowledged: false },
  { id: 'DEMO-RA-0913', agentId: 'hares', kind: 'Blocked billing', clientId: 'ksia', amount: 611_800, summary: 'KSIA UAT milestone accepted in PPM, CoC unsigned for 12 days', detail: 'D2.13 UAT complete was accepted in PPM on 24 Sep. The CoC request has been reminded twice. SAR 611,800 cannot be invoiced and the September forecast depends on it. Shahid has prepared the escalation to the KAM.', recordRef: 'DEMO-KSIA-PO-00000611-L1/D2.13', acknowledged: false },
  { id: 'DEMO-RA-0914', agentId: 'hares', kind: 'Under-rate', clientId: 'salwan', amount: 11_872, summary: 'Salwan specialist days invoiced at SAR 4,100; contract rate SAR 4,312', detail: `Invoice ${INV('DEMO-SALWAN-PO-202600118-L2/2026-09')?.id} bills 56 days at the 2025 rate the PO line carries. Rate card RC-2026-01 in Sirion says SAR 4,312. Under-billing SAR 11,872 net. Debit note DEMO-JE-2609-06 proposed; the PO line itself should be corrected with the client.`, recordRef: INV('DEMO-SALWAN-PO-202600118-L2/2026-09')?.id ?? '', acknowledged: false },
  { id: 'DEMO-RA-0915', agentId: 'hares', kind: 'PO over-consumed', clientId: 'jada', amount: 175_749, summary: 'Jada PO 0449 at 96% consumed with three AMS months left', detail: 'AMS at SAR 58,583/month and change-request days share one PO cap of SAR 760,000. Invoiced to date SAR 729,163. October–December AMS alone needs SAR 175,749; with the forecast change-request days the uncovered amount is about SAR 331,000. Aqd has drafted the PO top-up request for the KAM.', recordRef: 'DEMO-JADA_PO_0449', acknowledged: false },
  { id: 'DEMO-RA-0916', agentId: 'hares', kind: 'Expired PO cover', clientId: 'redc', amount: 90_000, summary: 'REDC — 18 days delivered in September on an expired PO', detail: 'Service agreement and PO ended 31 Aug. Timesheets show 18 days in September. Not recognised, not billable until a PO or extension exists. The KAM holds a verbal commitment; Aqd has drafted the extension request.', recordRef: 'DEMO-REDC-PO-0000061-L1/2026-09', acknowledged: false },
  { id: 'DEMO-RA-0917', agentId: 'hares', kind: 'Clearance rejected', clientId: 'nordwind', amount: INV('DEMO-NWR-PO-0007-L2/2026-09')?.gross ?? 0, summary: 'Nordwind September invoice rejected by ZATCA — buyer VAT number missing', detail: 'The RHQ obtained its VAT registration in August; the customer master still has no VAT number. Until the field is filled and the invoice re-submitted it is not a valid tax invoice and the client cannot pay it.', recordRef: INV('DEMO-NWR-PO-0007-L2/2026-09')?.id ?? '', acknowledged: false },
];

const sdbInv = INV('DEMO-SDB-ETIMAD-2026-0931-L1/MS2')!;
const gplcJul = INV('DEMO-GPLC-PO-011-L4/2026-07')!;
const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

export const DUNNING: DunningItem[] = [
  { id: 'DEMO-DN-0041', invoiceId: sdbInv.id, clientId: 'sdb', stage: 'second', proposedStage: 'formal', status: 'proposed',
    draft: `Subject: Invoice ${sdbInv.id} — SAR ${fmt(sdbInv.gross)} — 61 days past due\n\nDear Finance Department,\n\nWe refer to our invoice for milestone 2 (Build complete) under contract DEMO-SDB-ETIMAD-2026-008, accepted on 20 June 2026 and registered in Etimad on 23 June. The invoice fell due on ${sdbInv.dueDate} and remains unpaid.\n\nWe would be grateful for confirmation of the expected payment date, or of any query that is holding the Etimad approval. Our Key Account Manager, Sarah Al-Amri, is available to meet your team this week.\n\nTasama Business Services — Revenue & Treasury` },
  { id: 'DEMO-DN-0042', invoiceId: gplcJul.id, clientId: 'gplc', stage: 'none', proposedStage: 'reminder', status: 'proposed',
    draft: `Subject: Gentle reminder — invoice ${gplcJul.id} (AMS July) now 20 days past due\n\nDear GPLC Finance team,\n\nA reminder that invoice ${gplcJul.id} for SAR ${fmt(gplcJul.gross)} (General operation and support services, July 2026) fell due on ${gplcJul.dueDate}. If it is already in your payment run, please ignore this note; otherwise we would appreciate an expected date.\n\nMajed Al-Otaibi, Key Account Manager\nTasama Business Services` },
];

/* ---------------------------------------------------------------- trail */

const T = (at: string, actor: TrailEntry['actor'], kind: TrailEntry['kind'], summary: string, extra: Partial<TrailEntry> = {}): TrailEntry =>
  ({ id: nid('DEMO-TR'), at, actor, kind, summary, ...extra });

export const TRAIL: TrailEntry[] = [
  T('2026-10-01T06:02:00+03:00', { kind: 'agent', id: 'tasweya' }, 'observed', 'Read SNB September statement (CogniDocs job DEMO-JOB-7c21, template_match:snb-v4, confidence 97) — 7 lines', { autonomy: 'observe' }),
  T('2026-10-01T06:02:40+03:00', { kind: 'agent', id: 'tasweya' }, 'acted', 'Applied 6 receipts on Al Rajhi by invoice reference (confidence 1.00)', { autonomy: 'supervised', detail: 'Exact reference matches auto-apply within remit; each is reversible from the Cash lane.' }),
  T('2026-10-01T06:03:10+03:00', { kind: 'agent', id: 'tasweya' }, 'proposed', `KSIA transfer SAR ${fmt(CASH.receipts.find((r) => r.method === 'tolerance')!.amount)} — SAR 37.50 short of two August invoices; tolerance match + bank charge journal`, { autonomy: 'recommend', recordRef: CASH.receipts.find((r) => r.method === 'tolerance')!.id }),
  T('2026-10-01T06:03:30+03:00', { kind: 'agent', id: 'tasweya' }, 'proposed', 'Unreferenced REDC credit SAR 184,000 — amount + client match to the August invoice (confidence 0.78)', { autonomy: 'recommend', recordRef: CASH.receipts.find((r) => r.method === 'amount_client')!.id }),
  T('2026-10-01T07:15:00+03:00', { kind: 'agent', id: 'hares' }, 'observed', 'Daily 4-way check: 6 findings — 1 missed, 1 blocked, 1 under-rate, 1 PO over-consumed, 1 expired PO cover, 1 clearance rejected', { autonomy: 'recommend' }),
  T('2026-10-01T07:16:00+03:00', { kind: 'agent', id: 'fatoora' }, 'proposed', 'September billing run prepared from the schedule — every due, evidenced event drafted; 2 withheld (CoC missing, no PO cover)', { autonomy: 'assisted' }),
  T('2026-10-02T09:40:00+03:00', { kind: 'person', id: 'majed' }, 'overridden', 'Changed Tahseel\'s proposed SDB dunning from "formal notice" to "second reminder"', { override: { from: 'Formal notice (stage 3)', to: 'Second reminder (stage 2)', reason: 'SDB finance confirmed the Etimad approval is with their internal audit; a formal notice now would damage the MS3 acceptance.' }, recordRef: 'DEMO-DN-0041' }),
  T('2026-10-03T08:00:00+03:00', { kind: 'agent', id: 'shahid' }, 'acted', 'Second CoC reminder sent to KSIA PMO director for D2.13 UAT (sent 24 Sep, reminded 29 Sep, 3 Oct)', { autonomy: 'supervised', recordRef: 'DEMO-KSIA-PO-00000611-L1/D2.13' }),
  T('2026-10-03T08:01:00+03:00', { kind: 'agent', id: 'shahid' }, 'escalated', 'Reminder cadence exhausted — escalation to KAM Majed Al-Otaibi prepared with the UAT exit report attached', { autonomy: 'recommend', recordRef: 'DEMO-KSIA-PO-00000611-L1/D2.13' }),
  T('2026-10-05T10:30:00+03:00', { kind: 'agent', id: 'mawrid' }, 'rejected', 'Accenture ACN-SA-26-0533 (SAR 280,000) — no vendor PO; CR-7 is outside PO 3051 scope. Routed to Procurement.', { autonomy: 'assisted', recordRef: 'DEMO-VI-0186' }),
  T('2026-10-05T10:31:00+03:00', { kind: 'agent', id: 'mawrid' }, 'proposed', 'Masterworks MS3 delivered 25 Sep with no vendor invoice yet on file — accrual DEMO-JE-2609-03 proposed; the invoice is expected through CogniDocs', { autonomy: 'assisted', recordRef: 'DEMO-JE-2609-03' }),
  T('2026-10-01T07:00:00+03:00', { kind: 'agent', id: 'iqfal' }, 'acted', 'Reminder to HR: the September payroll register was due 30 Sep (3 WD after pay-out on 25 Sep) — not received', { autonomy: 'supervised', recordRef: 'PR-2026-09' }),
  T('2026-10-05T07:00:00+03:00', { kind: 'agent', id: 'iqfal' }, 'escalated', 'Second reminder to HR, copied to the Accounting Manager: payroll register 3 WD late; Finance procedures 6–24 cannot start their 2-WD window', { autonomy: 'supervised', recordRef: 'PR-2026-09' }),
  T('2026-10-06T06:00:00+03:00', { kind: 'agent', id: 'iqfal' }, 'observed', 'Close Day 4 of 10: inputs 1–5 — HR payroll register 4 WD late, D&T schedule flags REDC without PO cover; Finance — ZATCA rejection, Accenture invoice without PO, two bank accounts unsigned; Fixed Assets jobs 14 and 16 not yet run in the ERP.', { autonomy: 'supervised' }),
  T('2026-10-06T06:05:00+03:00', { kind: 'agent', id: 'mizaniya' }, 'proposed', 'September variance decomposed: 504 −SAR 280k PO not received, −160k expired PO cover, +611.8k milestone timing; reforecast prepared', { autonomy: 'recommend' }),
];

/* ---------------------------------------------------------------- world */

/** The demo's clock: the world's as-of date with the real time of day, Riyadh time — so trail entries written during a demo sit on Day 4 of the close, not on whatever day the room meets. */
export function demoNow(world: { asOf: string }, real: Date = new Date()): string {
  const riyadh = new Date(real.getTime() + 3 * 3600_000);
  return `${world.asOf}T${riyadh.toISOString().slice(11, 19)}+03:00`;
}

export const DEFAULT_SETTINGS: Settings = {
  erp: 'oracle',
  cognidocs: { mode: 'simulated', baseUrl: '', sandbox: true },
  cashTolerance: 50, autoDunningLimit: 100_000, poConsumptionAlertPct: 80, cocReminderDays: [3, 7, 10],
};

export function buildWorld(): World {
  return structuredClone({
    asOf: AS_OF, closingPeriod: CLOSING_PERIOD, closeDay: CLOSE_DAY,
    clients: CLIENTS, contracts: CONTRACTS, pos: POS, events: EVENTS, invoices: INVOICES,
    bankAccounts: BANK_ACCOUNTS, bankLines: CASH.bankLines, ledger: CASH.ledger, receipts: CASH.receipts,
    vendorPOs: VENDOR_POS, vendorInvoices: VENDOR_INVOICES,
    budget: BUDGET.budget, drivers: BUDGET.drivers, opportunities: OPPORTUNITIES, pipeline: BUDGET.pipeline, settings: DEFAULT_SETTINGS,
    closeItems: CLOSE_ITEMS, journals: JOURNALS, payrollRuns: PAYROLL_RUNS, vatReturns: VAT_RETURNS, erpJobs: ERP_JOBS, inputs: DEPARTMENT_INPUTS, findings: FINDINGS, dunning: DUNNING,
    jobs: [], trail: TRAIL, expenses: [], flags: { reforecastAccepted: false, periodClosed: false, seq: 500, erpSeq: 1, rev: 1 },
  }) as World;
}

export type { Currency };
