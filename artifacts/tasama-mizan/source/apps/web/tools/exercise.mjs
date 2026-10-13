/**
 * Functional exercise: play every Director scenario step by step through the
 * UI, send every sample document, approve the inbox as the CFO, and check the
 * world still ties. Records console/page errors.
 *   node tools/exercise.mjs                                      — the standalone file (local mode)
 *   MIZAN_URL=http://localhost:5055 node tools/exercise.mjs      — a running server (PostgreSQL mode)
 */
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const here = resolve(new URL('.', import.meta.url).pathname);
const SERVER = process.env.MIZAN_URL ?? null;
const url = SERVER ? SERVER + '/' : 'file://' + resolve(here, '..', 'dist-standalone', 'Tasama-Mizan.html');
const shots = resolve(here, '..', '_shots'); mkdirSync(shots, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
if (SERVER) await fetch(SERVER + '/api/reset', { method: 'POST' });
await page.goto(url);
await page.evaluate(() => { localStorage.removeItem('mizan-local-world-v4'); localStorage.removeItem('mizan-persona'); });
await page.reload(); await page.waitForTimeout(1200);
const mode = await page.evaluate(() => /postgresql/i.test(document.body.innerText) ? 'server' : 'local');
console.log('mode', mode, SERVER ? `(server ${SERVER})` : '(standalone file)');
if (SERVER && mode !== 'server') { console.log('FAIL: server mode expected'); process.exit(1); }
const state = async () => SERVER ? { world: await (await fetch(SERVER + '/api/world')).json() } : page.evaluate(() => ({ world: JSON.parse(localStorage.getItem('mizan-local-world-v4') || 'null') }));
const menu = (name) => page.locator('nav, aside').getByRole('button', { name: new RegExp('^' + name) }).first();
const summary = (w) => `invoices ${w.invoices.length} (drafts ${w.invoices.filter((i) => i.status === 'draft').length}, paid ${w.invoices.filter((i) => i.status === 'paid').length}), receipts proposed ${w.receipts.filter((r) => r.status === 'proposed').length}, journals posted ${w.journals.filter((j) => j.status === 'posted').length}/${w.journals.length}, jobs ${w.jobs.length}, signed ${w.bankAccounts.filter((a) => a.signedOff).length}, trail ${w.trail.length}, rev ${w.flags.rev}`;

/* ------------------------------------------------ the Director: every scenario, every step */
let stepsPlayed = 0;
for (let idx = 0; idx < 6; idx++) {
  await menu('Scenarios').click(); await page.waitForTimeout(400);
  const cards = page.locator('main').getByRole('button', { name: /Run scenario|Running|Complete|Run again/ });
  await cards.nth(idx).click(); await page.waitForTimeout(400);
  const bar = page.locator('div.fixed.inset-x-0.bottom-0');
  const head = (await bar.locator('span.font-mono.uppercase').first().textContent()) ?? '';
  const blocked = await bar.getByText('cannot start').count();
  if (blocked) { console.log(`${head}: cannot start — ${(await bar.textContent()).slice(0, 160)}`); continue; }
  let n = 0;
  while (n < 12) {
    const btn = bar.getByRole('button', { name: /Start|Step/ }).first();
    if (await btn.isDisabled()) break;
    await btn.click();
    await page.waitForFunction(() => { const b = document.querySelector('div.fixed.inset-x-0.bottom-0'); return b && !b.querySelector('.animate-spin'); }, null, { timeout: 30000 });
    await page.waitForTimeout(500);
    n++; stepsPlayed++;
    const title = (await bar.locator('p.text-sm.font-semibold').first().textContent()) ?? '';
    const changed = await bar.locator('ul li').count();
    const err = await bar.locator('.text-danger').count();
    const persona = (await page.locator('header, [class*="TitleBar"]').getByText(/Al-|Hussein|Siddiqui|Haddad/).first().textContent().catch(() => '?')) ?? '?';
    console.log(`  ${head} step ${n}: ${title.slice(0, 60)} · changed ${changed}${err ? ' · ERROR' : ''} · as ${persona.trim().split('\n')[0]}`);
    if (await bar.getByText('Scenario complete').count()) break;
  }
  await page.screenshot({ path: resolve(shots, `director-${idx + 1}.png`), fullPage: false });
  const s = await state(); console.log(`after ${head}: ${summary(s.world)}`);
  await bar.getByRole('button').last().click(); // stop
  await page.waitForTimeout(300);
}
console.log('director steps played:', stepsPlayed);

/* ------------------------------------------------ Documents: send every sample */
await menu('Documents').click(); await page.waitForTimeout(400);
const sendButtons = page.getByRole('button', { name: 'Send to CogniDocs' });
const nSend = await sendButtons.count();
for (let i = 0; i < nSend; i++) { await sendButtons.nth(i).click(); await page.waitForTimeout(3600); }
let s = await state();
console.log('jobs', s.world.jobs.map((j) => `${j.fileName}:${j.status}→${(j.routedTo ?? j.error ?? '').slice(0, 40)}`).join(' | '));

/* ------------------------------------------------ Inbox: approve everything the CFO can */
// Persona → CFO (can approve everything): open the user badge, pick the CFO in the dialog, make sure the scrim is gone.
await page.locator('header').getByRole('button').filter({ hasText: /Al-|Hussein|Siddiqui|Haddad/ }).first().click();
await page.waitForTimeout(300);
await page.locator('[role="dialog"], .z-\\[200\\]').getByRole('button').filter({ hasText: /Chief Financial Officer/ }).first().click();
await page.waitForTimeout(300);
if (await page.locator('.z-\\[190\\]').count()) await page.keyboard.press('Escape');
await page.waitForTimeout(200);
console.log('persona now', await page.evaluate(() => localStorage.getItem('mizan-persona')));
for (let pass = 0; pass < 8; pass++) {
  await menu('Inbox').click(); await page.waitForTimeout(400);
  const anyItem = page.locator('main').locator('[class*="cursor-pointer"], button, article').filter({ hasText: /DEMO-/ }).filter({ hasNot: page.locator('h2') }).first();
  if (!(await anyItem.count())) break;
  await anyItem.click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
  const primary = page.locator('main').locator('button.bg-primary').last();
  if (await primary.count() && await primary.isEnabled()) { await primary.click(); await page.waitForTimeout(400); }
  else { const inp = page.locator('input[placeholder^="Reason"]'); if (await inp.count()) await inp.first().fill('demo').catch(() => {}); const p2 = page.locator('main').locator('button.bg-primary').last(); if (await p2.count() && await p2.isEnabled()) { await p2.click(); await page.waitForTimeout(400); } }
}
s = await state();
const w = s.world;
console.log(`\nfinal: ${summary(w)}, period closed ${w.flags.periodClosed}`);
let bad = 0;
for (const r of w.receipts.filter((x) => x.status === 'applied')) { const bl = w.bankLines.find((b) => b.id === r.bankLineId); if (!bl.matchedLedgerId) bad++; }
console.log('applied receipts without ledger entry:', bad);
let mis = 0;
for (const inv of w.invoices) { const exp = inv.eventIds.reduce((t, id) => t + (w.events.find((e) => e.id === id)?.expectedAmount ?? 0), 0); if (Math.abs(exp - inv.net) > 0.01 && !inv.billedRate) mis++; }
console.log('invoices not tying to events:', mis);
const closeItems = w.closeItems.length;
console.log('close items persisted:', closeItems, closeItems === 24 ? 'OK' : 'FAIL');
if (SERVER) {
  const fresh = await ctx.newPage(); await fresh.goto(url); await fresh.waitForTimeout(1200);
  const seen = await fresh.evaluate(() => document.body.innerText);
  const api = await (await fetch(SERVER + '/api/world')).json();
  console.log('fresh page shows PostgreSQL badge:', /postgresql/i.test(seen), '· api rev', api.flags.rev, '· trail', api.trail.length);
  await fresh.close();
}
console.log('\nconsole/page errors:', errors.length); errors.slice(0, 15).forEach((e) => console.log('  ', e));
await browser.close();
process.exit(errors.length || bad || mis || closeItems !== 24 || stepsPlayed < 20 ? 1 : 0);
