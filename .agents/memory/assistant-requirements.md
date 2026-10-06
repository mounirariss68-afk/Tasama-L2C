---
name: Assistant requirements
description: User's requirement for real Claude request processing, not the archive's rule-matching demo
---

The Tasama Mizan assistant must connect to Claude and process natural-language requests. The uploaded rule-based matcher is not an acceptable substitute for that requirement.

**Why:** The user explicitly corrected the initial import as incomplete because it still showed “Offline · matching.”

**How to apply:** Preserve live Claude request processing in future changes. Do not silently replace failed model calls with deterministic matching or describe the app as complete when only the imported demo assistant is available.

The chat's user-facing identity is Muhasib, not Claude: “Ask Muhasib” in the composer, “Muhasib is processing your request…” while waiting, and no Claude badge at the top.

**Why:** The user explicitly requested Muhasib branding for the chat.

**How to apply:** Keep provider details internal to the implementation; use Muhasib in chat copy and user-visible errors.

Muhasib must answer English questions in English, not Arabic.

**Why:** The user reported Arabic responses to English questions and explicitly requested a fix.

**How to apply:** Determine reply language from the current question, not past replies, persona names or bilingual branding.
