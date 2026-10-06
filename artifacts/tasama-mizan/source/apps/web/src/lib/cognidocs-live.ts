/**
 * CogniDocs live client — the browser side of the one real integration.
 * POST /documents, then poll GET /jobs/{id} with the backoff the guide
 * prescribes. Through the server proxy (/api/cognidocs) when the app is
 * served; direct when it is the standalone file and the deployment allows.
 */
import type { DeclaredType, ParseJob } from '@mizan/domain/types';

export type CogniDocsConfig = { baseUrl: string; apiKey: string; sandbox: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function submitLive(cfg: CogniDocsConfig, file: File, declaredType: DeclaredType, password?: string): Promise<ParseJob> {
  const base = cfg.baseUrl.replace(/\/$/, '');
  const form = new FormData();
  form.append('file', file);
  if (declaredType !== 'auto') form.append('declaredType', declaredType);
  if (password) form.append('password', password);
  const res = await fetch(`${base}/documents`, { method: 'POST', headers: { 'X-API-Key': cfg.apiKey }, body: form });
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    if (body.code === 'LEGAL_ACCEPTANCE_REQUIRED') throw new Error('CogniDocs: a person must sign in to the CogniDocs console and accept the current Terms and Privacy Policy before API calls are accepted (403 LEGAL_ACCEPTANCE_REQUIRED).');
    throw new Error(`CogniDocs 403: ${body.error ?? 'plan, role or quota denied'}`);
  }
  if (res.status === 422) { const body = await res.json().catch(() => ({})); throw new Error(`CogniDocs 422 ${body.code ?? ''}: ${body.error ?? 'PDF password required or incorrect'}`); }
  if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(`CogniDocs ${res.status}: ${body.error ?? res.statusText}`); }
  const job = (await res.json()) as ParseJob;
  return { ...job, mode: 'live' };
}

/** Poll per the guide: ~2 s first, exponential backoff with jitter, cap ~10 s; stop on terminal state. */
export async function pollLive(cfg: CogniDocsConfig, id: string, onUpdate: (j: ParseJob) => void): Promise<ParseJob> {
  const base = cfg.baseUrl.replace(/\/$/, '');
  let wait = 2000;
  for (let attempt = 0; attempt < 60; attempt++) {
    await sleep(wait + Math.random() * 400);
    const res = await fetch(`${base}/jobs/${id}`, { headers: { 'X-API-Key': cfg.apiKey } });
    if (res.status >= 500) { wait = Math.min(10_000, wait * 1.6); continue; } // transient
    if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(`CogniDocs ${res.status}: ${body.error ?? res.statusText}`); }
    const job = { ...((await res.json()) as ParseJob), mode: 'live' as const };
    onUpdate(job);
    if (job.status === 'completed' || job.status === 'failed') return job;
    wait = Math.min(10_000, wait * 1.6);
  }
  throw new Error('CogniDocs: job did not reach a terminal state within the polling budget');
}

/** Where the app sends live calls: the server proxy when served, direct otherwise. */
export function liveBase(cfg: { baseUrl: string }, served: boolean) {
  if (served && cfg.baseUrl === '') return '/api/cognidocs';
  return cfg.baseUrl;
}
