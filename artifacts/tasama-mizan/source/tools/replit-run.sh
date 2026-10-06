#!/usr/bin/env bash
# First run installs and builds (2–3 minutes); later runs start in seconds.
set -e
cd "$(dirname "$0")/.."
if [ ! -d node_modules ]; then npm install --include=dev --no-audit --no-fund; fi
if [ ! -f apps/web/dist/index.html ] || [ -n "$(find apps/web/src packages/design-system/src packages/domain/src -newer apps/web/dist/index.html -type f 2>/dev/null | head -1)" ]; then npm run build; fi
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set — the app will run in browser-only mode."
  echo "In Replit: open the Database tool (left toolbar) → create a PostgreSQL database → press Run again."
fi
npm start
