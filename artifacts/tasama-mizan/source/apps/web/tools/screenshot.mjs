/**
 * Visual verification: visit every screen and tab in both themes, record
 * console errors, probe horizontal overflow, save screenshots.
 *   node tools/screenshot.mjs [outDir]                          — serves dist/ statically (local mode)
 *   MIZAN_URL=http://localhost:5055 node tools/screenshot.mjs   — a running server (PostgreSQL mode)
 */
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve, extname, join } from 'node:path';

const here = resolve(new URL('.', import.meta.url).pathname);
const dist = resolve(here, '..', 'dist');
const out = resolve(process.argv[2] ?? resolve(here, '..', '_shots'));
mkdirSync(out, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
const SERVER = process.env.MIZAN_URL ?? null;
const server = SERVER ? null : createServer((req, res) => {
  let p = join(dist, decodeURIComponent(req.url.split('?')[0]));
  if (!existsSync(p) || statSync(p).isDirectory()) p = join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' });
  res.end(readFileSync(p));
});
if (server) await new Promise((r) => server.listen(5199, r));
const base = SERVER ?? 'http://localhost:5199';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? undefined });
const errors = [];
const overflow = [];
const SECTIONS = [
  ['overview', []], ['inbox', []], ['l2c', ['Process', 'Contracts', 'Orders & schedules', 'Billing', 'Collections', 'Clients']], ['documents', []],
  ['close', ['Checklist', 'Bank reconciliation', 'Budget vs actual', 'Journals']], ['agents', ['Team', 'Workflows', 'Decision trail']], ['settings', ['Personas', 'Data', 'ERP', 'CogniDocs', 'Thresholds', 'Scenarios']],
];
const LABEL = { overview: 'Overview', inbox: 'Inbox', l2c: 'Lead to cash', documents: 'Documents', close: 'Close', agents: 'Agents', settings: 'Settings' };

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 }, colorScheme: theme });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${theme}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${theme}] pageerror: ${e.message}`));
  if (SERVER) await fetch(SERVER + '/api/reset', { method: 'POST' });
  await page.goto(base + '/');
  await page.evaluate((t) => { localStorage.setItem('atelier-theme', t); localStorage.removeItem('mizan-local-world-v4'); }, theme);
  await page.reload();
  await page.waitForTimeout(1200);
  for (const [id, tabs] of SECTIONS) {
    const nav = page.getByRole('link', { name: new RegExp(`^${LABEL[id]}`) }).or(page.getByRole('button', { name: new RegExp(`^${LABEL[id]}`) })).first();
    await nav.click({ timeout: 5000 }).catch(async () => { await page.getByText(LABEL[id], { exact: false }).first().click(); });
    await page.waitForTimeout(500);
    const shots = tabs.length ? tabs : [null];
    for (const tab of shots) {
      if (tab) { await page.getByRole('button', { name: tab, exact: true }).first().click(); await page.waitForTimeout(400); }
      if (id === 'inbox') { const first = page.locator('[class*="InboxItem"], article, li').first(); await first.click().catch(() => {}); await page.waitForTimeout(300); }
      const name = `${theme}-${id}${tab ? '-' + tab.toLowerCase().replace(/[^a-z]+/g, '_') : ''}`;
      await page.screenshot({ path: resolve(out, `${name}.png`), fullPage: true });
      const over = await page.evaluate(() => Array.from(document.querySelectorAll('.overflow-x-auto, table')).filter((el) => el.scrollWidth > el.clientWidth + 2).map((el) => `${el.tagName.toLowerCase()} ${el.scrollWidth}>${el.clientWidth} :: ${(el.textContent || '').trim().slice(0, 60)}`));
      for (const o of over) overflow.push(`${name}: ${o}`);
      console.log('shot', name);
    }
  }
  await ctx.close();
}
await browser.close();
server?.close();
console.log('\nconsole errors:', errors.length); for (const e of errors.slice(0, 20)) console.log('  ', e);
console.log('overflow probes:', overflow.length); for (const o of overflow.slice(0, 20)) console.log('  ', o);
