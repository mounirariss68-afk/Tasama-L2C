/**
 * Functional exercise: run every scenario, send every sample document,
 * approve the inbox as the CFO, and check the world still ties. Records
 * console/page errors.
 *   node tools/exercise.mjs                         — the standalone file (local mode)
 *   MIZAN_URL=http://localhost:5055 node tools/exercise.mjs — a running server (PostgreSQL mode)
 */
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { resolve } from 'node:path';

const here = resolve(new URL('.', import.meta.url).pathname);
const SERVER = process.env.MIZAN_URL ?? null;
const url = SERVER ? SERVER + '/' : 'file://' + resolve(here, '..', 'dist-standalone', 'Tasama-Mizan.html');
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

// Persona → CFO (can approve everything)
await page.getByRole('button', { name: /Faisal Al-Dossary/ }).first().click();
await page.getByRole('button', { name: /Saed Hussein/ }).click();
await page.waitForTimeout(300);
let s = await state();
console.log('persona', await page.evaluate(() => localStorage.getItem('mizan-persona')), 'rev', s.world?.flags.rev ?? 'seed (nothing stored yet)');

// Scenarios
await page.getByRole('button', { name: /^Settings/ }).first().click(); await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Scenarios', exact: true }).click(); await page.waitForTimeout(300);
const NAMES = ['Month-end billing run', 'The invoice nobody raised', 'CoC stuck at KSIA', 'Duplicate vendor invoice', 'Cash day — statement upload', 'Close — Day 4 to Day 5'];
for (const [idx, name] of NAMES.entries()) {
  await page.getByRole('button', { name: /^Settings/ }).first().click(); await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Scenarios', exact: true }).click(); await page.waitForTimeout(200);
  await page.getByRole('button', { name: /Run scenario|Running/ }).nth(idx).click();
  await page.waitForTimeout(7500);
  s = await state();
  console.log(`after "${name}": invoices ${s.world.invoices.length}, drafts ${s.world.invoices.filter((i) => i.status === 'draft').length}, paid ${s.world.invoices.filter((i) => i.status === 'paid').length}, jobs ${s.world.jobs.length}, receipts proposed ${s.world.receipts.filter((r) => r.status === 'proposed').length}, journals posted ${s.world.journals.filter((j) => j.status === 'posted').length}, trail ${s.world.trail.length}`);
}

// Documents: send every sample
await page.getByRole('button', { name: /^Documents/ }).first().click(); await page.waitForTimeout(300);
const sendButtons = page.getByRole('button', { name: 'Send to CogniDocs' });
const n = await sendButtons.count();
for (let i = 0; i < n; i++) { await sendButtons.nth(i).click(); await page.waitForTimeout(3600); }
s = await state();
console.log('jobs', s.world.jobs.map((j) => `${j.fileName}:${j.status}→${j.routedTo ?? j.error}`).join(' | '));

// Inbox: approve everything the CFO can, several passes
for (let pass = 0; pass < 6; pass++) {
  await page.getByRole('button', { name: /^Inbox/ }).first().click(); await page.waitForTimeout(400);
  const list = page.getByText('Your decisions').locator('xpath=ancestor::*[contains(@class,"flex") or self::section][1]');
  const anyItem = page.locator('[class*="cursor-pointer"], button, article').filter({ hasText: /DEMO-/ }).filter({ hasNot: page.locator('h2') }).first();
  if (!(await anyItem.count())) break;
  await anyItem.click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
  // click the primary (rightmost) decision button if enabled
  const primary = page.locator('button.bg-primary').last();
  if (await primary.count() && await primary.isEnabled()) { await primary.click(); await page.waitForTimeout(400); }
  else {
    // fill the required inputs for cash/zatca/dunning then retry
    const inp = page.locator('input[placeholder^="Reason"]'); if (await inp.count()) await inp.first().fill('demo').catch(() => {});
    const p2 = page.locator('button.bg-primary').last(); if (await p2.count() && await p2.isEnabled()) { await p2.click(); await page.waitForTimeout(400); }
  }
}
s = await state();
const w = s.world;
const open = w.invoices.filter((i) => ['posted', 'released'].includes(i.status));
console.log(`\nfinal: invoices ${w.invoices.length} (drafts ${w.invoices.filter((i) => i.status === 'draft').length}, rejected ${w.invoices.filter((i) => i.zatca === 'rejected').length}), open AR count ${open.length}, journals posted ${w.journals.filter((j) => j.status === 'posted').length}/${w.journals.length}, receipts proposed ${w.receipts.filter((r) => r.status === 'proposed').length}, bank signed ${w.bankAccounts.filter((a) => a.signedOff).length}, trail ${w.trail.length}, period closed ${w.flags.periodClosed}`);
// invariant: every applied receipt has a ledger entry on its bank line
let bad = 0;
for (const r of w.receipts.filter((x) => x.status === 'applied')) { const bl = w.bankLines.find((b) => b.id === r.bankLineId); if (!bl.matchedLedgerId) bad++; }
console.log('applied receipts without ledger entry:', bad);
// invariant: every invoice ties to its events (except explicit billedRate)
let mis = 0;
for (const inv of w.invoices) { const exp = inv.eventIds.reduce((t, id) => t + (w.events.find((e) => e.id === id)?.expectedAmount ?? 0), 0); if (Math.abs(exp - inv.net) > 0.01 && !inv.billedRate) mis++; }
console.log('invoices not tying to events:', mis);
await page.getByRole('button', { name: /^Overview/ }).first().click(); await page.waitForTimeout(500);
await page.screenshot({ path: resolve(here, '..', '_shots', 'after-exercise-overview.png'), fullPage: true }).catch(() => {});
if (SERVER) {
  // persistence: a fresh page sees the same world the API holds
  const fresh = await ctx.newPage(); await fresh.goto(url); await fresh.waitForTimeout(1200);
  const seen = await fresh.evaluate(() => document.body.innerText);
  const api = await (await fetch(SERVER + '/api/world')).json();
  console.log('fresh page shows PostgreSQL badge:', /postgresql/i.test(seen), '· api rev', api.flags.rev, '· trail', api.trail.length);
  await fresh.close();
}
console.log('\nconsole/page errors:', errors.length); errors.slice(0, 15).forEach((e) => console.log('  ', e));
await browser.close();
process.exit(errors.length || bad || mis ? 1 : 0);
