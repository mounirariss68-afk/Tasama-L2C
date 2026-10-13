/**
 * Application state. The world lives on the server (PostgreSQL) and every
 * change is an Action sent to POST /api/actions; the server applies the
 * domain reducer and returns the new world. The screens never mutate.
 *
 * Two homes for the same reducer:
 *   server  — the normal case: the served app talks to /api; other browsers
 *             see the same world (polled every few seconds).
 *   local   — the standalone HTML file, or a server without a database:
 *             applyAction runs in the browser and the world is kept in
 *             localStorage so a reload does not lose the demo.
 *
 * Browser-only state: who you are (persona), the client lens, navigation,
 * the CogniDocs API key (never sent to the server's store), and the Demo
 * Director — the scenario being played, its step, and what the last step
 * changed.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DunningStage, ParseJob, Settings, World } from '@mizan/domain/types';
import { buildWorld, demoNow } from '@mizan/domain/world';
import { applyAction, type Action, type ActionResult } from '@mizan/domain/actions';
import { PERSONAS, personaById, type PersonaDef, type Section } from '@mizan/domain/personas';
import { invoiceOf, lineOf } from '@mizan/domain/derive';
import { SAMPLE_DOCS } from '@mizan/domain/cognidocs';
import { SCENARIOS, scenarioByKey, type DirectorStep, type ScreenRef } from '@mizan/domain/scenarios';

const LOCAL_WORLD = 'mizan-local-world-v5';
const LOCAL_PERSONA = 'mizan-persona';
const LOCAL_KEY = 'mizan-cognidocs-key';
const POLL_MS = 4000;
const AUTO_MS = 11000;

const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
const lsDel = (k: string) => { try { localStorage.removeItem(k); } catch { /* private mode */ } };

export type BackendMode = 'connecting' | 'server' | 'local';
export type Backend = {
  mode: BackendMode;
  /** 'postgresql' when the server owns the world; null in local mode. */
  db: string | null;
  /** Why the app is in local mode, when it is not by design (standalone file). */
  reason: string | null;
  /** Whether the server has COGNIDOCS_BASE_URL/COGNIDOCS_API_KEY in its environment. */
  cognidocsConfigured: boolean;
  /** Served from a web server (true) or opened as a file (false). */
  served: boolean;
  /** Last request failure, for the header notice. */
  notice: string | null;
  rev: number;
  busy: boolean;
};

/** One line of "what changed" after a Director step, with where to look. */
export type Change = { key: string; label: string; screen: ScreenRef };

export type Director = {
  key: string; name: string; shape: string; steps: DirectorStep[];
  /** -1 before the first step. */
  index: number;
  status: 'running' | 'done';
  busy: boolean; auto: boolean;
  result: string | null; error: string | null;
  changes: Change[];
};

export type Actions = {
  releaseInvoice: (id: string) => Promise<unknown>;
  rejectDraft: (id: string, reason: string) => Promise<unknown>;
  draftForEvent: (eventId: string) => Promise<string | null>;
  runBillingRun: () => Promise<number>;
  fixZatca: (invoiceId: string, vatNo: string) => Promise<unknown>;
  sendCoc: (eventId: string) => Promise<unknown>;
  escalateCoc: (eventId: string) => Promise<unknown>;
  signCoc: (eventId: string) => Promise<unknown>;
  approveDunning: (id: string, stage?: DunningStage, reason?: string) => Promise<unknown>;
  holdDunning: (id: string, reason: string) => Promise<unknown>;
  applyReceipt: (id: string) => Promise<unknown>;
  rejectReceipt: (id: string, reason: string) => Promise<unknown>;
  approveVendor: (id: string) => Promise<unknown>;
  rejectVendor: (id: string, reason: string) => Promise<unknown>;
  approveJournal: (id: string) => Promise<unknown>;
  signOffBankRec: (accountId: string) => Promise<unknown>;
  acknowledgeFinding: (id: string) => Promise<unknown>;
  confirmSchedule: (poId: string) => Promise<unknown>;
  acceptReforecast: () => Promise<unknown>;
  completeCloseItem: (id: string) => Promise<unknown>;
  closePeriod: () => Promise<unknown>;
  receivePayrollRegister: () => Promise<unknown>;
  approvePayroll: (id: string) => Promise<unknown>;
  prepareVatReturn: () => Promise<unknown>;
  approveVatReturn: (id: string) => Promise<unknown>;
  recordPoCover: (eventId: string, poRef: string, validTo: string) => Promise<unknown>;
  readBackErpJobs: () => Promise<unknown>;
  addJob: (job: ParseJob) => Promise<unknown>;
  updateJob: (job: ParseJob) => Promise<unknown>;
  routeJob: (job: ParseJob) => Promise<unknown>;
  logPersonTrail: (summary: string, detail?: string, recordRef?: string) => Promise<unknown>;
};

type Ctx = {
  world: World;
  backend: Backend; clearNotice: () => void;
  persona: PersonaDef; setPersona: (id: string) => void;
  section: Section; go: (s: Section, focus?: string, tab?: string) => void; open: (ref: ScreenRef) => void; focus: string | null; setFocus: (f: string | null) => void; tab: string | null;
  clientLens: string | null; setClientLens: (id: string | null) => void;
  settings: Settings; setSettings: (s: Partial<Settings>) => void; setCogniDocs: (c: Partial<Settings['cognidocs']>) => void;
  apiKey: string; setApiKey: (k: string) => void;
  nav: Section[];
  dispatch: (action: Action) => Promise<ActionResult>;
  confirmAssistantAction: (token: string) => Promise<{ created?: string; count?: number }>;
  actions: Actions;
  director: Director | null; startScenario: (key: string) => void; stepScenario: (dir: 1 | -1) => Promise<void>; stopScenario: () => void; setAuto: (b: boolean) => void;
  /** Record ids the Director touched in the last step — screens may highlight them. */
  highlight: Set<string>;
  reset: () => Promise<void>;
};

const AppContext = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(AppContext); if (!c) throw new Error('useApp outside AppState'); return c; };

const nowIso = () => new Date().toISOString();

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body;
}

function loadLocalWorld(): World | null {
  const raw = lsGet(LOCAL_WORLD); if (!raw) return null;
  try { const w = JSON.parse(raw) as World; return w && Array.isArray(w.invoices) && w.settings && w.flags ? w : null; } catch { return null; }
}

/** What a Director step changed, in the words of the records: diffed, not narrated. */
function diffWorlds(a: World, b: World): Change[] {
  const out: Change[] = [];
  const invA = new Map(a.invoices.map((i) => [i.id, i]));
  for (const i of b.invoices) {
    const p = invA.get(i.id);
    if (!p) out.push({ key: `inv+${i.id}`, label: `${i.id} drafted — ${i.currency} ${i.gross.toLocaleString('en-US')}`, screen: { section: 'inbox', focus: `rel:${i.id}` } });
    else if (p.status !== i.status || p.zatca !== i.zatca) out.push({ key: `inv~${i.id}`, label: `${i.id} → ${i.status}${i.zatca !== p.zatca ? ` · ZATCA ${i.zatca}` : ''}${i.erpRef && !p.erpRef ? ` · ${i.erpRef}` : ''}`, screen: { section: 'l2c', tab: 'collections' } });
  }
  const evA = new Map(a.events.map((e) => [e.id, e]));
  for (const e of b.events) { const p = evA.get(e.id); if (p && p.coc !== e.coc) out.push({ key: `ev~${e.id}`, label: `${e.label.slice(0, 48)} — CoC ${e.coc}`, screen: { section: 'l2c', tab: 'billing' } }); }
  const rcA = new Map(a.receipts.map((r) => [r.id, r]));
  for (const r of b.receipts) { const p = rcA.get(r.id); if (!p) out.push({ key: `rc+${r.id}`, label: `${r.id} receipt ${r.status} — SAR ${r.amount.toLocaleString('en-US')}`, screen: { section: 'inbox', focus: `cash:${r.id}` } }); else if (p.status !== r.status) out.push({ key: `rc~${r.id}`, label: `${r.id} → ${r.status}`, screen: { section: 'close', tab: 'bank' } }); }
  const jeA = new Map(a.journals.map((j) => [j.id, j]));
  for (const j of b.journals) { const p = jeA.get(j.id); if (p && p.status !== j.status) out.push({ key: `je~${j.id}`, label: `${j.id} ${j.kind} → ${j.status}${j.erpRef ? ` (${j.erpRef})` : ''}`, screen: { section: 'close', tab: 'journals' } }); }
  const viA = new Map(a.vendorInvoices.map((v) => [v.id, v]));
  for (const v of b.vendorInvoices) { const p = viA.get(v.id); if (!p) out.push({ key: `vi+${v.id}`, label: `${v.vendorName} ${v.invoiceRef} — ${v.matchStatus}`, screen: { section: 'inbox', focus: `vend:${v.id}` } }); else if (p.matchStatus !== v.matchStatus) out.push({ key: `vi~${v.id}`, label: `${v.vendorName} ${v.invoiceRef} → ${v.matchStatus}`, screen: { section: 'inbox' } }); }
  const jobA = new Set(a.jobs.map((j) => j.id));
  for (const j of b.jobs) if (!jobA.has(j.id)) out.push({ key: `job+${j.id}`, label: `CogniDocs job ${j.fileName} — ${j.routedTo ?? j.status}`, screen: { section: 'documents', focus: j.id } });
  const baA = new Map(a.bankAccounts.map((x) => [x.id, x]));
  for (const x of b.bankAccounts) { const p = baA.get(x.id); if (p && p.signedOff !== x.signedOff) out.push({ key: `ba~${x.id}`, label: `${x.bank} reconciliation signed off`, screen: { section: 'close', tab: 'bank' } }); }
  const fA = new Map(a.findings.map((f) => [f.id, f]));
  for (const f of b.findings) { const p = fA.get(f.id); if (p && !p.acknowledged && f.acknowledged) out.push({ key: `f~${f.id}`, label: `Finding ${f.kind} resolved${f.resolvedBy ? ` by ${f.resolvedBy}` : ''}`, screen: { section: 'agents', tab: 'trail' } }); }
  const prA = new Map(a.payrollRuns.map((r) => [r.id, r]));
  for (const r of b.payrollRuns) { const p = prA.get(r.id); if (p && p.status !== r.status) out.push({ key: `pr~${r.id}`, label: `Payroll ${r.period} → ${r.status}${r.status === 'received' ? ` · proof ${r.proof && r.proof.bankTies && r.proof.glTies && r.proof.headcountTies ? 'passed' : 'failed'}` : ''}`, screen: { section: 'close', tab: 'payroll' } }); }
  const vrA = new Map(a.vatReturns.map((v) => [v.id, v]));
  for (const v of b.vatReturns) { const p = vrA.get(v.id); if (p && p.status !== v.status) out.push({ key: `vr~${v.id}`, label: `VAT return ${v.period} → ${v.status}${v.figures ? ` · SAR ${v.figures.netPayable.toLocaleString('en-US')} payable` : ''}`, screen: { section: 'close', tab: 'vat' } }); }
  const ejA = new Map(a.erpJobs.map((j) => [j.id, j]));
  for (const j of b.erpJobs) { const p = ejA.get(j.id); if (p && p.status !== j.status) out.push({ key: `ej~${j.id}`, label: `P${j.procedure} ${j.name} → ${j.status}`, screen: { section: 'close', tab: 'checklist', focus: `P${String(j.procedure).padStart(2, '0')}` } }); }
  const inA = new Map(a.inputs.map((i) => [i.id, i]));
  for (const i of b.inputs) { const p = inA.get(i.id); if (p && !p.receivedOn && i.receivedOn) out.push({ key: `in~${i.id}`, label: `Input received — ${i.department.toUpperCase()}: ${i.what.split(':')[0]}`, screen: { section: 'close', tab: 'checklist', focus: 'P01' } }); }
  for (const e of b.events) { const p = evA.get(e.id); if (p && p.noPoCover && !e.noPoCover) out.push({ key: `ev-po~${e.id}`, label: `${e.label.slice(0, 48)} — PO cover restored`, screen: { section: 'l2c', tab: 'billing' } }); }
  const drA = a.drivers.map((d) => d.amount).join(); if (drA !== b.drivers.map((d) => d.amount).join()) out.push({ key: 'drv', label: 'Variance driver updated', screen: { section: 'close', tab: 'budget' } });
  if (a.flags.reforecastAccepted !== b.flags.reforecastAccepted) out.push({ key: 'fl-refc', label: 'Reforecast accepted — FY2026 forecast re-cut', screen: { section: 'close', tab: 'budget' } });
  if (a.flags.periodClosed !== b.flags.periodClosed) out.push({ key: 'fl-close', label: `${b.closingPeriod} closed`, screen: { section: 'close', tab: 'checklist' } });
  const trail = b.trail.length - a.trail.length;
  if (trail > 0) out.push({ key: 'trail', label: `trail +${trail}`, screen: { section: 'agents', tab: 'trail' } });
  return out;
}

export function AppState({ children }: { children: ReactNode }) {
  const served = typeof location !== 'undefined' && location.protocol !== 'file:';
  const [world, setWorldState] = useState<World>(() => (served ? buildWorld() : loadLocalWorld() ?? buildWorld()));
  const worldRef = useRef(world);
  const [backend, setBackend] = useState<Backend>(() => ({ mode: served ? 'connecting' : 'local', db: null, reason: null, cognidocsConfigured: false, served, notice: null, rev: 0, busy: false }));
  const modeRef = useRef<BackendMode>(backend.mode);
  const revRef = useRef(0);
  const inFlight = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const [personaId, setPersonaIdState] = useState(() => { const s = lsGet(LOCAL_PERSONA); return s && PERSONAS.some((p) => p.id === s) ? s : 'faisal'; });
  const personaRef = useRef(personaId);
  const [apiKey, setApiKeyState] = useState(() => lsGet(LOCAL_KEY) ?? '');
  const [section, setSection] = useState<Section>('overview');
  const [focus, setFocus] = useState<string | null>(null);
  const [tab, setTab] = useState<string | null>(null);
  const [clientLens, setClientLens] = useState<string | null>(null);
  const [director, setDirector] = useState<Director | null>(null);
  const directorRef = useRef<Director | null>(null);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const autoTimer = useRef<number | null>(null);

  const persona = personaById(personaId);
  const nav = persona.nav;
  useEffect(() => { if (!nav.includes(section)) setSection(nav[0]); }, [nav, section]);

  const setWorld = useCallback((w: World, rev?: number) => {
    worldRef.current = w; setWorldState(w);
    if (rev !== undefined) { revRef.current = rev; setBackend((b) => ({ ...b, rev })); }
    if (modeRef.current === 'local') lsSet(LOCAL_WORLD, JSON.stringify(w));
  }, []);

  const goLocal = useCallback((reason: string | null, cognidocsConfigured = false) => {
    modeRef.current = 'local';
    const w = loadLocalWorld() ?? buildWorld();
    worldRef.current = w; setWorldState(w);
    setBackend((b) => ({ ...b, mode: 'local', db: null, reason, cognidocsConfigured }));
  }, []);

  /* ------------------------------------------------------ connect */
  useEffect(() => {
    if (!served) return;
    let cancelled = false;
    (async () => {
      try {
        const h = await api<{ ok: boolean; db: string | null; dbReason?: string; rev: number | null; cognidocs: string }>('/api/health');
        if (cancelled) return;
        if (h.db) {
          const w = await api<World>('/api/world');
          if (cancelled) return;
          modeRef.current = 'server'; revRef.current = h.rev ?? w.flags.rev;
          worldRef.current = w; setWorldState(w);
          setBackend((b) => ({ ...b, mode: 'server', db: h.db, reason: null, cognidocsConfigured: h.cognidocs === 'configured', rev: revRef.current }));
        } else {
          goLocal(h.dbReason ?? 'The server has no database configured.', h.cognidocs === 'configured');
        }
      } catch (e) {
        if (!cancelled) goLocal(`No Mizan server reachable (${(e as Error).message}); running in this browser only.`);
      }
    })();
    return () => { cancelled = true; };
  }, [served, goLocal]);

  /* ------------------------------------------------------ poll for changes made elsewhere */
  useEffect(() => {
    if (backend.mode !== 'server') return;
    const h = window.setInterval(async () => {
      if (document.hidden || inFlight.current > 0) return;
      try {
        const { rev } = await api<{ rev: number }>('/api/rev');
        if (rev !== revRef.current && inFlight.current === 0) { const w = await api<World>('/api/world'); if (inFlight.current === 0) setWorld(w, rev); }
      } catch { /* transient; the next tick retries */ }
    }, POLL_MS);
    return () => window.clearInterval(h);
  }, [backend.mode, setWorld]);

  /* ------------------------------------------------------ dispatch */
  const dispatch = useCallback((action: Action): Promise<ActionResult> => {
    const run = async (): Promise<ActionResult> => {
      inFlight.current++; setBackend((b) => ({ ...b, busy: true }));
      try {
        if (modeRef.current === 'server') {
          const r = await api<{ world: World; created?: string; count?: number; error?: string; rev: number }>('/api/actions', { method: 'POST', body: JSON.stringify({ action, personaId: personaRef.current }) });
          setWorld(r.world, r.rev);
          return { world: r.world, created: r.created, count: r.count, error: r.error };
        }
        const result = applyAction(worldRef.current, action, { personaId: personaRef.current, now: demoNow(worldRef.current) });
        if (!result.error) setWorld(result.world);
        return result;
      } catch (e) {
        setBackend((b) => ({ ...b, notice: (e as Error).message }));
        return { world: worldRef.current, error: (e as Error).message };
      } finally {
        inFlight.current--; if (inFlight.current === 0) setBackend((b) => ({ ...b, busy: false }));
      }
    };
    const p = queue.current.then(run, run);
    queue.current = p.then(() => undefined, () => undefined);
    return p;
  }, [setWorld]);

  const confirmAssistantAction = useCallback(async (token: string) => {
    if (modeRef.current !== 'server') throw new Error('Muhasib actions require the connected server, not a browser-only world.');
    const run = async () => {
      inFlight.current++; setBackend((b) => ({ ...b, busy: true }));
      try {
        const result = await api<{ world: World; rev: number; created?: string; count?: number }>('/api/assistant/confirm', { method: 'POST', body: JSON.stringify({ token, personaId: personaRef.current }) });
        setWorld(result.world, result.rev);
        return { created: result.created, count: result.count };
      } finally {
        inFlight.current--; if (!inFlight.current) setBackend((b) => ({ ...b, busy: false }));
      }
    };
    const pending = queue.current.then(run, run);
    queue.current = pending.then(() => undefined, () => undefined);
    return pending;
  }, [setWorld]);

  const actions: Actions = useMemo(() => ({
    releaseInvoice: (id) => dispatch({ type: 'releaseInvoice', id }),
    rejectDraft: (id, reason) => dispatch({ type: 'rejectDraft', id, reason }),
    draftForEvent: async (eventId) => (await dispatch({ type: 'draftForEvent', eventId })).created ?? null,
    runBillingRun: async () => (await dispatch({ type: 'runBillingRun' })).count ?? 0,
    fixZatca: (invoiceId, vatNo) => dispatch({ type: 'fixZatca', invoiceId, vatNo }),
    sendCoc: (eventId) => dispatch({ type: 'sendCoc', eventId }),
    escalateCoc: (eventId) => dispatch({ type: 'escalateCoc', eventId }),
    signCoc: (eventId) => dispatch({ type: 'signCoc', eventId }),
    approveDunning: (id, stage, reason) => dispatch({ type: 'approveDunning', id, stage, reason }),
    holdDunning: (id, reason) => dispatch({ type: 'holdDunning', id, reason }),
    applyReceipt: (id) => dispatch({ type: 'applyReceipt', id }),
    rejectReceipt: (id, reason) => dispatch({ type: 'rejectReceipt', id, reason }),
    approveVendor: (id) => dispatch({ type: 'approveVendor', id }),
    rejectVendor: (id, reason) => dispatch({ type: 'rejectVendor', id, reason }),
    approveJournal: (id) => dispatch({ type: 'approveJournal', id }),
    signOffBankRec: (accountId) => dispatch({ type: 'signOffBankRec', accountId }),
    acknowledgeFinding: (id) => dispatch({ type: 'acknowledgeFinding', id }),
    confirmSchedule: (poId) => dispatch({ type: 'confirmSchedule', poId }),
    acceptReforecast: () => dispatch({ type: 'acceptReforecast' }),
    completeCloseItem: (id) => dispatch({ type: 'completeCloseItem', id }),
    closePeriod: () => dispatch({ type: 'closePeriod' }),
    receivePayrollRegister: () => dispatch({ type: 'receivePayrollRegister' }),
    approvePayroll: (id) => dispatch({ type: 'approvePayroll', id }),
    prepareVatReturn: () => dispatch({ type: 'prepareVatReturn' }),
    approveVatReturn: (id) => dispatch({ type: 'approveVatReturn', id }),
    recordPoCover: (eventId, poRef, validTo) => dispatch({ type: 'recordPoCover', eventId, poRef, validTo }),
    readBackErpJobs: () => dispatch({ type: 'readBackErpJobs' }),
    addJob: (job) => dispatch({ type: 'addJob', job }),
    updateJob: (job) => dispatch({ type: 'updateJob', job }),
    routeJob: (job) => dispatch({ type: 'routeJob', jobId: job.id }),
    logPersonTrail: (summary, detail, recordRef) => dispatch({ type: 'logPersonTrail', summary, detail, recordRef }),
  }), [dispatch]);

  /* ------------------------------------------------------ browser-only state */
  const setPersona = useCallback((id: string) => { personaRef.current = id; setPersonaIdState(id); lsSet(LOCAL_PERSONA, id); }, []);
  const setApiKey = useCallback((k: string) => { setApiKeyState(k); if (k) lsSet(LOCAL_KEY, k); else lsDel(LOCAL_KEY); }, []);
  const go = useCallback((s: Section, f?: string, t?: string) => { setSection(s); setFocus(f ?? null); setTab(t ?? null); }, []);
  const open = useCallback((ref: ScreenRef) => { if (ref.clientLens !== undefined) setClientLens(ref.clientLens); setSection(ref.section); setFocus(ref.focus ?? null); setTab(ref.tab ?? null); }, []);
  const setSettings = useCallback((patch: Partial<Settings>) => { void dispatch({ type: 'updateSettings', patch }); }, [dispatch]);
  const setCogniDocs = useCallback((c: Partial<Settings['cognidocs']>) => { void dispatch({ type: 'updateSettings', patch: { cognidocs: c } }); }, [dispatch]);
  const clearNotice = useCallback(() => setBackend((b) => ({ ...b, notice: null })), []);

  /* ------------------------------------------------------ the Demo Director */
  const patchDirector = useCallback((fn: (d: Director) => Director) => { setDirector((d) => { if (!d) return d; const n = fn(d); directorRef.current = n; return n; }); }, []);

  /** Run one step's action against the live world; return what changed. */
  const runStep = useCallback(async (step: DirectorStep): Promise<{ result: string; error: string | null; changes: Change[] }> => {
    const before = worldRef.current;
    let error: string | null = null; let result = 'Shown';
    const a = step.action;
    const check = (r: ActionResult) => { if (r.error) error = r.error; return r; };
    try {
      switch (a.kind) {
        case 'show': break;
        case 'action': { const r = check(await dispatch(a.action)); result = r.error ? 'Refused' : r.created ? `Created ${r.created}` : r.count !== undefined ? `${r.count} record(s)` : 'Applied'; break; }
        case 'releaseAllDrafts': { const ids = worldRef.current.invoices.filter((i) => i.status === 'draft').map((i) => i.id); for (const id of ids) check(await dispatch({ type: 'releaseInvoice', id })); result = `${ids.length} invoice(s) released`; break; }
        case 'releaseForEvent': { const inv = worldRef.current.invoices.find((i) => i.status === 'draft' && i.eventIds.includes(a.eventId)); if (!inv) { error = 'No draft invoice for that event'; break; } check(await dispatch({ type: 'releaseInvoice', id: inv.id })); result = `${inv.id} released`; break; }
        case 'applyAllProposed': { const ids = worldRef.current.receipts.filter((r) => r.status === 'proposed').map((r) => r.id); for (const id of ids) check(await dispatch({ type: 'applyReceipt', id })); result = `${ids.length} receipt(s) applied`; break; }
        case 'approveAllJournals': { const ids = worldRef.current.journals.filter((j) => j.status === 'proposed').map((j) => j.id); for (const id of ids) check(await dispatch({ type: 'approveJournal', id })); result = `${ids.length} journal(s) posted`; break; }
        case 'approvePayrollJournals': { const run = worldRef.current.payrollRuns.find((r) => r.period === worldRef.current.closingPeriod); const ids = (run?.journalIds ?? []).filter((id) => worldRef.current.journals.find((j) => j.id === id)?.status === 'proposed'); if (!run || run.status === 'awaited') { error = 'The payroll register has not been received'; break; } for (const id of ids) check(await dispatch({ type: 'approveJournal', id })); result = `${ids.length} payroll journal(s) posted`; break; }
        case 'fixZatcaAll': { const ids = worldRef.current.invoices.filter((i) => i.zatca === 'rejected').map((i) => i.id); for (const id of ids) check(await dispatch({ type: 'fixZatca', invoiceId: id, vatNo: '300455000000003' })); result = ids.length ? `${ids.length} invoice(s) re-submitted and cleared` : 'Nothing rejected — already clear'; break; }
        case 'approveAllVendorMatches': { const ids = worldRef.current.vendorInvoices.filter((v) => v.matchStatus === 'proposed').map((v) => v.id); for (const id of ids) check(await dispatch({ type: 'approveVendor', id })); result = ids.length ? `${ids.length} match(es) approved and posted to AP` : 'No match waiting'; break; }
        case 'signOffAllBankRecs': { const ids = worldRef.current.bankAccounts.filter((a) => !a.signedOff).map((a) => a.id); for (const id of ids) check(await dispatch({ type: 'signOffBankRec', accountId: id })); result = ids.length ? `${ids.length} account(s) signed off` : 'Every account already signed'; break; }
        case 'upload': {
          const sample = SAMPLE_DOCS.find((s) => s.id === a.sample); if (!sample) { error = `No sample ${a.sample}`; break; }
          const job: ParseJob = { id: `DEMO-JOB-${Date.now().toString(16).slice(-6)}`, declaredType: sample.declaredType, detectedType: sample.declaredType, status: 'completed', fileName: sample.fileName, mimeType: 'application/pdf', fileSizeBytes: 48_211 + sample.id.length * 1000, startedAt: nowIso(), parserPath: sample.id.includes('statement') ? 'template_match' : 'vendor_template', confidence: 97, error: null, aiPromptTokens: 0, aiCompletionTokens: 0, aiCostAmount10k: 0, sandbox: true, result: sample.result(), createdAt: nowIso(), completedAt: nowIso(), mode: 'simulated' };
          check(await dispatch({ type: 'addJob', job })); check(await dispatch({ type: 'routeJob', jobId: job.id }));
          const routed = worldRef.current.jobs.find((j) => j.id === job.id)?.routedTo; result = routed ?? 'Routed';
          setFocus(job.id);
          break;
        }
      }
    } catch (e) { error = (e as Error).message; }
    return { result, error, changes: diffWorlds(before, worldRef.current) };
  }, [dispatch]);

  const showStep = useCallback((step: DirectorStep) => {
    if (step.persona && step.persona !== personaRef.current) setPersona(step.persona);
    open(step.screen);
  }, [open, setPersona]);

  const startScenario = useCallback((key: string) => {
    const sc = scenarioByKey(key); if (!sc) return;
    const why = sc.blocked(worldRef.current);
    const d: Director = { key: sc.key, name: sc.name, shape: sc.shape, steps: sc.steps, index: -1, status: 'running', busy: false, auto: false, result: null, error: why, changes: [] };
    directorRef.current = d; setDirector(d); setHighlight(new Set());
  }, []);

  const stepScenario = useCallback(async (dir: 1 | -1) => {
    const d = directorRef.current; if (!d || d.busy) return;
    const next = d.index + dir; if (next < 0 || next >= d.steps.length) return;
    const step = d.steps[next];
    if (dir === -1) { patchDirector((x) => ({ ...x, index: next, result: 'Showing again (back)', error: null, changes: [], status: 'running' })); showStep(step); return; }
    patchDirector((x) => ({ ...x, index: next, busy: true, error: null, result: null, changes: [] }));
    showStep(step);
    const r = await runStep(step);
    // the screen may depend on what the step created (a drafted invoice, a job)
    if (step.action.kind !== 'show' && step.screen.section === 'inbox' && !step.screen.focus) { const created = r.changes.find((c) => c.key.startsWith('inv+')); if (created) setFocus(created.screen.focus ?? null); }
    setHighlight(new Set(r.changes.map((c) => c.key.replace(/^[a-z]+[+~]/, ''))));
    patchDirector((x) => ({ ...x, busy: false, result: r.result, error: r.error, changes: r.changes, status: next >= x.steps.length - 1 ? 'done' : 'running' }));
  }, [patchDirector, runStep, showStep]);

  const stopScenario = useCallback(() => { directorRef.current = null; setDirector(null); setHighlight(new Set()); if (autoTimer.current) window.clearTimeout(autoTimer.current); }, []);
  const setAuto = useCallback((b: boolean) => patchDirector((d) => ({ ...d, auto: b })), [patchDirector]);
  useEffect(() => {
    if (!director?.auto || director.busy || director.status !== 'running' || director.error) return;
    autoTimer.current = window.setTimeout(() => { void stepScenario(1); }, AUTO_MS);
    return () => { if (autoTimer.current) window.clearTimeout(autoTimer.current); };
  }, [director?.auto, director?.busy, director?.index, director?.status, director?.error, stepScenario]);

  const reset = useCallback(async () => {
    stopScenario(); setClientLens(null); setFocus(null);
    const run = async () => {
      inFlight.current++;
      try {
        if (modeRef.current === 'server') { const r = await api<{ world: World; rev: number }>('/api/reset', { method: 'POST' }); setWorld(r.world, r.rev); }
        else { lsDel(LOCAL_WORLD); setWorld(buildWorld()); }
      } catch (e) { setBackend((b) => ({ ...b, notice: (e as Error).message })); }
      finally { inFlight.current--; }
    };
    const p = queue.current.then(run, run);
    queue.current = p.then(() => undefined, () => undefined);
    await p;
  }, [setWorld, stopScenario]);

  const value: Ctx = {
    world, backend, clearNotice, persona, setPersona, section, go, open, focus, setFocus, tab, clientLens, setClientLens,
    settings: world.settings, setSettings, setCogniDocs, apiKey, setApiKey,
    nav, dispatch, confirmAssistantAction, actions, director, startScenario, stepScenario, stopScenario, setAuto, highlight, reset,
  };
  if (backend.mode === 'connecting') return <Connecting />;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function Connecting() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
      <div className="text-center"><div className="font-serif text-2xl">Mizan</div><div className="mt-2 text-xs text-muted-foreground">Connecting to the server…</div></div>
    </div>
  );
}

export { PERSONAS, SCENARIOS, lineOf, invoiceOf };
