/**
 * The lead-to-cash process, in four stages. Tasama's own lifecycle names
 * (Stage 1 Lead to Contract, Stage 2 Contract to Service Management, Stage 3
 * Service Management to Contract Close) with the close split out, because
 * month-end is a job in its own right with its own owner and calendar.
 *
 * Every step states: actor, system of record, what Mizan does, the gate,
 * the agent and its autonomy, and the coverage in this prototype.
 */
import type { Autonomy, World } from './types';
import type { Coverage } from './workflows';
import { arOpen, bankRec, cashStats, closeSummary, eventStatus, poConsumption, toSAR, unbilled, waterfall } from './derive';

export type StageId = 'lead-to-contract' | 'contract-to-service' | 'service-to-cash' | 'close';

export type ProcessStep = {
  id: string;
  title: string;
  actor: string;
  system: string;
  mizan: string;
  gate?: string;
  agentId?: string;
  autonomy?: Autonomy;
  coverage: Coverage | 'read-only';
  workflowId?: string;
};

export type Stage = {
  id: StageId;
  index: number;
  name: string;
  tasamaName: string;
  question: string;
  owner: string;
  systems: string[];
  mizanRole: 'reads' | 'operates' | 'operates with the ERP';
  steps: ProcessStep[];
};

export const STAGES: Stage[] = [
  {
    id: 'lead-to-contract', index: 1, name: 'Lead-to-Contract', tasamaName: 'Stage 1 — Lead to Contract (L2S · S2P · P2C)',
    question: 'What have we promised, to whom, on what terms?', owner: 'Chief Commercial — Sales, Solutioning, KAM, Legal', systems: ['Salesforce Sales', 'Salesforce Revenue Cloud (CPQ)', 'Sirion (CLM)'], mizanRole: 'reads',
    steps: [
      { id: 's1-1', title: 'Lead captured and qualified (Deal Review 1–2)', actor: 'Sales / Business Development', system: 'Salesforce Sales', mizan: 'Reads the weighted pipeline by business line and month for the revenue forecast only', coverage: 'read-only', agentId: 'mizaniya', autonomy: 'observe' },
      { id: 's1-2', title: 'Proposal, pricing and Deal Review Committee', actor: 'Sales, Solutioning team, DRC', system: 'Salesforce Revenue Cloud', mizan: 'Reads quote lines — service, pricing model, unit, rate, quantity, term — to match the PO against later', coverage: 'read-only' },
      { id: 's1-3', title: 'Contract or MSA negotiated, signed and logged', actor: 'Legal, KAM', system: 'Sirion', mizan: 'Extracts the billing terms: payment days, billing frequency, milestones, rate card version, caps, CoC requirement, expiry', gate: 'Signed contract logged in Sirion', agentId: 'aqd', autonomy: 'recommend', coverage: 'implemented', workflowId: 'wf-01' },
      { id: 's1-4', title: 'Renewal and expiry watch', actor: 'Aqd → KAM', system: 'Sirion / Mizan', mizan: 'Flags contracts expiring within 90/60/30 days and POs above the consumption threshold; drafts the renewal pack', agentId: 'aqd', autonomy: 'recommend', coverage: 'partial', workflowId: 'wf-09' },
    ],
  },
  {
    id: 'contract-to-service', index: 2, name: 'Contract-to-Service', tasamaName: 'Stage 2 — Contract to Service Management',
    question: 'What instrument lets us bill, and what will we bill when?', owner: 'KAM, Service Delivery Lead, Head of Revenue & Treasury', systems: ['Mizan (PO register, billing schedule)', 'Oracle Fusion / Odoo (customer account)', 'ServiceNow / PPM (mobilisation)', 'Oracle Procurement (vendor POs)'], mizanRole: 'operates with the ERP',
    steps: [
      { id: 's2-1', title: 'Client PO received and registered', actor: 'Client → KAM', system: 'Mizan → ERP customer account', mizan: 'Registers the PO in the client\'s own number format with its lines; mirrors the customer account to the ERP', gate: 'PO references a signed contract or quote', agentId: 'aqd', autonomy: 'assisted', coverage: 'implemented', workflowId: 'wf-01' },
      { id: 's2-2', title: 'PO lines matched to quote lines', actor: 'Aqd', system: 'Mizan', mizan: 'Flags price, quantity, term and missing-line mismatches and expired contracts; the KAM resolves them with the client', agentId: 'aqd', autonomy: 'assisted', coverage: 'implemented', workflowId: 'wf-01' },
      { id: 's2-3', title: 'Billing schedule generated and confirmed', actor: 'Aqd → Head of Revenue & Treasury', system: 'Mizan', mizan: 'Expands every PO line into dated billing events by pricing model — monthly fixed, days × rate, volume bundle, milestone %, one-off, pass-through, advance — each with its evidence requirement', gate: 'Schedule confirmed by the Head of Revenue & Treasury', agentId: 'aqd', autonomy: 'recommend', coverage: 'implemented', workflowId: 'wf-01' },
      { id: 's2-4', title: 'Delivery mobilised (PIW, governance)', actor: 'KAM, Service Delivery Lead', system: 'ServiceNow / PPM', mizan: 'Reads the project ID, business line and delivery owner', coverage: 'read-only' },
      { id: 's2-5', title: 'Vendor PO raised for subcontracted or pass-through scope', actor: 'Procurement', system: 'Oracle Fusion Procurement', mizan: 'Links the vendor PO to the client PO line so cost and margin exist per line', agentId: 'mawrid', autonomy: 'observe', coverage: 'implemented', workflowId: 'wf-07' },
    ],
  },
  {
    id: 'service-to-cash', index: 3, name: 'Service-to-Cash', tasamaName: 'Stage 3 — Service Management to Contract Close (the part marked "TO BE DEVELOPED")',
    question: 'Did we deliver, did we bill it, did we get paid?', owner: 'Head of Revenue & Treasury; KAM for the client contact', systems: ['Mizan', 'PPM / ServiceNow / timesheets (evidence)', 'Oracle Fusion / Odoo AR', 'ZATCA', 'Banks via CogniDocs'], mizanRole: 'operates with the ERP',
    steps: [
      { id: 's3-1', title: 'Delivery evidence collected per billing event', actor: 'Service Delivery Lead, PPM', system: 'PPM / ServiceNow / timesheets → Mizan', mizan: 'Attaches days, milestone acceptances, service months, volumes and licence activations to the event; computes readiness', agentId: 'shahid', autonomy: 'supervised', coverage: 'implemented', workflowId: 'wf-02' },
      { id: 's3-2', title: 'Certificate of completion requested, chased, escalated', actor: 'Shahid → client → KAM', system: 'Mizan (email)', mizan: 'Drafts the request with the evidence pack, reminds on the cadence, escalates to the KAM when exhausted', gate: 'CoC signed where the contract requires it', agentId: 'shahid', autonomy: 'supervised', coverage: 'implemented', workflowId: 'wf-02' },
      { id: 's3-3', title: 'Invoice drafted, released, posted, cleared', actor: 'Fatoora → Head of Revenue & Treasury → ERP → ZATCA', system: 'Mizan → Oracle AR / Odoo → ZATCA', mizan: 'Drafts when due and evidenced, validates the ZATCA fields, posts on release, reads back clearance, handles rejections', gate: 'Release by amount authority; ZATCA clearance', agentId: 'fatoora', autonomy: 'assisted', coverage: 'implemented', workflowId: 'wf-03' },
      { id: 's3-4', title: 'Revenue assurance — the four-way check', actor: 'Hares', system: 'Mizan', mizan: 'Daily: delivered-not-invoiced, under-rate, PO over-consumed, delivery on expired cover, unreasoned credit notes, clearance rejections', agentId: 'hares', autonomy: 'recommend', coverage: 'implemented', workflowId: 'wf-04' },
      { id: 's3-5', title: 'Collections', actor: 'Tahseel → KAM', system: 'Mizan (email)', mizan: 'Ages every open invoice, stages dunning by segment and channel, drafts the notice, logs promises and disputes, escalates', gate: 'KAM approves notices to PIF and Government accounts', agentId: 'tahseel', autonomy: 'assisted', coverage: 'implemented', workflowId: 'wf-05' },
      { id: 's3-6', title: 'Cash application', actor: 'Tasweya', system: 'Bank statement (CogniDocs) → Mizan → ERP receipts', mizan: 'Matches credits to invoices by reference, amount + client, tolerance, one-to-many; applies exact matches, proposes the rest', gate: 'Proposed matches approved by the Head of Revenue & Treasury', agentId: 'tasweya', autonomy: 'supervised', coverage: 'implemented', workflowId: 'wf-06' },
      { id: 's3-7', title: 'Cost of delivery matched', actor: 'Mawrid → Accountant', system: 'Vendor invoice (CogniDocs) → Mizan → ERP AP', mizan: 'Three-way match to vendor PO and delivery, allocation to the client PO line, pass-through billing event, refusal of duplicates and no-PO invoices', gate: 'Match approved by the Accountant', agentId: 'mawrid', autonomy: 'assisted', coverage: 'implemented', workflowId: 'wf-07' },
    ],
  },
  {
    id: 'close', index: 4, name: 'Close', tasamaName: 'Month-end close — Tasama\'s own close, Day 1 to Day 10',
    question: 'Can we close the month, and where are we against budget?', owner: 'Accounting Manager, CFO; FP&A for the forecast', systems: ['Mizan', 'Oracle Fusion / Odoo GL and cash management', 'Banks via CogniDocs', 'Power BI (close pack)'], mizanRole: 'operates with the ERP',
    steps: [
      { id: 's4-1', title: 'Checklist derived from the data', actor: 'Iqfal', system: 'Mizan', mizan: 'Status of every item read from the ledger, the schedule and the reconciliations — billing complete, cash applied, accounts explained, vendors matched, ZATCA clean', agentId: 'iqfal', autonomy: 'supervised', coverage: 'implemented', workflowId: 'wf-08' },
      { id: 's4-2', title: 'Revenue cut-off: unbilled accrual and deferred release', actor: 'Iqfal → Accounting Manager', system: 'Mizan → ERP GL', mizan: 'Computes the contract asset from delivered-not-invoiced events and the deferred release from advance invoices; proposes the journals', gate: 'Journals approved by the Accounting Manager', agentId: 'iqfal', autonomy: 'assisted', coverage: 'implemented', workflowId: 'wf-08' },
      { id: 's4-3', title: 'Bank reconciliation per account', actor: 'Tasweya → Accounting Manager', system: 'Bank statements (CogniDocs) → Mizan → ERP cash management', mizan: 'Statement balance, ledger balance, open items on both sides, proposed adjustments (charges, FX, timing); proof to the open items', gate: 'Sign-off requires the difference to equal the open items', agentId: 'tasweya', autonomy: 'assisted', coverage: 'implemented', workflowId: 'wf-06' },
      { id: 's4-4', title: 'AR sub-ledger tied to GL; ageing reviewed', actor: 'Iqfal, Tahseel → Head of Revenue & Treasury', system: 'Mizan', mizan: 'Ties receivables to the control account; confirms dunning stages with the KAMs; assesses provisioning', agentId: 'iqfal', autonomy: 'supervised', coverage: 'implemented', workflowId: 'wf-08' },
      { id: 's4-5', title: 'Cost of delivery accrued; margin reviewed', actor: 'Mawrid, Mizaniya → CFO', system: 'Mizan → ERP GL', mizan: 'Accrues delivered-not-invoiced vendor cost; gross margin by client and line against the 23% target', agentId: 'mawrid', autonomy: 'assisted', coverage: 'implemented', workflowId: 'wf-07' },
      { id: 's4-6', title: 'Budget · Target · Forecast · Actual and the reforecast', actor: 'Mizaniya → FP&A', system: 'Mizan', mizan: 'Variance by business line decomposed into drivers in the words of the contract; forecast re-cut from the schedule and the weighted pipeline', gate: 'FP&A accepts the reforecast', agentId: 'mizaniya', autonomy: 'recommend', coverage: 'implemented', workflowId: 'wf-08' },
      { id: 's4-7', title: 'Tax: VAT output reconciled to cleared invoices', actor: 'Fatoora → Accountant', system: 'Mizan ↔ ZATCA status', mizan: 'No rejected invoice may remain; output VAT ties to cleared invoices', agentId: 'fatoora', autonomy: 'supervised', coverage: 'implemented' },
      { id: 's4-8', title: 'Close pack and period close', actor: 'Iqfal → CFO', system: 'Mizan → Power BI', mizan: 'Management-accounts schedules assembled; the CFO closes when every item is done, or holds with the blocker named', gate: 'CFO sign-off', agentId: 'iqfal', autonomy: 'supervised', coverage: 'partial', workflowId: 'wf-08' },
    ],
  },
];

export type StageMetric = { label: string; value: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' };

const fmt = (n: number) => `SAR ${n >= 1_000_000 ? (n / 1_000_000).toFixed(2) + 'M' : n >= 1000 ? (n / 1000).toFixed(0) + 'k' : n.toFixed(0)}`;

/** Live numbers per stage, from the same derivations the screens use. */
export function stageMetrics(world: World, stage: StageId): StageMetric[] {
  switch (stage) {
    case 'lead-to-contract': {
      const open = world.opportunities.filter((o) => !o.stage.startsWith('Closed'));
      const weighted = world.pipeline.reduce((s, p) => s + p.weighted, 0);
      const expiring = world.contracts.filter((c) => c.status !== 'expired' && c.end <= '2027-01-06').length;
      return [
        { label: 'Open opportunities', value: String(open.length) },
        { label: 'Weighted pipeline in FY', value: fmt(weighted) },
        { label: 'Active contracts', value: String(world.contracts.filter((c) => c.status === 'active').length) },
        { label: 'Expiring within 90 days', value: String(expiring), tone: expiring ? 'warn' : 'neutral' },
        { label: 'Expired with delivery continuing', value: String(world.contracts.filter((c) => c.status === 'expired').length), tone: 'bad' },
      ];
    }
    case 'contract-to-service': {
      const flags = world.pos.flatMap((p) => p.lines.flatMap((l) => l.matchFlags)).length;
      const unconfirmed = world.pos.filter((p) => !p.scheduleConfirmed).length;
      const over = world.pos.filter((p) => poConsumption(world, p.id).pct >= world.settings.poConsumptionAlertPct / 100).length;
      return [
        { label: 'Purchase orders', value: String(world.pos.length) },
        { label: 'Billing events scheduled', value: String(world.events.length) },
        { label: 'Mismatch flags', value: String(flags), tone: flags ? 'warn' : 'good' },
        { label: 'Schedules to confirm', value: String(unconfirmed), tone: unconfirmed ? 'warn' : 'good' },
        { label: `POs above ${world.settings.poConsumptionAlertPct}% consumed`, value: String(over), tone: over ? 'warn' : 'good' },
      ];
    }
    case 'service-to-cash': {
      const wf = waterfall(world);
      const blocked = world.events.filter((e) => eventStatus(world, e).startsWith('blocked')).length;
      const cs = cashStats(world);
      return [
        { label: `Contracted ${world.closingPeriod}`, value: fmt(wf.contracted) },
        { label: 'Invoiced', value: fmt(wf.invoiced), tone: wf.invoiced < wf.evidenced ? 'warn' : 'good' },
        { label: 'Unbilled, delivered', value: fmt(unbilled(world)), tone: 'warn' },
        { label: 'Blocked events', value: String(blocked), tone: blocked ? 'bad' : 'good' },
        { label: 'Open receivables', value: fmt(arOpen(world)) },
        { label: 'Cash auto-matched', value: `${Math.round(cs.autoRate * 100)}%`, tone: cs.autoRate > 0.7 ? 'good' : 'warn' },
      ];
    }
    case 'close': {
      const c = closeSummary(world);
      const recs = world.bankAccounts.map((a) => bankRec(world, a.id));
      return [
        { label: 'Close day', value: `${world.closeDay} of 10` },
        { label: 'Items done', value: `${c.done} / ${c.total}`, tone: c.done === c.total ? 'good' : 'neutral' },
        { label: 'Blocked', value: String(c.blocked), tone: c.blocked ? 'bad' : 'good' },
        { label: 'Journals posted', value: `${world.journals.filter((j) => j.status === 'posted').length} / ${world.journals.length}` },
        { label: 'Accounts signed off', value: `${recs.filter((r) => r.account.signedOff).length} / ${recs.length}`, tone: recs.every((r) => r.account.signedOff) ? 'good' : 'neutral' },
        { label: 'Unbilled to accrue', value: fmt(world.events.filter((e) => ['due', 'missed', 'blocked_coc'].includes(eventStatus(world, e))).reduce((s, e) => s + toSAR(e.expectedAmount, e.currency), 0)) },
      ];
    }
  }
}
