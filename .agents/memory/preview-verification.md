---
name: Preview verification
description: Avoid interpreting a cached app screenshot as the newly rebuilt UI
---

Repeated captures of the same preview URL can show a cached app shell after a successful rebuild and workflow restart.

**Why:** A capture still showed the previous overview layout even though the served HTML referenced the new bundle; a new query string showed the correct layout.

**How to apply:** When a capture contradicts current source and build output, verify the served asset reference and use a fresh query string for the screenshot before making further edits.
