# Tasama Mizan

Imported from the user's ZIP, following its README: a synthetic-data demonstration of Tasama's own lead-to-cash, close, bank reconciliation and budget processes.

## Run & Operate

- Managed workflow: `artifacts/tasama-mizan: web` — builds the supplied React app, then starts its Express server.
- `pnpm --filter @workspace/tasama-mizan run typecheck` — checks the imported design system, domain, server and web app.
- `pnpm --filter @workspace/tasama-mizan run check:world` — supplied arithmetic and reducer checks.
- `pnpm --filter @workspace/tasama-mizan run build` — build the web app.
- `pnpm --filter @workspace/tasama-mizan run build:standalone` — regenerate the standalone HTML.
- `DATABASE_URL` is supplied by the project's managed PostgreSQL database.
- CogniDocs defaults to simulated mode. Live mode is optional and requires a configured service; do not request or expose credentials outside the secrets flow.

## Canonical Source

The imported app is in `artifacts/tasama-mizan/source/`. Its `README.md` contains the original setup instructions and product boundaries; `design/DESIGN.md` contains the detailed design.

- `source/apps/web/` — the actual React frontend and seven screens.
- `source/apps/server/` — the actual Express server, PostgreSQL store and SQL schema.
- `source/packages/domain/` — shared world, reducer, derivations, workflow model and simulated connectors.
- `source/packages/design-system/` — supplied Tasama-branded Atelier components and tokens.
- `source/Tasama-Mizan.html` and `source/samples/` — original standalone build and PDFs.

The top-level artifact's original Vite scaffold is not the app entry. Use the imported source above.

## Decisions and Boundaries

- Preserve the supplied interface and domain model rather than reimplementing them. **Why:** the user asked to follow the archive's README, not redesign the product.
- Preserve the original one-process Express architecture. **Why:** its server owns the shared world and serves the built frontend; separating it would unnecessarily change its persistence contract.
- Imported packages are linked through the existing pnpm workspace; the source's npm commands have corresponding artifact wrapper scripts.
- Mizan's API paths are routed specifically to its service so the template `/api` server cannot intercept them. The template health endpoint remains at `/api/healthz`.
- Development may create the imported schema. Production startup does not perform DDL; managed production schema changes belong to Publish.

## Product Safety

Everything is synthetic, except the client-company names described in the original README. External ERP, CRM, CLM, tax and bank connectors remain simulated.

This is a demonstration, not a production finance system: there is no sign-in, every visitor shares one world, personas are a demo authority picker, and Reset the demo replaces the shared demo data.

Scope is Tasama's own finance. Finance operations delivered as a service for Tasama's clients are intentionally excluded.

## Gotchas

- Keep the supplied `rollup@4.63.3` and `vite@7.3.6` pins unless a replacement build is tested; the original README documents a Rollup 4.64.0 tree-shaking hang.
- The app is mounted at `/`; original brand, sample and API URLs depend on that.
- Do not reset an existing world merely to troubleshoot an import or startup.
