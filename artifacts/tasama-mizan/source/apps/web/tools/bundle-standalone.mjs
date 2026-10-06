/**
 * Folds dist-standalone/ into two artefacts:
 *
 *   dist-standalone/Tasama-Mizan.html    a complete document — double-click it
 *   dist-standalone/artifact-page.html   the same page as body content only,
 *                                        for a host that supplies the skeleton
 *
 * Everything is inlined, including the public/brand art the bundler never
 * sees. Nothing is fetched at runtime: these open on a plane, and on a
 * government network that blocks the font CDNs.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';

const here = dirname(new URL(import.meta.url).pathname);
const web = resolve(here, '..');
const out = resolve(web, 'dist-standalone');

const MIME = {
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
};

/**
 * Every file under public/, as a data: URI keyed by the absolute path the
 * source refers to it by. Walking the directory rather than listing names
 * means a new asset — an agent portrait, a second wordmark — is inlined the
 * day it is added instead of the day someone remembers this file exists.
 */
const brand = {};
const walk = (dir, prefix) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name === 'samples') continue; walk(full, `${prefix}${entry.name}/`); continue; }
    const ext = entry.name.slice(entry.name.lastIndexOf('.'));
    if (!MIME[ext]) { console.warn(`  ! no mime for public${prefix}${entry.name}, left as a file`); continue; }
    brand[`${prefix}${entry.name}`] = `data:${MIME[ext]};base64,${readFileSync(full).toString('base64')}`;
  }
};
walk(resolve(web, 'public'), '/');

/** Absolute /brand/… references survive bundling untouched; rewrite them. */
const inlineBrand = (s) => {
  for (const [ref, uri] of Object.entries(brand)) {
    // The './brand/…' form FIRST: base:'./' rewrites the CSS url() to it, and
    // replacing the bare '/brand/…' inside it leaves a stray leading dot —
    // which the browser then tries to fetch as a relative file.
    s = s.split(`.${ref}`).join(uri);
    s = s.split(ref).join(uri);
  }
  return s;
};

const css = inlineBrand(readFileSync(resolve(out, 'app.css'), 'utf8'));
const js = inlineBrand(readFileSync(resolve(out, 'app.js'), 'utf8'));

/* The pre-paint theme script, lifted verbatim from index.html so the two
 * cannot drift: without it the page flashes the wrong theme on load. */
const src = readFileSync(resolve(web, 'index.html'), 'utf8');
const prepaint = (src.match(/<script>\s*\(function \(\)[\s\S]*?<\/script>/) ?? [''])[0];
if (!prepaint) throw new Error('pre-paint theme script not found in index.html');

/* html/body sizing moves from the index.html attributes into the stylesheet,
 * because a host-supplied skeleton owns those elements. */
const shell = `${prepaint}
<style>html,body{height:100%;margin:0}</style>
<style>${css}</style>
<div id="root" style="height:100%"></div>
<script>${js}</script>`;

writeFileSync(resolve(out, 'artifact-page.html'), shell);

writeFileSync(resolve(out, 'Tasama-Mizan.html'), `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1">
<title>Tasama Mizan</title>
<meta name="description" content="Tasama Mizan — lead-to-cash, month-end close, bank and budget reconciliation. Demonstration build; all data synthetic.">
<link rel="icon" type="image/svg+xml" href="${brand['/brand/favicon.svg']}">
</head>
<body>
${shell}
</body>
</html>`);

const kb = (p) => `${(readFileSync(resolve(out, p)).length / 1024 / 1024).toFixed(2)} MB`;
console.log(`  Tasama-Mizan.html   ${kb('Tasama-Mizan.html')}`);
console.log(`  artifact-page.html  ${kb('artifact-page.html')}`);
console.log(`  inlined ${Object.keys(brand).length} public assets`);
