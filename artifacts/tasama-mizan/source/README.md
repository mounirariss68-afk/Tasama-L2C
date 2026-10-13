# Tasama Mizan

Lead-to-cash, month-end close, bank and budget reconciliation for **TASAMA Business Services** — the revenue-operations layer between the CRM (Salesforce), the CLM (Sirion) and the ERP (Oracle Fusion Cloud, or Odoo for the operations team). Built on the Cognirise Atelier design system, rebranded to Tasama's colours and logo with Cognirise's own typefaces (Comfortaa, Inter).

> **Everything in it is synthetic.** The client names are real PIF-portfolio companies that appear in Tasama's own PO ledger; every contract, figure, person, bank line and event is invented. Every screen says so and every fabricated identifier is prefixed `DEMO-`.

**Scope.** Mizan covers Tasama's *own* finance: how Tasama sells, contracts, delivers, bills, collects and closes its own books. The finance processes Tasama performs *for its clients* as a service (the "Finance Process Baseline" — accounts payable, payroll accounting, month-end for client NewCos) are a different platform and are not covered here, by design.

The design — research findings, the four-stage process, agents, screens, data, scenarios, integrations, architecture and the decisions still open — is in [`design/DESIGN.md`](design/DESIGN.md). The research extracts and four research reports are in `research/`.

## The process, in four stages

| Stage | Question | Mizan | Agents |
| --- | --- | --- | --- |
| **1 · Lead-to-Contract** | What have we promised, to whom, on what terms? | *Reads* the pipeline (Salesforce) and the contract terms (Sirion); forecast and expiry watch only | Aqd, Mizaniya |
| **2 · Contract-to-Service** | What instrument lets us bill, and what will we bill when? | *Operates*: PO register, line matching, billing-schedule engine, vendor PO links | Aqd, Mawrid |
| **3 · Service-to-Cash** | Did we deliver, did we bill it, did we get paid? | *Operates*: evidence and CoC, billing run, revenue assurance, collections, cash application, cost of delivery | Shahid, Fatoora, Hares, Tahseel, Tasweya, Mawrid |
| **4 · Close** | Can we close the month, and where are we against budget? | *Operates*: derived checklist, journals, bank reconciliation, AR tie, budget variance, tax, close pack | Iqfal, Tasweya, Mizaniya, Fatoora |

The **Lead to cash → Process** tab shows the four stages with live numbers, every step's actor, system of record, gate, agent, autonomy and coverage, and a link to the workflow that implements it. The Agents screen groups the eleven workflows by stage.

## How it runs

```
browser ──── GET /api/world · POST /api/actions · GET /api/rev ────► Express (apps/server)
             (every change is an Action; the screens never mutate)      │  applyAction() — the pure reducer
                                                                        │  one transaction per action
                                                                        ▼
                                                              PostgreSQL, schema "mizan"
                                                              23 tables, one row per domain record
```

The server owns the world. It seeds the deterministic synthetic world into PostgreSQL on first start, loads it whole for every action (it is a few hundred rows), applies the reducer in `packages/domain/src/actions.ts`, and upserts only the rows whose serialisation changed. Every browser that opens the deployment sees the same world and polls `/api/rev` every four seconds for changes made elsewhere. **Reset the demo** truncates and re-seeds.

The same reducer runs in the browser when there is no server (the standalone `.html`) or no database — the app then says *local* in the header and keeps the world in `localStorage`. One implementation, two homes, identical results (the exercise script proves it).

## Three ways to open it

**1. Replit — the intended way.**
1. replit.com → *Create* → *Import from ZIP* → `tasama-mizan.zip`.
2. In the left toolbar open **Database**, choose **PostgreSQL**, create it. Replit sets `DATABASE_URL` (and `PG*`) for the Repl.
3. Press **Run**. The first run installs and builds (2–3 minutes); the console shows `database  PostgreSQL — world persisted`. Later runs start in seconds.
4. Optional, to parse real documents: in **Secrets** add `COGNIDOCS_BASE_URL` (e.g. `https://<cognidocs-host>/api`) and `COGNIDOCS_API_KEY` (a sandbox key), then switch CogniDocs to *Live* in Settings. The server proxies `/api/cognidocs/*` so the key never reaches the browser.

If you press Run before adding the database, the app still opens — in browser-only mode, with the reason shown under Settings → Data. Add the database and press Run again.

**2. Double-click `Tasama-Mizan.html`.** The whole platform in one file: no server, no install, no network. The world lives in that browser. CogniDocs runs in *simulated* mode. Keep the `samples/` folder next to it so the sample PDFs can be downloaded from the Documents screen.

**3. Locally**, to change it (needs PostgreSQL 16 for the full experience):

```bash
npm install
createdb mizan                               # any PostgreSQL 14+; the server creates the schema
DATABASE_URL=postgresql://localhost/mizan npm start      # http://localhost:5000 (after npm run build)
npm run dev                                  # Vite dev server for the web app, http://localhost:5174
npm run typecheck                            # design system, domain, server, web
npm run check:world                          # 136 arithmetic and reducer checks on the synthetic world
npm run build                                # apps/web/dist — served by apps/server
npm run build:standalone                     # the single .html
MIZAN_URL=http://localhost:5000 node apps/web/tools/exercise.mjs    # scenarios, uploads, approvals, invariants, persistence
MIZAN_URL=http://localhost:5000 node apps/web/tools/screenshot.mjs  # every screen and tab, both themes
```

## The demo, step by step

The **Scenarios** screen lists nine scripts — lead to cash (S1–S5: happy path, exception, escalation, refusal, cash), the close (S6 opens it, S7 brings payroll in, S8 resolves every blocker and closes the month) and the VAT return (S9). Pressing one docks the **Demo Director** at the bottom of the display: Back · Step · Play · Stop. Each step switches to the persona whose decision it is, opens the screen to watch, runs a real action through the same reducer every click uses, and lists what changed. Nothing is faked — the trail is the same trail. A scenario that already ran on the world says so and offers the reset. Same pattern as Tasama HR and QIB Jahiz.

## What it is

Tasama sells managed services, projects, staff augmentation and licence pass-through to PIF-portfolio companies, government entities and inbound multinationals. Today the join between proposal, client PO, delivered work, invoice, collection and subcontractor cost is a spreadsheet maintained by hand — the one with rows that read *"To Invoice: Missed"*. Mizan is that object, with agents doing the chasing, matching and reconciling, and people deciding.

### Screens

| Screen | Answers |
| --- | --- |
| **Overview** | Can we close, and where is the money? The lead-to-cash waterfall, the four stages, unbilled by reason, DSO by segment, Budget · Target · Forecast · Actual |
| **Inbox** | What is waiting on me? Every item ends in a decision, named, with the authority making it |
| **Lead to cash** | Process (four stages) · Contracts & orders (opportunities read from Salesforce, terms from Sirion, POs with consumption and the billing schedule per line) · Billing run · Collections · Clients |
| **Documents** | Upload a PDF → CogniDocs parse job → canonical envelope → routed to the owning agent (simulated or live) |
| **Close** | Tasama's own 24 closing procedures with their status derived from the data by Iqfal (inputs 1–5 with Iqfal's tracker, Finance 6–24; Fixed Assets and Leases read back from the ERP's jobs), plus line 25, the VAT return · bank reconciliation per account · payroll as Finance receives it (register, Rawatib's proof, journals, cost by engagement) · the VAT return with the invoices behind each box · budget variance by driver and margin by client with payroll in it · journals with ERP posting previews · the Day-1 pack |
| **Agents** | Ten agents with declared autonomy, eleven workflows grouped by stage with step-level coverage, the decision trail |
| **Scenarios** | The demo's remote control: nine scripts the Demo Director plays step by step — narration, trigger, persona, screen, what changed; S8 ends with the period closed |
| **Settings** | Personas · Connections (where the world lives, ERP dialect Oracle / Odoo, CogniDocs) · Thresholds |

### The agents

Aqd (contract & order terms) · Shahid (delivery evidence & CoC) · Fatoora (billing) · Hares (revenue assurance) · Tahseel (collections) · Tasweya (cash application & bank reconciliation) · Mawrid (cost to deliver) · Rawatib (payroll to ledger: the HR register proven to the bank, the GL and the headcount, booked with provisions and GOSI, allocated to engagements — totals only, never an employee record) · Iqfal (close, the departments' inputs, the ERP jobs read back, the VAT return, the Day-1 pack) · Mizaniya (budget & forecast) — and Muhasib, the co-pilot in the rail, which in this build matches rather than comprehends and says so.

Autonomy is labelled at the rung each agent actually runs at (A0 observe → A4 autonomous). If it asks for approval, it is A2.

### What is derived, not authored

Billing-event status, unbilled and deferred revenue, PO consumption, ageing and DSO, cash-match proposals, bank reconciliation balances and open items, recognised revenue by line and month, the weighted pipeline, variance against budget, the payroll proof and the cost of delivery by client, the VAT return figures, the month P&L, close-checklist status (all 25 lines), the inbox, the stage metrics. The inputs are contracts, PO lines, delivery evidence, invoices, bank lines, the payroll register totals, the ERP job results, opportunities and the budget. `npm run check:world` proves the arithmetic ties.

### What is simulated

Oracle Fusion, Odoo, Salesforce, Sirion, ServiceNow, PPM, ZATCA clearance and the banks. Every write goes through one connector (`packages/domain/src/erp.ts`) and the trail shows the call it would have made. CogniDocs is the one real contract: the emulator (`packages/domain/src/cognidocs.ts`) returns the canonical envelope with real status transitions; the live client (`apps/web/src/lib/cognidocs-live.ts`) calls a deployment through the server proxy.

## Project layout

```
design/DESIGN.md                        the design document
research/                               extracts of Tasama's own documents and the four research reports
packages/design-system                  Atelier, rebranded to Tasama (tokens.json is the single source of truth)
packages/domain/src/types.ts            the domain types
packages/domain/src/world.ts            the seeded synthetic world, its fifteen authored edge cases, the opportunities
packages/domain/src/derive.ts           every derivation the screens read
packages/domain/src/actions.ts          the action reducer — every change a person or agent can make, as a pure function
packages/domain/src/process.ts          the four stages, their steps and live metrics
packages/domain/src/workflows.ts        the eleven workflows, each tagged with its stage
packages/domain/src/scenarios.ts        the nine Director scripts — steps with narration, trigger, action, screen, persona
packages/domain/src/erp.ts              the ERP connector, two dialects
packages/domain/src/cognidocs.ts        the CogniDocs emulator and sample documents
apps/server/src/index.ts                Express: /api/world, /api/actions, /api/rev, /api/reset, CogniDocs proxy, static
apps/server/src/store.ts                PostgreSQL store: seed, load, diff-upsert in one transaction
apps/server/src/schema.sql              the schema (23 tables)
apps/web/src/app/state.tsx              API client with the local fallback; the Director runtime (diffs the world for "what changed")
apps/web/src/app/director.tsx           the Director bar
design/Tasama-Monthly-Closing-Procedures.pdf   Tasama's 24 procedures, the source of the close checklist
apps/web/src/screens/*.tsx              the seven screens
apps/web/tools/check-world.ts           arithmetic + reducer checks · screenshot.mjs and exercise.mjs drive the built app
```

## Notes for the next build

- **Rollup 4.64.0 hangs** during tree-shaking on any React app (spins in `includeCallArgumentsOfPossibleValues`). `package.json` pins `rollup@4.63.3` and `vite@7.3.6` through `overrides`. Do not remove the pin without testing a build first.
- The schema is idempotent (`create table if not exists` + `alter table … add column if not exists`) and the seed carries a `SEED_VERSION`; a build whose seed shape changed re-seeds an existing database on start.
- Replit's managed PostgreSQL requires TLS; the pool enables it when `DATABASE_URL` carries `sslmode=require` (or `PGSSL=true`).
- The reversed Tasama lockup was derived by Cognirise (Tasama publishes none) — replace before client use.
- Persona amount limits and the rate card are placeholders; Tasama's delegation of authority and price list are not in the material.
