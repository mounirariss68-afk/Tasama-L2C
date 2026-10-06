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
 * and the CogniDocs API key (never sent to the server's store).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DunningStage, ParseJob, Settings, World } from '@mizan/domain/types';
import { buildWorld } from '@mizan/domain/world';
import { applyAction, type Action, type ActionResult } from '@mizan/domain/actions';
import { PERSONAS, personaById, type PersonaDef, type Section } from '@mizan/domain/personas';
import { invoiceOf, lineOf } from '@mizan/domain/derive';
import { SAMPLE_DOCS } from '@mizan/domain/cognidocs';

const LOCAL_WORLD = 'mizan-local-world-v4';
const LOCAL_PERSONA = 'mizan-persona';
const LOCAL_KEY = 'mizan-cognidocs-key';
const POLL_MS = 4000;

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

export type ScenarioRun = { id: string; state: 'idle' | 'running' | 'complete'; log: string[] };

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
  addJob: (job: ParseJob) => Promise<unknown>;
  updateJob: (job: ParseJob) => Promise<unknown>;
  routeJob: (job: ParseJob) => Promise<unknown>;
  logPersonTrail: (summary: string, detail?: string, recordRef?: string) => Promise<unknown>;
};

type Ctx = {
  world: World;
  backend: Backend; clearNotice: () => void;
  persona: PersonaDef; setPersona: (id: string) => void;
  section: Section; go: (s: Section, focus?: string, tab?: string) => void; focus: string | null; setFocus: (f: string | null) => void; tab: string | null;
  clientLens: string | null; setClientLens: (id: string | null) => void;
  closePeriodContext: string; setClosePeriodContext: (period: string) => void;
  settings: Settings; setSettings: (s: Partial<Settings>) => void; setCogniDocs: (c: Partial<Settings['cognidocs']>) => void;
  apiKey: string; setApiKey: (k: string) => void;
  nav: Section[];
  dispatch: (action: Action) => Promise<ActionResult>;
  confirmAssistantAction: (token: string) => Promise<{ created?: string; count?: number }>;
  actions: Actions;
  scenarios: Record<string, ScenarioRun>; runScenario: (id: string) => void; reset: () => void;
};

const AppContext = createContext<Ctx | null>(null);
export const useApp = () => { const c = useContext(AppContext); if (!c) throw new Error('useApp outside AppState'); return c; };

const nowIso = () => new Date().toISOString();
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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

export function AppState({ children }: { children: ReactNode }) {
  const served = typeof location !== 'undefined' && location.protocol !== 'file:';
  const [world, setWorldState] = useState<World>(() => (served ? buildWorld() : loadLocalWorld() ?? buildWorld()));
  const worldRef = useRef(world);
  const [backend, setBackend] = useState<Backend>(() => ({ mode: served ? 'connecting' : 'local', db: null, reason: null, cognidocsConfigured: false, served, notice: null, rev: 0, busy: false }));
  const modeRef = useRef<BackendMode>(backend.mode);
  const revRef = useRef(0);
  const inFlight = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const [personaId, setPersonaIdState] = useState(() => lsGet(LOCAL_PERSONA) ?? 'faisal');
  const personaRef = useRef(personaId);
  const [apiKey, setApiKeyState] = useState(() => lsGet(LOCAL_KEY) ?? '');
  const [section, setSection] = useState<Section>('overview');
  const [focus, setFocus] = useState<string | null>(null);
  const [tab, setTab] = useState<string | null>(null);
  const [clientLens, setClientLens] = useState<string | null>(null);
  const [closePeriodContext, setClosePeriodContext] = useState(world.closingPeriod);
  const [scenarios, setScenarios] = useState<Record<string, ScenarioRun>>({});
  const scenarioToken = useRef(0);

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
        const result = applyAction(worldRef.current, action, { personaId: personaRef.current, now: nowIso() });
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
    if (modeRef.current !== 'server') throw new Error('Claude actions require the connected server, not a browser-only world.');
    const run = async () => {
      inFlight.current++; setBackend(b => ({ ...b, busy: true }));
      try {
        const result = await api<{ world: World; rev: number; created?: string; count?: number }>('/api/assistant/confirm', {
          method: 'POST', body: JSON.stringify({ token, personaId: personaRef.current }),
        });
        setWorld(result.world, result.rev);
        return { created: result.created, count: result.count };
      } finally {
        inFlight.current--;
        if (!inFlight.current) setBackend(b => ({ ...b, busy: false }));
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
    addJob: (job) => dispatch({ type: 'addJob', job }),
    updateJob: (job) => dispatch({ type: 'updateJob', job }),
    routeJob: (job) => dispatch({ type: 'routeJob', jobId: job.id }),
    logPersonTrail: (summary, detail, recordRef) => dispatch({ type: 'logPersonTrail', summary, detail, recordRef }),
  }), [dispatch]);

  /* ------------------------------------------------------ browser-only state */
  const setPersona = useCallback((id: string) => { personaRef.current = id; setPersonaIdState(id); lsSet(LOCAL_PERSONA, id); }, []);
  const setApiKey = useCallback((k: string) => { setApiKeyState(k); if (k) lsSet(LOCAL_KEY, k); else lsDel(LOCAL_KEY); }, []);
  const go = useCallback((s: Section, f?: string, t?: string) => { setSection(s); setFocus(f ?? null); setTab(t ?? null); }, []);
  const setSettings = useCallback((patch: Partial<Settings>) => { void dispatch({ type: 'updateSettings', patch }); }, [dispatch]);
  const setCogniDocs = useCallback((c: Partial<Settings['cognidocs']>) => { void dispatch({ type: 'updateSettings', patch: { cognidocs: c } }); }, [dispatch]);
  const clearNotice = useCallback(() => setBackend((b) => ({ ...b, notice: null })), []);

  /* ------------------------------------------------------ scenarios: sequences of actions with narration */
  const runScenario = useCallback((id: string) => {
    const token = ++scenarioToken.current;
    const alive = () => scenarioToken.current === token;
    const log = (msg: string) => { if (alive()) setScenarios((s) => ({ ...s, [id]: { id, state: 'running', log: [...(s[id]?.log ?? []), msg] } })); };
    const done = () => { if (alive()) setScenarios((s) => ({ ...s, [id]: { ...s[id], state: 'complete' } })); };
    const step = async (ms: number, fn: () => void | Promise<void>) => { await sleep(ms); if (!alive()) throw new Error('cancelled'); await fn(); };
    const draftsOf = (pred: (w: World) => string[]) => pred(worldRef.current);
    const simulatedJob = (sampleId: string, parserPath: string, size: number, confidence: number): ParseJob => {
      const sample = SAMPLE_DOCS.find((s) => s.id === sampleId)!;
      return { id: `DEMO-JOB-sc${Date.now().toString(16).slice(-4)}`, declaredType: sample.declaredType, detectedType: sample.declaredType, status: 'completed', fileName: sample.fileName, mimeType: 'application/pdf', fileSizeBytes: size, startedAt: nowIso(), parserPath, confidence, error: null, aiPromptTokens: 0, aiCompletionTokens: 0, aiCostAmount10k: 0, sandbox: true, result: sample.result(), createdAt: nowIso(), completedAt: nowIso(), mode: 'simulated' };
    };
    setScenarios((s) => ({ ...s, [id]: { id, state: 'running', log: [] } }));
    (async () => {
      switch (id) {
        case 'billing-run': {
          await step(300, async () => { const n = await actions.runBillingRun(); log(`Fatoora drafted ${n} September invoices from the schedule; withheld the KSIA UAT milestone (CoC) and REDC September (no PO cover).`); go('inbox'); });
          await step(1900, () => { log('Head of Revenue & Treasury releases the drafts — each one is a decision in the inbox. Releasing them now…'); });
          await step(1000, async () => { for (const x of draftsOf((w) => w.invoices.filter((i) => i.status === 'draft').map((i) => i.id))) await actions.releaseInvoice(x); log('Posted through the ERP connector; ZATCA cleared all of them. The waterfall on Overview moves from evidenced to invoiced.'); });
          await step(1600, () => { go('overview'); done(); });
          break;
        }
        case 'missed-invoice': {
          await step(300, () => { log('Hares: GPLC AMS August — delivered, CoC signed 3 Sep, no invoice. 36 days past due.'); go('inbox', 'catch:DEMO-GPLC-PO-011-L4/2026-08'); });
          let inv: string | null = null;
          await step(1900, async () => { inv = await actions.draftForEvent('DEMO-GPLC-PO-011-L4/2026-08'); log(`Fatoora drafted the catch-up invoice ${inv ?? ''}; the finding is resolved against it.`); if (inv) go('inbox', `rel:${inv}`); });
          await step(1800, async () => { if (inv) await actions.releaseInvoice(inv); log('Released and cleared. Unbilled revenue drops by SAR 52,500; the September forecast does not change — the revenue was always recognised; the cash was not asked for.'); });
          await step(1500, () => { go('overview'); done(); });
          break;
        }
        case 'coc-escalation': {
          await step(300, () => { log('Shahid: CoC for KSIA D2.13 UAT sent 24 Sep, reminded 29 Sep and 3 Oct. Cadence exhausted; escalation prepared for the KAM.'); go('inbox', 'coc:DEMO-KSIA-PO-00000611-L1/D2.13'); });
          await step(2100, async () => { await actions.escalateCoc('DEMO-KSIA-PO-00000611-L1/D2.13'); log('Majed approves the escalation; Shahid sends it to the KSIA sponsor with the UAT exit report and the reminder history.'); });
          await step(1800, async () => { await actions.signCoc('DEMO-KSIA-PO-00000611-L1/D2.13'); log('Simulated: the sponsor signs the CoC the same afternoon. SAR 611,800 moves from blocked to due.'); });
          await step(1200, async () => { const inv = await actions.draftForEvent('DEMO-KSIA-PO-00000611-L1/D2.13'); log(`Fatoora drafts ${inv ?? 'the milestone invoice'} for release.`); if (inv) go('inbox', `rel:${inv}`); });
          await step(1200, () => done());
          break;
        }
        case 'duplicate-vendor': {
          await step(300, () => { log('Upload simulated: Oracle ORC-2026-00917 submitted a second time.'); go('documents'); });
          await step(1200, async () => {
            const job = simulatedJob('oracle-dup', 'vendor_template', 48_211, 98);
            await actions.addJob(job); await actions.routeJob(job);
            log('CogniDocs: invoices are unique on (vendorKey, normalizedInvoiceRef) — the job resolves to the existing canonical invoice. Mawrid refuses to post and says why. Nothing reaches AP.');
          });
          await step(2100, () => done());
          break;
        }
        case 'cash-day': {
          await step(300, () => { log('Upload simulated: Al Rajhi collections statement, September.'); go('documents'); });
          await step(1200, async () => {
            const job = simulatedJob('rajhi-statement', 'template_match:rajhi-corp-v2', 131_072, 97);
            await actions.addJob(job); await actions.routeJob(job);
            log('Tasweya reads the statement: the lines already on file are recognised, nothing is duplicated. Two proposals wait: KSIA (tolerance) and REDC (amount + client).');
          });
          await step(1900, async () => { for (const x of draftsOf((w) => w.receipts.filter((r) => r.status === 'proposed').map((r) => r.id))) await actions.applyReceipt(x); log('Head of Revenue & Treasury applies both. Receipts posted through the connector; the bank charge journal remains for the Accounting Manager.'); go('close', undefined, 'bank'); });
          await step(1800, () => done());
          break;
        }
        case 'close-day': {
          await step(300, () => { log('Iqfal re-derives the checklist from the data: what is done is what the ledger says is done.'); go('close', undefined, 'checklist'); });
          await step(1500, async () => { for (const x of draftsOf((w) => w.journals.filter((j) => j.status === 'proposed').map((j) => j.id))) await actions.approveJournal(x); log('Accounting Manager approves the six proposed journals: unbilled accrual (computed at this moment), deferred release, vendor accrual, bank charges, FX, the Salwan debit note.'); });
          await step(1800, async () => { go('close', undefined, 'budget'); log('Mizaniya: 504 is +SAR 171k against September budget — +611.8k milestone timing, −280k PO not received, −160k expired cover. FP&A accepts the reforecast.'); await actions.acceptReforecast(); });
          await step(1800, () => { log('What still blocks the close is named, not hidden: cash proposals, bank sign-offs, the ZATCA rejection, the vendor invoice without a PO. Each is an inbox item with an owner.'); go('close', undefined, 'checklist'); done(); });
          break;
        }
      }
    })().catch((e: Error) => { if (e.message !== 'cancelled') log(`Scenario stopped: ${e.message}`); });
  }, [actions, go]);

  const reset = useCallback(() => {
    scenarioToken.current++;
    setScenarios({}); setClientLens(null); setFocus(null); setSection(nav[0]);
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
  }, [nav, setWorld]);

  const value: Ctx = {
    world, backend, clearNotice, persona, setPersona, section, go, focus, setFocus, tab, clientLens, setClientLens, closePeriodContext, setClosePeriodContext,
    settings: world.settings, setSettings, setCogniDocs, apiKey, setApiKey,
    nav, dispatch, confirmAssistantAction, actions, scenarios, runScenario, reset,
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

export { PERSONAS, lineOf, invoiceOf };
