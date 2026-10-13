# Tasama Mizan

Imported from the user's ZIP, following its README: a synthetic-data demonstration of Tasama's own lead-to-cash, close, bank reconciliation and budget processes.

## Run & Operate

- Managed workflow: `artifacts/tasama-mizan: web` — builds the supplied React app, then starts its Express server.
- `pnpm --filter @workspace/tasama-mizan run typecheck` — checks the imported design system, domain, server and web app.
- `pnpm --filter @workspace/tasama-mizan run check:world` — arithmetic and reducer checks on the synthetic world (136).
- `pnpm --filter @workspace/tasama-mizan run check:close` — Tasama's 24 closing procedures, derived statuses, and every Director scenario applied through the reducer.
- `pnpm --filter @workspace/tasama-mizan run build` — build the web app.
- `pnpm --filter @workspace/tasama-mizan run build:standalone` — regenerate the standalone HTML.
- `DATABASE_URL` is supplied by the project's managed PostgreSQL database.
- CogniDocs defaults to simulated mode. Live mode is optional and requires a configured service; do not request or expose credentials outside the secrets flow.

## Canonical Source

The imported app is in `artifacts/tasama-mizan/source/`. Its `README.md` contains the original setup instructions and product boundaries; `design/DESIGN.md` contains the detailed design.

- `source/apps/web/` — the actual React frontend: Overview · Inbox · Lead to cash · Documents · Close · Agents · Scenarios · Settings, plus the Demo Director bar (`src/app/director.tsx`).
- `source/apps/server/` — the actual Express server, PostgreSQL store and SQL schema.
- `source/packages/domain/` — shared world, reducer, derivations, workflow model, the four-stage process, the six Director scenario scripts (`scenarios.ts`) and simulated connectors.
- `source/packages/design-system/` — supplied Tasama-branded Atelier components and tokens.
- `source/Tasama-Mizan.html` and `source/samples/` — original standalone build and PDFs.

The top-level artifact's original Vite scaffold is not the app entry. Use the imported source above.

## Decisions and Boundaries

- Preserve the supplied interface and domain model rather than reimplementing them. **Why:** the user asked to follow the archive's README, not redesign the product.
- Preserve the original one-process Express architecture. **Why:** its server owns the shared world and serves the built frontend; separating it would unnecessarily change its persistence contract.
- Imported packages are linked through the existing pnpm workspace; the source's npm commands have corresponding artifact wrapper scripts.
- Mizan's API paths are routed specifically to its service so the template `/api` server cannot intercept them. The template health endpoint remains at `/api/healthz`.
- Startup runs the idempotent schema (`create … if not exists` plus `alter table … add column if not exists`) in every environment, then re-seeds when `world_meta.seedVersion` differs from the build's `SEED_VERSION` (`store.ts`). The demo world is deterministic; a re-seed loses nothing of value. **Why:** the close columns changed on 13 Oct 2026 and an existing database must follow without manual steps.

## Close (13 Oct 2026)

Tasama's own "Monthly Closing Procedures" (24 rows: area, action, responsible, deadline, automation — the PDF is in `source/design/`) are the close checklist, as `CloseItem` records P01–P24 in `world.ts`. Their status is **derived** in `derive.ts` (`deriveCloseItems`) from billing, cash, bank, vendor, journal, budget and period state; procedures 12–16 (Fixed Assets, Leases) are `external` — outside Mizan, never shown as done. The earlier workpaper module (period switching, Initialize, calendar configuration, evidence forms, department personas) was removed on the user's decision: it hid the agents and overloaded the demo. Do not reintroduce forms for the close; a procedure's status comes from the data or is labelled as outside Mizan.

## Demo Director (13 Oct 2026)

Scenarios are step scripts (`packages/domain/src/scenarios.ts`): title, narration, trigger, action, screen, persona. The Director bar (`apps/web/src/app/director.tsx`) plays them one step at a time — Back / Step / Play / Stop — switches the persona, opens the screen, runs the action through `POST /api/actions`, and lists what changed by diffing the world before and after. A scenario that already ran on the world says so and offers Reset. This is the same demo pattern as Tasama HR and QIB Jahiz; keep it.

## Product Safety

Everything is synthetic, except the client-company names described in the original README. External ERP, CRM, CLM, tax and bank connectors remain simulated.

This is a demonstration, not a production finance system: there is no sign-in, every visitor shares one world, personas are a demo authority picker, and Reset the demo replaces the shared demo data.

## Claude Assistant

The running app uses live Claude through Replit AI Integrations, not the original rule-based chat resolver. Access is server-side, with provisioned credentials; usage is billed to Replit credits.

The assistant reads the current PostgreSQL world through bounded tools (`read_close_checklist`, `financial_summary`, `read_records`, `propose_action`), computes financial summaries using the existing domain derivations, and prepares supported finance actions. A visible confirmation is required before any change is applied. Proposals expire after 15 minutes, are bound to the requesting persona and world revision, and are revalidated against the current inbox authority and demo limits at confirmation. Another change invalidates an older proposal; request a new review rather than applying stale advice.

Confirmation-card descriptions are derived server-side from a reducer dry run, not trusted model prose. **Why:** a model can describe a bulk action as affecting one record; the approval UI must accurately show its actual scope.

The frontend accepts the returned persisted world immediately; normal revision polling updates other browsers. AI errors are explicit, with no silent rule-based fallback. Specialist workflows, ERP, bank, tax and email integrations remain simulated.

- `pnpm --filter @mizan/server run check:assistant` — validates proposal non-mutation, role gates, close blockers and action inputs.
- Claude requests are rate-limited with bounded concurrent inference. This does not replace authentication: the inherited persona picker is a demo selector, not an authenticated identity. Restrict access before using real financial records or exposing paid inference widely.

Scope is Tasama's own finance. Finance operations delivered as a service for Tasama's clients are intentionally excluded.

## Gotchas

- Keep the supplied `rollup@4.63.3` and `vite@7.3.6` pins unless a replacement build is tested; the original README documents a Rollup 4.64.0 tree-shaking hang.
- The app is mounted at `/`; original brand, sample and API URLs depend on that.
- Do not reset an existing world merely to troubleshoot an import or startup.
