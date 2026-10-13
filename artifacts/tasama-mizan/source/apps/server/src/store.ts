/**
 * The PostgreSQL store. The world is loaded whole (it is small: a few
 * hundred rows), an action is applied by the pure reducer, and only the rows
 * whose serialisation changed are upserted, in one transaction. Deleted ids
 * are removed. Order within a table is kept with a `position` column where
 * the domain relies on array order.
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { World } from '@mizan/domain/types';
import { buildWorld } from '@mizan/domain/world';

const { Pool, types } = pg;
types.setTypeParser(1082, (v) => v); // DATE → 'YYYY-MM-DD' string, no timezone shift
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v))); // NUMERIC → number
types.setTypeParser(1184, (v) => new Date(v).toISOString()); // TIMESTAMPTZ → ISO string

export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4, ssl: process.env.DATABASE_URL?.includes('sslmode=require') || process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined });

type Col = { field: string; col: string };
type Spec = { table: string; cols: Col[] };

const C = (field: string, col = field.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())): Col => ({ field, col });

const SPECS: Record<string, Spec> = {
  clients: { table: 'clients', cols: ['id', 'code', 'name', 'short', 'segment', 'pif', 'kam', 'deliveryLead', 'vatNo', 'paymentTermsDays', 'currency', 'channel'].map((f) => C(f)) },
  contracts: { table: 'contracts', cols: [C('id'), C('clientId'), C('type'), C('status'), C('start', 'start_date'), C('end', 'end_date'), C('totalValue'), C('paymentTermsDays'), C('cocRequired'), C('rateCardVersion'), C('source')] },
  pos: { table: 'purchase_orders', cols: [C('id'), C('clientId'), C('contractId'), C('proposalId'), C('date', 'po_date'), C('start', 'start_date'), C('end', 'end_date'), C('value'), C('currency'), C('status'), C('scheduleConfirmed')] },
  poLines: { table: 'po_lines', cols: [C('id'), C('poId'), C('activity'), C('businessLine'), C('serviceTag'), C('pricingModel'), C('unit'), C('rate'), C('qty'), C('includedVolume'), C('unitPrice'), C('markupPct'), C('milestones'), C('start', 'start_date'), C('end', 'end_date'), C('vendorPOId', 'vendor_po_id'), C('matchFlags')] },
  events: { table: 'billing_events', cols: [C('id'), C('lineId'), C('poId'), C('clientId'), C('period'), C('label'), C('dueDate'), C('expectedAmount'), C('currency'), C('evidenceRequired'), C('evidence'), C('coc'), C('cocSentOn'), C('invoiceId'), C('note'), C('noPoCover')] },
  invoices: { table: 'invoices', cols: [C('id'), C('clientId'), C('poId'), C('eventIds'), C('date', 'invoice_date'), C('dueDate'), C('currency'), C('net'), C('vat'), C('gross'), C('status'), C('zatca'), C('zatcaReason'), C('erpRef'), C('creditNoteOf'), C('billedRate'), C('description')] },
  bankAccounts: { table: 'bank_accounts', cols: ['id', 'bank', 'label', 'iban', 'currency', 'openingLedger', 'openingStatement', 'reconciledThrough', 'signedOff'].map((f) => C(f)) },
  bankLines: { table: 'bank_lines', cols: [C('id'), C('accountId'), C('date', 'line_date'), C('description'), C('rawDescription'), C('amount'), C('direction'), C('type'), C('reference'), C('matchedLedgerId'), C('receiptId'), C('source')] },
  ledger: { table: 'ledger_entries', cols: [C('id'), C('accountId'), C('date', 'entry_date'), C('kind'), C('description'), C('amount'), C('reference'), C('matchedBankLineId')] },
  receipts: { table: 'cash_receipts', cols: ['id', 'bankLineId', 'clientId', 'invoiceIds', 'amount', 'method', 'confidence', 'status', 'note', 'shortfall'].map((f) => C(f)) },
  vendorPOs: { table: 'vendor_pos', cols: [C('id'), C('vendor'), C('clientPOLineId', 'client_po_line_id'), C('value'), C('costCategory'), C('consumed')] },
  vendorInvoices: { table: 'vendor_invoices', cols: [C('id'), C('vendorKey'), C('vendorName'), C('invoiceRef'), C('issueDate'), C('dueDate'), C('currency'), C('net'), C('vat'), C('total'), C('vendorPOId', 'vendor_po_id'), C('clientPOLineId', 'client_po_line_id'), C('matchStatus'), C('matchNote'), C('lineItems'), C('source'), C('cognidocsJobId')] },
  budget: { table: 'budget', cols: ['id', 'businessLine', 'month', 'budget', 'target', 'forecast'].map((f) => C(f)) },
  drivers: { table: 'variance_drivers', cols: ['id', 'businessLine', 'kind', 'amount', 'explanation', 'provenance'].map((f) => C(f)) },
  opportunities: { table: 'opportunities', cols: ['id', 'clientId', 'name', 'businessLine', 'stage', 'amount', 'recurring', 'probability', 'expectedStart', 'termMonths', 'owner', 'note'].map((f) => C(f)) },
  pipeline: { table: 'pipeline', cols: ['id', 'businessLine', 'month', 'weighted', 'label'].map((f) => C(f)) },
  closeItems: { table: 'close_items', cols: [C('id'), C('number'), C('group', 'group_name'), C('workstream'), C('title'), C('owner'), C('agentId'), C('deadline'), C('dueDay'), C('tasamaAutomation'), C('coverage'), C('status'), C('blocker'), C('evidence'), C('derivedFrom')] },
  journals: { table: 'journals', cols: ['id', 'kind', 'description', 'lines', 'proposedBy', 'status', 'period', 'erpRef'].map((f) => C(f)) },
  findings: { table: 'findings', cols: ['id', 'agentId', 'kind', 'clientId', 'amount', 'summary', 'detail', 'recordRef', 'acknowledged', 'resolvedBy'].map((f) => C(f)) },
  dunning: { table: 'dunning', cols: ['id', 'invoiceId', 'clientId', 'stage', 'proposedStage', 'draft', 'status', 'promiseToPay', 'dispute'].map((f) => C(f)) },
  jobs: { table: 'parse_jobs', cols: [C('id'), C('declaredType'), C('detectedType'), C('status'), C('fileName'), C('mimeType'), C('fileSizeBytes'), C('startedAt'), C('parserPath'), C('confidence'), C('error'), C('aiPromptTokens'), C('aiCompletionTokens'), C('aiCostAmount10k', 'ai_cost_amount_10k'), C('sandbox'), C('result'), C('createdAt'), C('completedAt'), C('mode'), C('routedTo')] },
  trail: { table: 'trail', cols: ['id', 'at', 'actor', 'kind', 'autonomy', 'summary', 'detail', 'recordRef', 'override'].map((f) => C(f)) },
  expenses: { table: 'expenses', cols: [C('id'), C('clientId'), C('description'), C('amount'), C('date', 'expense_date'), C('status'), C('jobId')] },
};
/** Tables whose domain rows carry no id: one is derived for the primary key and stripped on load. */
const SYNTHETIC_ID = new Set(['budget', 'drivers', 'pipeline']);
const JSON_COLS = new Set(['po_lines.milestones', 'po_lines.match_flags', 'billing_events.evidence_required', 'billing_events.evidence', 'invoices.event_ids', 'cash_receipts.invoice_ids', 'vendor_invoices.line_items', 'journals.lines', 'parse_jobs.result', 'trail.actor', 'trail.override']);

/** Flatten the world into table → rows (plain objects keyed by field). */
function tables(world: World): Record<string, Record<string, unknown>[]> {
  const t: Record<string, Record<string, unknown>[]> = {};
  const w = world as unknown as Record<string, unknown[]>;
  for (const key of Object.keys(SPECS)) if (!SYNTHETIC_ID.has(key) && key !== 'poLines') t[key] = (w[key] as Record<string, unknown>[]) ?? [];
  t.pos = world.pos.map(({ lines: _lines, ...p }) => p as unknown as Record<string, unknown>);
  t.poLines = world.pos.flatMap((p) => p.lines as unknown as Record<string, unknown>[]);
  t.budget = world.budget.map((b) => ({ id: `${b.businessLine}/${b.month}`, ...b }));
  t.drivers = world.drivers.map((d, i) => ({ id: `drv-${i + 1}`, ...d }));
  t.pipeline = world.pipeline.map((p, i) => ({ id: `pipe-${i + 1}`, ...p }));
  return t;
}

function toRow(spec: Spec, obj: Record<string, unknown>, position: number) {
  const row: Record<string, unknown> = {};
  for (const c of spec.cols) {
    let v = obj[c.field];
    if (v === undefined) v = null;
    if (JSON_COLS.has(`${spec.table}.${c.col}`) && v !== null) v = JSON.stringify(v);
    row[c.col] = v;
  }
  row.position = position; // every table keeps the domain's array order
  return row;
}

/** Fields the domain types as `| null` (everything else nullable is optional and is simply omitted when null). */
const NULL_TYPED: Record<string, Set<string>> = {
  clients: new Set(['vatNo']),
  contracts: new Set(['totalValue']),
  cash_receipts: new Set(['clientId']),
  close_items: new Set(['agentId']),
  parse_jobs: new Set(['detectedType', 'mimeType', 'fileSizeBytes', 'startedAt', 'parserPath', 'confidence', 'error', 'aiPromptTokens', 'aiCompletionTokens', 'aiCostAmount10k', 'result', 'completedAt']),
};

function fromRow(spec: Spec, row: Record<string, unknown>) {
  const obj: Record<string, unknown> = {};
  const nullTyped = NULL_TYPED[spec.table];
  for (const c of spec.cols) {
    const v = row[c.col];
    if (v === null) { if (nullTyped?.has(c.field)) obj[c.field] = null; continue; }
    obj[c.field] = v;
  }
  return obj;
}

export async function ensureSchema() {
  const sql = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8');
  await pool.query(sql);
}

/** Bumped when the seed's shape changes in a way an existing database cannot carry (new tables or columns the old rows lack). A mismatch re-seeds on start. */
export const SEED_VERSION = 2;

export async function isSeeded(): Promise<boolean> {
  const r = await pool.query(`select value from mizan.world_meta where key = 'seedVersion'`);
  return r.rowCount! > 0 && Number(r.rows[0].value) === SEED_VERSION;
}

export async function reseed(): Promise<World> {
  const world = buildWorld();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`truncate ${Object.values(SPECS).map((s) => 'mizan.' + s.table).join(', ')}, mizan.world_meta`);
    const t = tables(world);
    for (const [key, spec] of Object.entries(SPECS)) {
      const rows = t[key] ?? [];
      for (let i = 0; i < rows.length; i++) await insert(client, spec, toRow(spec, rows[i], i));
    }
    await writeMeta(client, world);
    await client.query('commit');
  } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
  return world;
}

async function insert(client: pg.PoolClient, spec: Spec, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  const vals = cols.map((c) => row[c]);
  const sets = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ');
  await client.query(`insert into mizan.${spec.table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) on conflict (id) do update set ${sets}`, vals);
}

async function writeMeta(client: pg.PoolClient, world: World) {
  const meta: Record<string, unknown> = { asOf: world.asOf, closingPeriod: world.closingPeriod, closeDay: world.closeDay, flags: world.flags, settings: world.settings, seedVersion: SEED_VERSION };
  for (const [k, v] of Object.entries(meta)) await client.query(`insert into mizan.world_meta (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value`, [k, JSON.stringify(v)]);
}

export async function loadWorld(): Promise<World> {
  const meta = Object.fromEntries((await pool.query(`select key, value from mizan.world_meta`)).rows.map((r) => [r.key, r.value]));
  const out: Record<string, unknown> = { asOf: meta.asOf, closingPeriod: meta.closingPeriod, closeDay: meta.closeDay, flags: meta.flags, settings: meta.settings };
  const loaded: Record<string, Record<string, unknown>[]> = {};
  for (const [key, spec] of Object.entries(SPECS)) {
    const r = await pool.query(`select * from mizan.${spec.table} order by position`);
    loaded[key] = r.rows.map((row) => fromRow(spec, row));
  }
  const linesByPo: Record<string, Record<string, unknown>[]> = {};
  for (const l of loaded.poLines) (linesByPo[String(l.poId)] ??= []).push(l);
  for (const [key, rows] of Object.entries(loaded)) {
    if (key === 'poLines') continue;
    if (key === 'pos') out.pos = rows.map((p) => ({ ...p, lines: linesByPo[String(p.id)] ?? [] }));
    else if (SYNTHETIC_ID.has(key)) out[key] = rows.map(({ id: _id, ...rest }) => rest);
    else out[key] = rows;
  }
  return out as unknown as World;
}

/** Persist what changed between two worlds. */
export async function saveWorld(prev: World, next: World) {
  const a = tables(prev); const b = tables(next);
  const client = await pool.connect();
  try {
    await client.query('begin');
    // Parents before children; deletions children before parents.
    const order = Object.keys(SPECS);
    const deletions: { spec: Spec; ids: string[] }[] = [];
    for (const key of order) {
      const spec = SPECS[key];
      const before = new Map(a[key].map((r, i) => [String(r.id), JSON.stringify(toRow(spec, r, i))]));
      const afterIds = new Set<string>();
      for (let i = 0; i < b[key].length; i++) {
        const row = toRow(spec, b[key][i], i); const id = String(row.id); afterIds.add(id);
        if (before.get(id) !== JSON.stringify(row)) await insert(client, spec, row);
      }
      const gone = [...before.keys()].filter((id) => !afterIds.has(id));
      if (gone.length) deletions.push({ spec, ids: gone });
    }
    for (const d of deletions.reverse()) await client.query(`delete from mizan.${d.spec.table} where id = any($1)`, [d.ids]);
    await writeMeta(client, next);
    await client.query('commit');
  } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
}
