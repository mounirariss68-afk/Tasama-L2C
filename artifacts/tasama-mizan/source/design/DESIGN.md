# Tasama Mizan — Lead-to-Cash and Close platform

**Design document · v2 · 6 October 2026 · Cognirise for TASAMA Business Services**

Status: design complete and built. v2 re-cuts the process into the four stages the demo is organised by (Lead-to-Contract · Contract-to-Service · Service-to-Cash · Close), states the scope boundary explicitly, and moves the world from the browser to a server-owned PostgreSQL database (section 10.4). Everything below was derived from the Tasama material in `~/Downloads/Tasama` (54 files extracted to `research/extracts/`), the attached *DT – Finance Process Baseline* deck, the CogniDocs API guide, and public research on Tasama (`research/01-…04-….md`). Where a fact comes from Tasama's own documents it is marked **[T]**; where it is a design decision of ours it is marked **[D]**; where it is an assumption that Tasama must confirm it is marked **[A]**.

---

## 1. What the research says, in one page

**Who Tasama is.** PIF-owned business-services company launched July 2025 from the merger of BIAC and the PIF Shared Services Centre. Three service layers: Business Enablement (BES), Smart Enterprise Services (SES — finance, HR, procurement, legal, PMO, technology operations; "primary focus"), Enterprise Value-Added Services (EVAS). Revenue target 2025 SAR 502M; D&T alone had SAR 39.2M by Oct 2025. Board KPIs include revenue incl./excl. the PIF Service Agreement, share of non-PIF revenue (23% target, 7% actual), gross margin (49% target, −17% actual Jan–Apr 2026), CSAT, long-term contract value ratio. **[T]**

**Two finance worlds — do not confuse them.** World A is finance-as-a-service that Tasama delivers *to* client "NewCos" (the FAP_100_xxx processes in the attached deck; AP-heavy; 10 clients on Oracle, 10 manual). World B is Tasama's **own** finance: how Tasama sells, bills and collects. This platform is World B. World A is used only for what it teaches (section 1.3). **[T]**

**How Tasama sells and bills today.** Multi-year MSA per client → proposal (`T#####_MMYY`) → client PO per service bundle (client-specific PO number formats) → PO lines tagged by service line (`ERP`, `AMS`, `TechF`, `PMIS`, `EPMO`, `Service Now`) → delivery → **Delivery Note / Certificate of Completion (CoC) sign-off gates invoicing** → invoice `YYYYMM####` excl. VAT → collection tracked as Yes/No. All of it lives in one spreadsheet, *PO Summary* (557 rows, 21 columns, mixed PO-line and invoice grain), with an overloaded status column that includes the values `To Invoice: Missed`, `To check payment`, `Credit Note`, `To Invoice-Completed 50%`. Revenue is booked per client PO per month in another sheet, cost-to-deliver is tied back through 4-digit Tasama vendor PO numbers. **[T]**

**Pricing models in use.** Monthly subscription bundle with volume caps and add-ons; dedicated resource per month; T&M day rate billed monthly on days (e.g. SAR 4,312/day Oracle functional specialist); fixed milestones (20–25% each, "at Production sign-off", "at Go-Live"); annual licence pass-through at cost +15%; management fee % (7.5% on spend bands, 20% servicing fee); hour bundles (legal 100 h at SAR 2,500/h); retainer. Currencies SAR and USD at 3.75. Discounts "up to 7%". **[T]**

**The pain, in Tasama's words.** "Invoicing is requested manually through Excel, then processed via ERP." "PRs/POs/CoCs are manually raised and are not linked to specific deals." "Payments are captured through Oracle ERP and there is no integration with any banks, hence relying on receiving transactions from the bank and do manual reconciliation." "Revenue assurance; ensuring a timely and accurate billing as well as collection." "The current process covers only half of the sales cycle; workflows stop at the proposal stage." "Several financial activities — including COC approvals, invoice approvals, credit note adjustments and pre-engagement spendings — are handled manually via email or outside the system." "Revenue data is entered manually, with company-wide financial tracking managed through Excel." Stage 3 of their own lifecycle map (service management → invoice → collection → renewal → close) is marked **"TO BE DEVELOPED"** and "not started due to resource limitations". **[T]**

**Systems.** Corporate ERP: Oracle Fusion Cloud (Financials, PPM, Project Contract Billing, ZATCA point-to-point integration — the only integration they have). CRM: Oracle CX today, Salesforce Sales + Revenue Cloud in implementation (delayed, target Aug 2026). CLM: Sirion (delayed, target Oct 2026). ERP for the BPO operations team: Odoo (in implementation, target Oct 2026). Service management: ServiceNow. Reporting: Power BI. Agentic platform: "TASAMA Core" (kick-off done). Core-systems integration: planned May–Oct 2026, budget "N/A". **[T]**

**What this means for the design.** The gap is not a CRM and not an ERP — both are being bought. The gap is the **revenue operations layer between them**: the object that knows what was contracted, what was delivered, what should have been invoiced, what was invoiced, what was paid, and whether the month can close. That object exists today as a spreadsheet maintained by hand. Mizan is that object, with agents doing the chasing, matching and reconciling, and people deciding. **[D]**

### 1.1 What the external (client-facing) finance processes teach

The attached baseline covers AP and payments that Tasama runs for its clients. Four things transfer directly to Tasama's own lead-to-cash **[D]**:

1. **The CoC gate is universal.** In World A, AP posting waits on "Delivery Approval / COC Signed?"; in World B, invoicing waits on "DN Sign-off Status = Available". Same control, opposite direction. Mizan treats *acceptance evidence* as a first-class object with its own agent.
2. **Their close SLA is 10 business days after month end, bank statements due day 1** (SLA F005). Mizan's close is designed to that calendar and shows the day counter.
3. **The 3-way match discipline** (invoice ↔ PO ↔ CoC) becomes, on the revenue side, a **4-way assurance**: contract ↔ delivery ↔ invoice ↔ cash. That is the Revenue Assurance agent.
4. **Their effort figures are the baseline for the business case**: AP manual 40.5 min vs ERP 21.5 min per invoice; payment manual 80 min vs ERP 27.5 min; "15 min per payment" on the bank portal; senior review "might take up to 1 month". Mizan's stats panels use the same units.

### 1.2 What is deliberately not in scope

- Lead, opportunity and quote management — Salesforce. Mizan reads pipeline for forecasting only.
- Contract authoring and e-signature — Sirion. Mizan reads billing terms.
- General ledger, sub-ledgers, tax engine, ZATCA submission — the ERP. Mizan proposes and posts through an adapter; it is not a ledger.
- Security, roles, SSO, audit retention — demo prototype; personas are a switcher, not authentication.
- Client-facing finance services (World A) — a separate product (Tasama's O2C/AP service charters already exist).

---

## 2. Scope and the three questions the demo must answer

**Scope boundary, stated once and checked.** Mizan covers Tasama's *own* finance — World B: how Tasama sells, contracts, delivers, bills, collects and closes its own books, on its own ERP, bank accounts and budget. It contains **no** coverage of the finance services Tasama performs *for* its clients (World A: the FAP_100_xxx accounts-payable, payments and client month-end processes in the *Finance Process Baseline* deck). That deck was read for lessons only (section 1.1). The build was grepped for World-A identifiers (`FAP_`, `NewCo`, `F005`) before delivery; none remain in the application. Tasama's own client-facing close SLA (statements Day 1, close by Day 10) is reused as the *outer bound* of Tasama's own close calendar, because it is the only close calendar in the material; it is a borrowed number, not a borrowed process. **[D]**

Tasama asked for a prototype that shows how Cognirise can help with **month closure**, **budget reconciliation**, and the broader **lead-to-cash** problem (CRM has some data, contracts hold other data, invoices get missed). The demo therefore has to answer, on screen, in this order:

1. **"What should we have invoiced this month, and did we?"** — the billing schedule derived from contracts and POs, compared with invoices issued; the missed, blocked and late ones named, with the reason (no CoC, PO exhausted, rate mismatch, nobody raised it).
2. **"Can we close September?"** — a close checklist with a day counter, every item owned, every blocker named, the journals proposed (unbilled revenue accrual, deferred revenue, vendor accruals, bank charges), the bank accounts reconciled to zero or with the difference explained, and the AR sub-ledger tied to the GL.
3. **"Where are we against budget, and why?"** — Budget · Target · Forecast · Actual by month and business line (Tasama's own four columns), drill to client and PO line, with the variance decomposed into timing, missed billing, scope not received, and rate.

Plus the integration proof: **upload a vendor invoice, a receipt or a bank statement PDF → CogniDocs itemises it → the result lands in the right queue** (cost matching, expense rebilling, cash application / bank reconciliation).

---

## 3. The lead-to-cash process — four stages (to-be, Tasama internal)

The demo is organised by **four stages**. The first three are Tasama's own lifecycle names (**Stage 1 Lead to Contract** — L2S · S2P · P2C; **Stage 2 Contract to Service Management**; **Stage 3 Service Management to Contract Close**, the one marked "TO BE DEVELOPED"); the fourth, **Close**, is split out of Stage 3 because month-end is a job in its own right with its own owner, calendar and sign-off. Mizan *reads* Stage 1 and *operates* Stages 2–4 with the ERP. **[T][D]**

The same four stages are a first-class object in the build (`packages/domain/src/process.ts`): the **Lead to cash → Process** tab shows them with live metrics derived from the world, every step with actor · system of record · what Mizan does · gate · agent and autonomy · coverage, and a link to the workflow that implements it; the Overview carries a four-stage strip; the nine workflows are each tagged with their stage and grouped by it on the Agents screen.

| Stage | Question it answers | Owner | Systems of record | Mizan | Agents | Steps |
|---|---|---|---|---|---|---|
| **1 Lead-to-Contract** | What have we promised, to whom, on what terms? | Chief Commercial — Sales, Solutioning, KAM, Legal | Salesforce Sales, Salesforce Revenue Cloud (CPQ), Sirion | reads | Mizaniya (A0), Aqd (A1) | 4 |
| **2 Contract-to-Service** | What instrument lets us bill, and what will we bill when? | KAM, Service Delivery Lead, Head of Revenue & Treasury | Mizan (PO register, billing schedule), ERP customer account, ServiceNow/PPM, Oracle Procurement | operates with the ERP | Aqd (A1/A2), Mawrid (A0) | 5 |
| **3 Service-to-Cash** | Did we deliver, did we bill it, did we get paid? | Head of Revenue & Treasury; KAM for the client contact | Mizan, PPM/ServiceNow/timesheets, ERP AR, ZATCA, banks via CogniDocs | operates with the ERP | Shahid (A3), Fatoora (A2), Hares (A1), Tahseel (A2/A3), Tasweya (A3/A1), Mawrid (A2) | 7 |
| **4 Close** | Can we close the month, and where are we against budget? | Accounting Manager, CFO; FP&A for the forecast | Mizan, ERP GL and cash management, banks via CogniDocs, Power BI | operates with the ERP | Iqfal (A2/A3), Tasweya (A2), Mawrid (A2), Mizaniya (A1), Fatoora (A3) | 8 |

Each step below states: actor · system of record · what Mizan does · gate · agent and autonomy · coverage in this build (`implemented` / `partial` / `read-only`).

### 3.1 Stage 1 — Lead-to-Contract (Mizan reads)

| # | Step | Actor | System | Mizan | Gate | Agent | Coverage |
|---|---|---|---|---|---|---|---|
| 1.1 | Lead captured and qualified (Deal Review 1–2) | Sales / Business Development | Salesforce Sales | Reads the weighted pipeline by business line and month for the revenue forecast only | — | Mizaniya (A0) | read-only |
| 1.2 | Proposal, pricing and Deal Review Committee | Sales, Solutioning team, DRC | Salesforce Revenue Cloud (CPQ) | Reads quote lines — service, pricing model, unit, rate, quantity, term — to match the PO against later | — | — | read-only |
| 1.3 | Contract or MSA negotiated, signed and logged | Legal, KAM | Sirion | Extracts the billing terms: payment days, billing frequency, milestones, rate card version, caps, CoC requirement, expiry | Signed contract logged in Sirion | Aqd (A1) | implemented (wf-01) |
| 1.4 | Renewal and expiry watch | Aqd → KAM | Sirion / Mizan | Flags contracts expiring within 90/60/30 days and POs above the consumption threshold; drafts the renewal pack | — | Aqd (A1) | partial (wf-09) |

What the build shows for Stage 1: the **Contracts** tab — six opportunities read from Salesforce (simulated) with stage, amount, probability, expected start and owner, and the weighted pipeline derived from them; the nine contracts with the terms Aqd extracts (payment days, CoC requirement, rate card, source, expiry watch). Nothing in Stage 1 is edited in Mizan.

### 3.2 Stage 2 — Contract-to-Service (Mizan operates)

| # | Step | Actor | System | Mizan | Gate | Agent | Coverage |
|---|---|---|---|---|---|---|---|
| 2.1 | **Client PO received and registered** (email / Business Center / Etimad) | Client → KAM | Mizan → ERP customer account | Registers the PO in the client's own number format with its lines; mirrors the customer account to the ERP | PO references a signed contract or quote | Aqd (A2) | implemented (wf-01) |
| 2.2 | **PO lines matched to quote lines** | Aqd | Mizan | Flags price, quantity, term and missing-line mismatches and expired contracts; the KAM resolves them with the client | — | Aqd (A2) | implemented (wf-01) |
| 2.3 | **Billing schedule generated and confirmed** | Aqd → Head of Revenue & Treasury | Mizan | Expands every PO line into dated billing events by pricing model (section 3.5), each with its evidence requirement | Schedule confirmed by the Head of Revenue & Treasury | Aqd (A1) | implemented (wf-01) |
| 2.4 | Delivery mobilised (PIW, governance) | KAM, Service Delivery Lead | ServiceNow / PPM | Reads the project ID, business line and delivery owner | — | — | read-only |
| 2.5 | Vendor PO raised for subcontracted or pass-through scope | Procurement | Oracle Fusion Procurement | Links the vendor PO to the client PO line so cost and margin exist per line | — | Mawrid (A0) | implemented (wf-07) |

What the build shows for Stage 2: the **Orders & schedules** tab — ten POs with consumption, uncovered value, mismatch flags and schedule confirmation; PO detail with every line's billing events, evidence, CoC and status.

### 3.3 Stage 3 — Service-to-Cash (Mizan operates)

| # | Step | Actor | System | Mizan | Gate | Agent | Coverage |
|---|---|---|---|---|---|---|---|
| 3.1 | **Delivery evidence collected** per billing event: days (timesheets), AMS month elapsed, milestone acceptance (PPM), licence activation, volumes | Service Delivery Lead, PPM | PPM / ServiceNow / timesheets → Mizan | Attaches the evidence to the event; computes readiness | — | Shahid (A3) | implemented (wf-02) |
| 3.2 | **Certificate of completion requested, chased, escalated** | Shahid → client → KAM | Mizan (email) | Drafts the request with the evidence pack; reminds at +3, +7, +10 working days; escalates to the KAM when exhausted | CoC signed where the contract requires it | Shahid (A3; A2 to send, A1 to escalate) | implemented (wf-02) |
| 3.3 | **Invoice drafted, released, posted, cleared** | Fatoora → Head of Revenue & Treasury → ERP → ZATCA | Mizan → Oracle AR / Odoo → ZATCA | Drafts when due and evidenced; validates the ZATCA fields; posts on release; reads back clearance; handles rejections | Release by amount authority; ZATCA clearance | Fatoora (A2) | implemented (wf-03) |
| 3.4 | **Revenue assurance — the four-way check** | Hares | Mizan | Daily: delivered-not-invoiced, under-rate, PO over-consumed, delivery on expired cover, unreasoned credit notes, clearance rejections | Each finding becomes an inbox item | Hares (A1) | implemented (wf-04) |
| 3.5 | **Collections** | Tahseel → KAM | Mizan (email) | Ages every open invoice; stages dunning by segment and channel (due +7 / +21 / +45; Etimad accounts shifted); drafts the notice; logs promises and disputes; escalates | KAM approves notices to PIF and Government accounts; auto for private accounts under the threshold | Tahseel (A2 PIF/Gov, A3 private < SAR 100k) | implemented (wf-05) |
| 3.6 | **Cash application** | Tasweya | Bank statement (CogniDocs) → Mizan → ERP receipts | Matches credits to invoices by reference → amount + client → tolerance → one-to-many; applies exact matches, proposes the rest | Proposed matches approved by the Head of Revenue & Treasury | Tasweya (A3 exact, A1 otherwise) | implemented (wf-06) |
| 3.7 | **Cost of delivery matched** | Mawrid → Accountant | Vendor invoice (CogniDocs) → Mizan → ERP AP | Three-way match to vendor PO and delivery; allocation to the client PO line; pass-through billing event; refusal of duplicates and no-PO invoices | Match approved by the Accountant | Mawrid (A2) | implemented (wf-07) |

What the build shows for Stage 3: the **Billing** tab (intake → in flight → output, the billing run), **Collections** (ageing, dunning, DSO by segment), the **Documents** screen (CogniDocs), and the Inbox items each step produces.

### 3.4 Stage 4 — Close (Mizan operates)

| # | Step | Actor | System | Mizan | Gate | Agent | Coverage |
|---|---|---|---|---|---|---|---|
| 4.1 | **Checklist derived from the data** | Iqfal | Mizan | Status of every item read from the ledger, the schedule and the reconciliations — billing complete, cash applied, accounts explained, vendors matched, ZATCA clean | — | Iqfal (A3) | implemented (wf-08) |
| 4.2 | **Revenue cut-off: unbilled accrual and deferred release** | Iqfal → Accounting Manager | Mizan → ERP GL | Computes the contract asset from delivered-not-invoiced events and the deferred release from advance invoices; proposes the journals | Journals approved by the Accounting Manager | Iqfal (A2) | implemented (wf-08) |
| 4.3 | **Bank reconciliation per account** | Tasweya → Accounting Manager | Bank statements (CogniDocs) → Mizan → ERP cash management | Statement balance, ledger balance, open items on both sides, proposed adjustments (charges, FX, timing); proof to the open items | Sign-off requires the difference to equal the open items | Tasweya (A2) | implemented (wf-06) |
| 4.4 | **AR sub-ledger tied to GL; ageing reviewed** | Iqfal, Tahseel → Head of Revenue & Treasury | Mizan | Ties receivables to the control account; confirms dunning stages with the KAMs; assesses provisioning | — | Iqfal (A3) | implemented (wf-08) |
| 4.5 | **Cost of delivery accrued; margin reviewed** | Mawrid, Mizaniya → CFO | Mizan → ERP GL | Accrues delivered-not-invoiced vendor cost; gross margin by client and line against the 23% target | — | Mawrid (A2) | implemented (wf-07) |
| 4.6 | **Budget · Target · Forecast · Actual and the reforecast** | Mizaniya → FP&A | Mizan | Variance by business line decomposed into drivers in the words of the contract; forecast re-cut from the schedule and the weighted pipeline | FP&A accepts the reforecast | Mizaniya (A1) | implemented (wf-08) |
| 4.7 | **Tax: VAT output reconciled to cleared invoices** | Fatoora → Accountant | Mizan ↔ ZATCA status | No rejected invoice may remain; output VAT ties to cleared invoices | — | Fatoora (A3) | implemented |
| 4.8 | **Close pack and period close** | Iqfal → CFO | Mizan → Power BI | Management-accounts schedules assembled; the CFO closes when every item is done, or holds with the blocker named | CFO sign-off | Iqfal (A3) | partial (wf-08) |

What the build shows for Stage 4: the **Close** screen — checklist, bank reconciliation, budget vs actual with drivers, journals with ERP posting previews — and the close-day counter on the Overview.

### 3.5 The billing-schedule engine (the heart of Stage 2 → 3)

Every PO line carries a **pricing model** and the engine expands it into dated **billing events** with an expected amount and an **evidence requirement**. **[D]**

| Pricing model (Tasama examples) | Event generation | Expected amount | Evidence to bill |
|---|---|---|---|
| `monthly_fixed` — AMS retainer, managed-service bundle, dedicated resource | One event per calendar month in term | contracted monthly fee | Month elapsed; CoC/DN monthly if the contract says so |
| `monthly_variable_days` — T&M day rate | One event per month | days delivered × day rate (cap at PO balance) | Approved timesheet / days confirmation |
| `monthly_variable_volume` — bundle with caps + add-on units (e.g. 50 JEs, 5 AP invoices) | One event per month | base fee + max(0, volume − cap) × unit price | Volume report from delivery |
| `milestone` — % of fixed fee | One event per milestone | fixed fee × % | Milestone acceptance (PPM) + CoC |
| `one_off` — set-up fee, activation, transition | Single event at trigger | fixed | Delivery confirmation |
| `pass_through` — licences, hardware, subcontractor | Event when vendor invoice matched | vendor cost × (1 + mark-up) | Matched vendor invoice + delivery |
| `advance` — paid in advance | Event at start; revenue deferred and released by month | fixed | Contract start |

Derived from the schedule, never authored: **unbilled revenue** (events delivered with evidence but not invoiced), **deferred revenue** (invoiced in advance of delivery), **missed billing** (past due, evidence available, no invoice, no block), **blocked billing** (past due, evidence missing), **PO consumption** (invoiced + unbilled ÷ PO value), **revenue recognised** (delivered in month regardless of invoice — the accrual basis the close needs).

---

## 4. The agents

Nine agents plus the in-app assistant. Names are Arabic words for the job, in the style Tasama already saw in the HR prototype (Rafeeq, Murshid). Autonomy is labelled at the rung the prototype actually runs at. **[D]**

| Agent | Job title (Tasama vocabulary) | Purpose (one sentence) | Autonomy as built |
|---|---|---|---|
| **Aqd** (عقد, contract) | Contract & Order Terms Analyst | Turns a signed contract and a client PO into a confirmed billing schedule, and flags where the PO disagrees with the quote or the contract has expired. | A1 recommend (schedule), A2 assisted (PO–quote match) |
| **Shahid** (شاهد, witness) | Delivery Evidence & CoC Coordinator | Collects the evidence a billing event needs, drafts and sends the CoC request, chases it, and escalates when it stalls. | A3 supervised (reminders), A2 (sending the request), A1 (escalation) |
| **Fatoora** (فاتورة, invoice) | Billing Agent | Drafts invoices when an event is due and evidenced, pre-validates ZATCA fields, posts to the ERP once approved, and handles clearance rejections. | A2 assisted |
| **Hares** (حارس, guard) | Revenue Assurance Analyst | Runs the 4-way check contract ↔ delivery ↔ invoice ↔ cash daily and names every leak: missed, late, under-rate, over-PO, expired-contract delivery, unreasoned credit notes. | A1 recommend |
| **Tahseel** (تحصيل, collection) | Collections Agent | Works the ageing: dunning in the right tone and language, promise-to-pay tracking, dispute flags, escalation to the KAM. | A2 (PIF / Government accounts), A3 (private accounts below SAR 100k) |
| **Tasweya** (تسوية, settlement) | Cash Application & Bank Reconciliation Agent | Reads bank statements (via CogniDocs), applies receipts to invoices, reconciles every account to the ledger and proposes the adjusting entries. | A3 (exact matches), A1 (fuzzy), A2 (adjusting journals) |
| **Mawrid** (مورد, supplier) | Cost-to-Deliver Agent | Reads vendor invoices (via CogniDocs), 3-way matches them to vendor POs and delivery, allocates cost to the client PO line, and raises the pass-through invoice event. | A2 assisted |
| **Iqfal** (إقفال, closing) | Close Orchestrator | Runs the month-end checklist against the day counter, computes accruals and deferrals, ties AR to GL, assembles the close pack, and names what blocks the close. | A3 (checklist, pack), A2 (journals) |
| **Mizaniya** (ميزانية, budget) | Budget & Forecast Analyst | Compares Budget · Target · Forecast · Actual by month, business line and client, decomposes variances into causes, and proposes the reforecast. | A1 recommend |
| **Muhasib** (محاسب, accountant) — assistant | Finance co-pilot in the chat rail | Answers from the same data the screens use and routes to the owning agent; navigation and record lookup. | Deterministic local resolver — **not an LLM** in the standalone build; labelled "Offline" |

Profile blocks per agent, in the Atelier order: Functions (numbered), Superpower, Business impact, Stats. Stats are derived from the synthetic ledger (e.g. Fatoora: invoices drafted this month, median draft-to-approve hours, ZATCA first-pass clearance rate; Tasweya: auto-match rate, unapplied cash; Hares: leakage found SAR, leakage recovered SAR).

**Decision trail.** Every agent act writes a trail row: actor, act, autonomy, record, and — when a human changed the outcome — the override and its reason. Overrides render prominently. Trail is shown under each inbox item, in each agent profile, and on the Agents screen.

---

## 5. Personas and authority

Switching persona changes the inbox, the approvable set, the amounts and the menu. Names are fictional; roles follow Tasama's org (Chief Finance → Accounting; Revenue & Treasury; Reporting & Budgeting; Chief Commercial → KAM; Chief Operations → Service Delivery). **[T][D]**

| Persona | Role | May approve | Sees |
|---|---|---|---|
| Noura Al-Harbi | Chief Financial Officer | Close sign-off; write-offs; credit notes > SAR 250k; reforecast | Everything; Overview first |
| Faisal Al-Dossary | Head of Revenue & Treasury | Invoice release (any amount); dunning to PIF/Gov; cash application overrides; bank rec sign-off | Overview, Inbox, Lead to Cash, Documents, Close, Agents, Settings |
| Reem Al-Qahtani | Accounting Manager | Journals (accruals, deferrals, adjustments); vendor invoice matches; close checklist items | Inbox, Documents, Close, Agents, Settings |
| Omar Siddiqui | Accountant | Prepares; approves nothing above SAR 50k; runs reconciliations | Inbox, Documents, Close |
| Majed Al-Otaibi | Key Account Manager (PIF accounts) | CoC requests to his clients; dunning tone and timing; disputes | Inbox (his clients), Lead to Cash (his clients) |
| Dina Haddad | Service Delivery Lead | Confirms delivery evidence; milestone acceptance | Inbox (evidence requests), Lead to Cash (delivery lane) |

---

## 6. Screens

Seven menu items. Workspace-shaped, not role-shaped (the Ascend lesson). All inside `<MainPanel>`; Atelier glass scale L1 → L2 → L3; `<DemoBanner>` on every screen built on fabricated events; every fabricated identifier prefixed `DEMO-`. **[D]**

### 6.1 Overview — "Can we close, and where is the money?"
- Hero island: **September 2026 close — Day 4 of 10**, items done / open / blocked, and the one sentence that matters (e.g. "SAR 1.42M of delivered work is unbilled; 3 invoices are blocked on CoC").
- The **lead-to-cash waterfall** for the month: Contracted (schedule) → Evidenced → Invoiced → Cleared (ZATCA) → Collected, with the drop at each step named.
- Stat row: unbilled revenue, overdue AR, DSO, cash applied this month, gross margin MTD vs target 23% (their data-model target), forecast vs budget FY.
- Budget · Target · Forecast · Actual chart by month (Tasama's four columns) with the September actual landing.
- **The process, in four stages** — one card per stage with its headline number and the item flagged (expired cover, mismatch flags, blocked events, blocked close items); each opens the Process tab.
- Attention feed (FeedCard: tags, timestamp, headline, consequence) — the top findings from Hares, Tasweya, Iqfal.

### 6.2 Inbox — "What is waiting on me?"
Tabs: *Needs my decision* (count) · *Waiting on others* · *All*. Filters: agent, client, type, amount. Reader ends in a `<DecisionBar>` naming the decision and the authority ("Release invoice DEMO-INV-2026090041 for SAR 258,750 — Head of Revenue & Treasury"). Item types: release invoice; confirm billing schedule; approve CoC request; confirm delivery evidence; approve dunning; apply cash (fuzzy match); approve vendor match; approve journal; sign off bank reconciliation; accept reforecast; acknowledge leakage finding. Each item shows the evidence, the agent's reasoning, and the trail.

### 6.3 Lead to Cash — the workspace
Six tabs, with a client lens in the title bar:
- **Process** — the four stages as cards with live metrics (section 3); the selected stage expanded into its steps (actor, system, what Mizan does, gate, agent, autonomy, coverage) with a link to the implementing workflow. This is the tab that answers "how is the process broken down".
- **Contracts** — Stage 1 as Mizan sees it: opportunities read from Salesforce (stage, amount, probability, expected start, owner; weighted pipeline derived) and the contracts with the terms Aqd extracts from Sirion (type, status, term, value, payment days, CoC requirement, rate card, source, expiry watch).
- **Orders & schedules** — Stage 2: PO register with consumption, uncovered value, mismatch flags, schedule confirmation; PO detail with every line's billing events.
- **Billing** — the month's billing events: due / evidenced / blocked / drafted / released / cleared / rejected; missed-billing list with reason; invoice detail (lines, VAT, ZATCA status, ERP document reference).
- **Collections** — ageing buckets (current, 1–30, 31–60, 61–90, 90+), per client, with dunning stage, promise-to-pay, disputes; DSO by segment (PIF / Government / Private) — Saudi B2B terms are long and PIF/Gov longer, so the segment split is the honest view.
- **Clients** — account page: contract, POs, schedule, invoices, cash, margin, Hares findings, trail.

### 6.4 Documents — the CogniDocs surface
- Upload area (PDF/PNG/JPEG/CSV ≤ 20 MB) with declared type: invoice · receipt · bank statement · auto.
- Job list: queued → processing → completed/failed, with `parserPath`, `confidence`, `detectedType`, `detailTier`, `fieldsMissing`, `aiCostAmount10k`, `sandbox`.
- Result viewer: header fields and line items (invoice/receipt) or transactions with `direction` (statement); money shown ÷ 10,000 for display only; reconciliation delta flagged, never corrected.
- Routing: completed invoice → Mawrid queue (or AR if `vendorKey` is Tasama's own); receipt → rebillable expense queue; statement → Tasweya (cash application + bank rec).
- Connection badge: **Simulated** (built-in emulator, default) or **Live** (base URL + API key from Settings; sandbox flag honoured).
- Sample documents shipped in the app (synthetic PDFs generated by us) so the upload works in a room with no files.

### 6.5 Close — "Month-end, bank and budget"
Tabs:
- **Checklist** — workstreams Revenue & Billing cut-off · Receivables · Cash & Bank · Cost of delivery · Budget & Forecast · Tax (VAT output / ZATCA clearance reconciliation) · Close pack. Each item: owner, agent, status, evidence, blocker, due day. Day timeline Day −2 … Day 10 with the Day-10 outer bound (borrowed from Tasama's own client SLA, section 2) and the Business-Case target "5 days, 2 people".
- **Bank reconciliation** — per account (SNB operating SAR, Al Rajhi collections SAR, SAB USD): statement balance, ledger balance, matched, unmatched statement lines, unmatched ledger entries, proposed adjustments, difference; line-level matching view; sign-off.
- **Budget vs actual** — month × business line: Budget | Target | Forecast | Actual | Var vs Budget | Var vs Forecast; drill to client → PO line; variance drivers: timing (CoC delay), missed billing, PO not received, rate, FX; cost side: budget adherence by cost type (Staff, Subscriptions & Professional Fees, Uncapitalized Assets, D&A…) and by vendor PO; reforecast proposal.
- **Journals** — proposed by Iqfal/Tasweya/Mawrid: unbilled revenue accrual, deferred revenue release, vendor accruals, bank charges, FX; each with the ERP posting preview in the selected dialect; approve → posted (simulated).

### 6.6 Agents
Directory (name, title, purpose, autonomy chip, activity), profile (Functions, Superpower, Business impact, Stats, recent trail), **Workflows** catalog grouped by the four stages and walkthrough (every step: actor, inputs, outputs, decision; coverage `implemented` / `partial` / `designed` / `manual`), and the full **Decision trail** with filters.

### 6.7 Settings
Persona switcher (also in the title-bar user badge); **Data**: where the world lives (PostgreSQL on the server, or this browser), revision, row counts, who sees changes, reset; **ERP**: Oracle Fusion Cloud / Odoo 19 (changes the posting previews and the connector log); **CogniDocs**: mode Simulated / Live, base URL and sandbox (shared settings), API key (kept in the browser, never in the shared store), server-proxy status; **Thresholds**: cash-match tolerance (SAR 50 default), auto-dunning limit, PO-consumption alert (80%), CoC reminder cadence; **Scenarios** (the demo remote control, section 9); theme; language toggle (English built, Arabic labels for key chrome).

---

## 7. Data model (synthetic, derived)

Inputs are authored; everything else is computed. Identifiers follow Tasama's observed formats with the `DEMO-` prefix. **[T][D]**

```
Client            id, code (e.g. 351), name, short, segment (PIF|Government|Private|International),
                  pifFlag, kam, deliveryLead, vatNo, paymentTermsDays, currency, businessLines[]
Contract (MSA)    id (DEMO-GPLC-2025-002 style), clientId, type (MSA|Service Agreement|Frame), status,
                  start, end, totalValue?, paymentTermsDays, cocRequired, rateCardVersion
Proposal          id (DEMO-T39984_1125 style), clientId, contractId, date, lines → QuoteLine
QuoteLine         serviceLine (502|504|506|SES-FIN|SES-HR|SES-PROC|BES|EVAS), catalogItem, pricingModel,
                  unit, rate, qty, term, markupPct?
ClientPO          id (client's own format, DEMO- prefixed), clientId, contractId, proposalId, date,
                  value, currency, status (open|consumed|expired|closed), lines → POLine
POLine            activity, serviceTag (ERP|AMS|TechF|PMIS|EPMO|ServiceNow|Finance MS|HR MS|Procurement MS|Workplace|SoftLanding),
                  pricingModel, unit, rate, qty, value, start, end, vendorPOId?, matchFlags[]
BillingEvent      poLineId, period (YYYY-MM) or milestone, dueDate, expectedAmount, evidenceRequired[],
                  evidence[] (derived), cocStatus (n/a|to_send|sent|reminded|signed|disputed),
                  status (derived: scheduled|evidenced|blocked|drafted|released|cleared|rejected|missed)
DeliveryEvidence  billingEventId, kind (timesheet|milestone|month_elapsed|licence|volume|vendor_match),
                  value, source (PPM|ServiceNow|Timesheet|Oracle Procurement), date
Invoice           id (DEMO-2026090041), clientId, poId, eventIds[], date, dueDate, currency, net, vat,
                  gross, zatcaStatus (draft|submitted|cleared|rejected:reason), erpRef, creditNoteOf?
CashReceipt       bankLineId, invoiceIds[], amount, matchMethod (reference|amount_client|tolerance|manual),
                  status (applied|proposed|unapplied)
BankAccount       id, bank, label, currency, ledgerBalanceOpen
BankLine          accountId, date, description, rawDescription, amount10k, direction, type, reference,
                  matched → ledgerEntryId? | receiptId?
LedgerEntry       accountId, date, kind (receipt|payment|payroll|charge|tax|transfer), amount, reference, matched → bankLineId?
VendorPO          id (4-digit), vendor, clientPOLineId, value, costCategory
VendorInvoice     id, vendorKey, vendorName, invoiceRef, total10k, lines[], vendorPOId?, matchStatus, allocation → POLine
Opportunity       id (DEMO-OPP-0061), clientId, name, businessLine, stage (Qualified … Closed won|lost), amount,
                  recurring, probability, expectedStart, termMonths, owner, note   — read from Salesforce (simulated)
Pipeline          derived: businessLine × month → weighted amount (recurring × months in FY × probability); feeds the forecast only
Budget            month, businessLine, budget, target, forecast  (Tasama's "Without SA" structure)
Actual            derived: recognised revenue by month × businessLine × client
CloseItem         workstream, title, owner, agent, dueDay, status, blocker?, evidenceRef
Journal           kind, lines[{account, dr, cr}], source, status (proposed|approved|posted), erpPreview
TrailEntry        ts, actor (agent|persona), act, autonomy, recordRef, override?, reason?
Settings          erp, cognidocs {mode, baseUrl, sandbox}, cashTolerance, autoDunningLimit, poConsumptionAlertPct, cocReminderDays
Flags             reforecastAccepted, periodClosed, seq, erpSeq, rev   — the only state the close keeps that is not derivable
```

**Storage.** Every entity above is a table in PostgreSQL schema `mizan` (23 tables; typed columns for the fields people query, JSONB for nested arrays such as evidence, invoice lines and journal lines; a `position` column keeps the domain's array order). `world_meta` holds asOf, closingPeriod, closeDay, flags and settings. The world is loaded whole for every action — it is a few hundred rows — and only changed rows are written back. See section 10.4.

**Derivations** live in one module (`packages/domain/src/derive.ts`): billing status, unbilled, deferred, missed, PO consumption, ageing, DSO (countback), auto-match proposals, bank rec balances, variance decomposition, close readiness. No screen computes anything itself (the Ascend rule that stopped screens contradicting each other).

---

## 8. Synthetic dataset design

**Period.** FY2026 budget; actuals Jan–Sep 2026; the demo sits on **Tuesday 6 October 2026, Day 4 of the September close** (today's date — a demo that is dated the day it is shown reads as live). **[D]**

**Clients (9).** Real PIF-portfolio names from Tasama's own PO ledger, with every figure, contract and person fictional, and a banner saying so (the pattern used in Ascend and Tasama HR): King Salman International Airport Development Co (KSIA, PIF, largest), Global Ports & Logistics Co (GPLC, PIF), Salwan Tourism Real Estate Development Co (PIF), Jada Fund of Funds (PIF), Riyadh Expo Development Co (REDC, PIF), Future Artificial Intelligence Co (FAIC, PIF), Riyadh Lake Co (RLC, PIF); plus **Social Development Bank** (Government, Etimad-paid, 90-day terms) and **Nordwind Robotics GmbH — Riyadh RHQ** (International, Soft Landing + Finance Managed Services, fictional company). The two non-PIF clients exist so the non-PIF revenue share (board KPI) is visible.

**Business lines.** 502 Foundation Technology · 504 Enterprise Solutions · 506 Business Solutions (D&T, Tasama's codes) · SES Finance Managed Services · SES HR & Payroll · SES Procurement · BES Workplace & Soft Landing · EVAS Innovation. Budget FY2026 sized in proportion to Tasama's D&T budget shape (D&T 75M in their sheet; total company larger) — figures are synthetic but the *shape* (April and July peaks) follows theirs.

**Contracts and POs.** ~14 POs, ~38 PO lines across all seven pricing models; rate card from Tasama's observed values (SAR 4,312/day functional specialist, SAR 39,969/month F&A bundle, SAR 72,857/month senior specialist, SAR 162,500/yr Oracle MT bundle, milestones 20/25%, licence pass-through +15%, hour bundles).

**Named edge cases (each one is a scenario or an inbox item, never a coincidence):**
1. GPLC AMS line — August event delivered, evidenced, **never invoiced** ("To Invoice: Missed" in Tasama's words). Hares finds it; Fatoora drafts a catch-up invoice.
2. KSIA PMIS milestone D2.13 UAT complete in PPM; **CoC requested 12 days ago, not signed** — invoice blocked SAR 611,800; Shahid escalates to the KAM.
3. Salwan HCM T&M — September invoiced at **last year's rate** (4,100 vs 4,312) → under-billing SAR 11,872; Hares flags, credit/debit note proposed.
4. Jada AMS — **PO 97% consumed** with three months of term left; Aqd raises renewal/PO top-up.
5. REDC — delivery continuing on an **expired PO** (September days delivered, no PO cover).
6. FAIC — **advance invoice** for a 12-month subscription; deferred revenue released monthly; Iqfal proposes the September release.
7. Social Development Bank — invoice **61 days overdue** (Etimad cycle); Tahseel drafts the third dunning note; KAM must approve tone.
8. KSIA — one bank transfer **pays two invoices** short by SAR 37.50 (bank charge) → Tasweya proposes tolerance match + charge journal.
9. **Unapplied cash** SAR 184,000 from "RIYADH EXPO DEV" with no reference → proposed by amount+client, needs approval.
10. Vendor invoice from Oracle (licence pass-through) **duplicate** of one already matched → Mawrid refuses; CogniDocs' `(vendorKey, normalizedInvoiceRef)` uniqueness surfaces it.
11. Accenture vendor invoice **with no vendor PO** → Mawrid blocks, routes to Procurement.
12. SAB USD account — **FX difference** on a USD invoice paid at 3.7512 → adjusting journal.
13. Bank lines that are not revenue: GOSI debit, payroll, ZATCA VAT payment, bank fees — matched to ledger, not to invoices.
14. ZATCA clearance **rejected**: buyer VAT number missing on the Nordwind invoice → Fatoora asks for the VAT number, re-submits.
15. Budget: 504 Enterprise Solutions **behind budget** because the KSIA PO extension slipped a month → Mizaniya decomposes the variance (timing vs lost) and proposes the reforecast; 506 ahead because of pass-through licences (low margin — gross margin tile explains).

Generator: seeded, deterministic (`SEED = 20261006`), so a reset reproduces exactly the same world. Arithmetic is checked programmatically (unbilled + invoiced = recognised; AR sub-ledger = invoices − receipts; each bank rec proves to zero after adjustments).

---

## 9. Scenarios (the demo's remote control)

Six, each a different shape, all resettable **[D]**:

1. **Happy path — "Month-end billing run"**: Fatoora drafts 11 September invoices; the Head of Revenue releases them in one approval; ZATCA clears 10, rejects 1 (scenario 14) — watch the waterfall move.
2. **Exception — "The invoice nobody raised"**: Hares finds the GPLC August miss; trail shows detection → draft → release; unbilled drops, forecast rises.
3. **Escalation — "CoC stuck at KSIA"**: Shahid's reminders exhaust; escalation lands in Majed's inbox with the evidence pack; he approves the sponsor email.
4. **Refusal — "Duplicate vendor invoice"**: upload the duplicate Oracle PDF (or run simulated); CogniDocs resolves to the existing canonical invoice; Mawrid refuses to post and says why.
5. **Cash day — "Statement upload"**: upload the SNB statement; Tasweya auto-applies 7 receipts, proposes 2 (tolerance, unapplied), leaves 1 unmatched; bank rec moves from 6 open lines to 1.
6. **Close — "Day 4 to Day 5"**: Iqfal runs the checklist; proposes four journals; the Accounting Manager approves; the CFO sees "ready to close except budget commentary"; Mizaniya's reforecast is accepted; close signed.

---

## 10. Integrations

### 10.1 CogniDocs (real contract, two modes)
Per the API guide: `POST /documents` (multipart `file` + `declaredType`; or JSON base64) → `202 ParseJob` → `GET /jobs/{id}` polled at ~2 s with exponential backoff and jitter to ~10 s; stop on `completed`/`failed`; never resubmit a queued/processing job; 4xx not retried unchanged; `422 pdf_password_required` → prompt for password. Money is integer `*Amount10k` — stored as integers, divided by 10,000 only for display. Statement direction is read from `direction`, never from sign. `detailTier`, `fieldsMissing`, `reconciliation.delta10k`, `confidence` are shown and gate what the agents may do automatically (e.g. Tasweya auto-applies only when `confidence ≥ 90` and the statement has no `fieldsMissing` on amount/date). Failed jobs surface `error` verbatim.

- **Simulated mode (default):** an in-app emulator that produces the canonical envelope for the shipped sample documents (and a generic envelope for any other upload), with the real status transitions and timings. Labelled *Simulated* on every job.
- **Live mode:** calls go through `/api/cognidocs/*` on the small Express server (so the key stays off the browser and CORS is not an issue), or directly from the browser in the standalone build if the CogniDocs deployment allows it. Base URL, key and `sandbox` set in Settings or env (`COGNIDOCS_BASE_URL`, `COGNIDOCS_API_KEY`). Legal-acceptance `403 LEGAL_ACCEPTANCE_REQUIRED` is surfaced with the instruction a human must accept in the console first.

### 10.2 ERP adapter (fictional, two dialects)
One connector module; every write goes through it and is logged in the trail with the call shape:
- **Oracle Fusion Cloud** — `POST /fscmRestApi/resources/11.13.18.05/receivablesInvoices`, `…/receivablesCreditMemos`, `…/standardReceipts`, `…/cashBankStatements`, `…/erpintegrations` (journal import), `GET …/purchaseOrders`, `…/projects`. Project ID and business line from PPM.
- **Odoo 19** — JSON-2: `account.move` (`move_type: out_invoice | out_refund | entry`), `account.payment`, `account.bank.statement.line`, `purchase.order`, `project.project`.
Selecting the ERP in Settings changes the posting previews and the connector log; nothing else. Tasama runs Oracle Fusion for corporate finance and is introducing Odoo for the operations team **[T]**, which is why both are offered.

### 10.3 Upstream reads (simulated)
Salesforce (opportunities → forecast; closed-won → PO expected), Sirion (contract terms), PPM/ServiceNow (milestones, project IDs), timesheets. Each shown as a source chip on the record with `simulated` provenance.

### 10.4 Architecture — the server owns the world (v2)

v1 kept the world in the browser (`localStorage`). That was not acceptable for a Replit deployment: two browsers saw two worlds, and a cleared cache lost the demo. v2 moves the world to **PostgreSQL** behind a small Express server, with one pure domain package shared by both sides. **[D]**

```
packages/domain      types · world generator · derivations · applyAction (pure reducer) · process · workflows · agents · erp · cognidocs emulator
apps/server          Express: ensureSchema + seed on first start · GET /api/world · POST /api/actions {action, personaId} · GET /api/rev · POST /api/reset · /api/cognidocs/* proxy · static web app
apps/web             the screens; an API client that dispatches Actions and renders the world it gets back; polls /api/rev every 4 s
PostgreSQL           schema mizan, 23 tables + world_meta; one transaction per action; diff-upsert of changed rows; truncate + re-seed on reset
```

Design rules: **the screens never mutate** — every change is an `Action` (27 types: releaseInvoice, runBillingRun, signCoc, applyReceipt, approveJournal, routeJob, updateSettings …) applied by `applyAction(world, action, {personaId, now})`, which also writes the trail entries, bumps `flags.rev` and allocates ERP references. **The server serialises actions** (read-modify-write on one world) and refuses unknown action types without touching the database. **One reducer, two homes:** the standalone `.html` and a server without a database run the same `applyAction` in the browser and keep the world in `localStorage`, saying *local* in the header; the exercise script runs the same six scenarios in both modes and gets identical results. **Browser-only state:** who you are (persona), the client lens, navigation, and the CogniDocs API key, which is never written to the shared store. **Settings are shared** (ERP dialect, thresholds, CogniDocs mode/base URL) because a demo room has one truth.

Not done, on purpose (demo prototype): authentication, per-user worlds, optimistic concurrency between browsers (last write wins, serialised), row-level history (the trail is the history), migrations (schema changes need a reset).

---

## 11. Brand and design system

Atelier, taken from the Tasama Ascend copy already rebranded from `tasama.com.sa` computed styles: ultramarine `#10069F`, hero navy `#07105F`, violet `#342BAD`, gold `#B59E5F` (deepened to `#806722` for AA on light), nimbus green `#ADDC91` for client-facing affordances (never on a status surface). Logo lockups, mark, favicon and the two backdrops reused from Ascend. **Fonts: Cognirise's own — Comfortaa (display, wordmark, 400/700) and Inter (body, tables, 400/600/800)** as instructed; Ascend's Alexandria is not used. Glass scale L1/L2/L3 and the hero-island alpha fix (93%/90%) carried over. Product wordmark **Mizan** in the title bar; Tasama lockup in the rail brand card.

Two caveats carried from Ascend: the reversed Tasama lockup was derived by us (Tasama publishes none) — replace before client use; chart colours are the validated five-slot set, not brand fills.

---

## 12. Delivery form

- **Replit zip — the intended way.** Import ZIP → add a PostgreSQL database in the Database tool (Replit sets `DATABASE_URL`) → Run. The server creates the schema and seeds the world on first start; every browser that opens the Repl sees the same persisted world; *Reset the demo* re-seeds. Optional secrets `COGNIDOCS_BASE_URL` / `COGNIDOCS_API_KEY` enable live parsing through the proxy. Without a database the app still opens, in browser-only mode, and says why under Settings → Data.
- **Standalone `Tasama-Mizan.html`** — double-click, no server, fonts and art inlined; the same reducer runs in the browser and the world lives in that browser; CogniDocs in simulated mode (live mode available if the deployment allows browser calls).
- **Source** in `Cognirise/apps/tasama-lead-to-cash/` with this design, the research extracts and the four research reports.

---

## 13. What the prototype does not prove, said plainly

- It does not connect to Oracle, Odoo, Salesforce, Sirion, ServiceNow or a bank. Every integration except CogniDocs is simulated and labelled.
- The assistant is a deterministic resolver in the standalone build; it is matching, not comprehension.
- ZATCA clearance is simulated; the field validation is real against the documented mandatory fields, the cryptographic stamp is not.
- Arabic is partial (chrome labels and dunning templates); a full RTL pass is a later session.
- No DoA thresholds exist in Tasama's documents; the persona limits are ours and must be replaced with Tasama's.
- Tasama's actual client price list does not exist in the material; rates are the observed examples, not a catalogue.

---

## 14. Open decisions for Mounir / Tasama

1. ERP to lead with in the room — Oracle Fusion (corporate) or Odoo (operations)? Both are built; one is the default.
2. Should client names stay real PIF portfolio names (as in Ascend and Tasama HR) or move to fictional ones? Default: real names, fictional everything else, banner on every screen.
3. CogniDocs live mode: which deployment URL and a sandbox key for the demo.
4. Whether to show Tasama's own 2026 budget shape or purely synthetic numbers. Default: synthetic numbers, their column structure and seasonality.
5. Persona amount limits — placeholders until Tasama's DoA is available.

---

## 15. Build plan, in Claude work

- **Session 1:** design, scaffold from Ascend's Atelier copy with Comfortaa/Inter, synthetic data generator and derivations with checks, all seven screens, nine agents with trail, CogniDocs emulator + live client + proxy, scenarios, standalone build, screenshots of every screen in both themes.
- **Session 2 (this):** domain extracted into a pure package; the action reducer; PostgreSQL schema and store; the Express API; the web app as an API client with the local fallback; the four-stage process model with its Process tab, Overview strip and stage-grouped workflows; opportunities and contracts tab; verification in both modes (136 world/reducer checks, 44 screenshots, the six scenarios + uploads + approvals + persistence across a restart).
- **Next:** the presentation for Tasama (after the Replit build is confirmed), then if wanted: Arabic/RTL pass, pass-through margin drill-downs, export of the close pack to PowerPoint/Excel, Tasama's real DoA and rate card once supplied.

Build time collapses; confidence does not — the arithmetic checks and the screenshots are what make the first demo safe to run, and the real test is the first run in front of Tasama's Revenue & Treasury lead.
