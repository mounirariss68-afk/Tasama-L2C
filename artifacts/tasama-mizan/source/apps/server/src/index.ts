/**
 * Mizan server — owns the world in PostgreSQL, applies actions through the
 * pure domain reducer, serves the built web app and proxies CogniDocs so the
 * API key never reaches the browser.
 *
 *   DATABASE_URL        PostgreSQL connection string (Replit sets it when a
 *                       database is added in the Database tool)
 *   COGNIDOCS_BASE_URL  e.g. https://<cognidocs-host>/api   (optional)
 *   COGNIDOCS_API_KEY   a user-owned key, sandbox in development (optional)
 *   PORT                default 5000
 *
 * Demo prototype: no authentication. One world, shared by every browser that
 * opens the app; the persona picker in the header decides who is acting.
 */
import express from 'express';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAction, type Action } from '@mizan/domain/actions';
import { ensureSchema, isSeeded, loadWorld, pool, reseed, saveWorld } from './store';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '../../web/dist');
const app = express();
app.use(express.json({ limit: '8mb' }));
const PORT = Number(process.env.PORT ?? 5000);
const BASE = (process.env.COGNIDOCS_BASE_URL ?? '').replace(/\/$/, '');
const KEY = process.env.COGNIDOCS_API_KEY ?? '';

/* ------------------------------------------------------------ database */

let dbState: { ok: true } | { ok: false; reason: string } = { ok: false, reason: 'starting' };

async function startDatabase() {
  if (!process.env.DATABASE_URL) { dbState = { ok: false, reason: 'DATABASE_URL is not set. In Replit, open the Database tool and create a PostgreSQL database; the variable is set for you.' }; return; }
  try {
    await ensureSchema();
    if (!(await isSeeded())) { const w = await reseed(); console.log(`Seeded the synthetic world: ${w.clients.length} clients, ${w.invoices.length} invoices, ${w.bankLines.length} bank lines`); }
    dbState = { ok: true };
  } catch (e) {
    dbState = { ok: false, reason: `PostgreSQL unreachable: ${(e as Error).message}` };
    console.error(dbState.reason);
  }
}

/** Actions are applied one at a time: load → reduce → save is a read-modify-write on one world. */
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

async function currentRev(): Promise<number> {
  const r = await pool.query(`select value->>'rev' as rev from mizan.world_meta where key = 'flags'`);
  return Number(r.rows[0]?.rev ?? 0);
}

const needDb = (res: express.Response) => { if (!dbState.ok) { res.status(503).json({ error: dbState.reason }); return false; } return true; };

app.get('/api/health', async (_req, res) => {
  let rev: number | null = null;
  if (dbState.ok) { try { rev = await currentRev(); } catch (e) { dbState = { ok: false, reason: `PostgreSQL unreachable: ${(e as Error).message}` }; } }
  res.json({ ok: true, db: dbState.ok ? 'postgresql' : null, dbReason: dbState.ok ? undefined : dbState.reason, rev, cognidocs: BASE ? 'configured' : 'not configured', dist: existsSync(dist) });
});

app.get('/api/world', async (_req, res) => {
  if (!needDb(res)) return;
  try { res.json(await loadWorld()); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

app.get('/api/rev', async (_req, res) => {
  if (!needDb(res)) return;
  try { res.json({ rev: await currentRev() }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

app.post('/api/actions', async (req, res) => {
  if (!needDb(res)) return;
  const { action, personaId } = (req.body ?? {}) as { action?: Action; personaId?: string };
  if (!action || typeof action.type !== 'string') { res.status(400).json({ error: 'Body must be { action: { type, … }, personaId }' }); return; }
  try {
    const out = await serial(async () => {
      const prev = await loadWorld();
      const result = applyAction(prev, action, { personaId: personaId ?? 'omar', now: new Date().toISOString() });
      if (!result.error) await saveWorld(prev, result.world);
      return result;
    });
    res.json({ world: out.world, created: out.created, count: out.count, error: out.error, rev: out.world.flags.rev });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/api/reset', async (_req, res) => {
  if (!needDb(res)) return;
  try { const world = await serial(() => reseed()); res.json({ world, rev: world.flags.rev }); } catch (e) { res.status(500).json({ error: (e as Error).message }); }
});

/* ------------------------------------------------------------ CogniDocs proxy: /api/cognidocs/* → ${BASE}/* with X-API-Key from the environment (or the request, if the browser supplied one). */
app.use('/api/cognidocs', async (req, res) => {
  if (!BASE) { res.status(503).json({ error: 'CogniDocs is not configured on the server. Set COGNIDOCS_BASE_URL and COGNIDOCS_API_KEY, or enter a base URL in Settings to call it directly.' }); return; }
  const key = (req.header('x-api-key') as string | undefined) || KEY;
  const url = `${BASE}${req.url}`;
  try {
    const headers: Record<string, string> = { 'X-API-Key': key };
    const ct = req.header('content-type'); if (ct) headers['Content-Type'] = ct;
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const upstream = await fetch(url, { method: req.method, headers, body: body as BodyInit | undefined, redirect: 'manual' });
    res.status(upstream.status);
    upstream.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'connection'].includes(k)) res.setHeader(k, v); });
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    res.status(502).json({ error: `CogniDocs upstream unreachable: ${(e as Error).message}` });
  }
});

/* ------------------------------------------------------------ static web app */
if (existsSync(dist)) {
  app.use(express.static(dist, { index: 'index.html', maxAge: '1h' }));
  app.get(/.*/, (_req, res) => res.sendFile(resolve(dist, 'index.html')));
} else {
  app.get(/.*/, (_req, res) => res.status(503).send('Web app not built yet. Run: npm run build'));
}

startDatabase().finally(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mizan listening on :${PORT}`);
    console.log(`  database  ${dbState.ok ? 'PostgreSQL — world persisted' : 'NOT AVAILABLE — ' + dbState.reason}`);
    console.log(`  CogniDocs ${BASE ? 'proxy → ' + BASE : 'not configured (simulated mode works without it)'}`);
  });
});
