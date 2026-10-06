# TASAMA finance processes, SLAs and data model — synthesis of the engagement documents

Sources (all under `research/extracts/`): DREDC_EOS Finance Process.pdf; Tasama – F&A – Workflows.pptx; Manual Baseline Accounting Processes – BIAC.pdf; Finance Process Tracker.xlsx; Finance Business Case.xlsx; Data Collection.xlsx; Digital Factory – Finance & Procurement process.pptx; Finance Product Services Deliverable (Service Charters).pptx; Finance Data Model.xlsx; Budget Target Forecast 2026.xlsx; D&T P&L Q1 2026.xlsx; PO Summary_29 Apr26.xlsx; TASAMA Current Processes.xlsx; TASAMA Functionality.xlsx. The attached *DT – Finance Process Baseline.pptx* (Sept 2025) is the same material as the F&A Workflows deck.

## Two finance worlds

- **World A — finance-as-a-service delivered BY Tasama TO client NewCos** (DREDC, GPLC, KSIA, Salwan, TDREDC, Jada): FAP_100_xxx processes, SLAs, the Process Tracker, the Business Case, the Service Charters, the Data Collection workbook. BIAC is Tasama's former brand.
- **World B — Tasama's own corporate finance**: PO Summary, Finance Data Model, Budget/Target/Forecast, D&T P&L, Current Processes, Functionality. This is the lead-to-cash domain Mizan addresses.

## World A process definitions

| Area | ID (Tasama) | Title |
|---|---|---|
| GL | FAP_100_001 | Journal Entry Creation (JV, Accruals and Others) |
| GL | FAP_100_002 | Journal Entry Creation for Accounts Payable |
| GL | FAP_100_003 | Preparation of all JEs and GLs for the period |
| AP & AR | FAP_100_004 | Detailed Invoice Tracker (both AP and AR) |
| AP & AR | FAP_100_005 | Transfer Letters (manual) and Payment Upload Request (e-banking) |
| Period end | FAP_100_006 | BRS, Fixed Asset Register, AP, AR, Accruals, Payroll Recon and period-end schedules |
| Period end | (DREDC 007) | Detailed PO Billing Tracker |
| Period end | FAP_100_008 | Management Accounts with schedules |
| Reporting | FAP_100_009 | Monthly/Annual Financial Statements |
| (DREDC 010) | | Delivery Note and Invoice Processing (3-way match) |
| ZATCA | FAP_100_010/011 | VAT & WHT; Zakat returns support |

**SLAs (DREDC EOS):** JE creation 3 business days; period JEs and GLs 10 business days after month end; invoice tracker weekly; payments weekly; **BRS and period-end schedules 10 business days after month end — "all bank statements must be received on the 1st day of the following month for Bank reconciliation"**; management accounts 10 BD; financial statements 11 BD; Zakat/VAT/WHT 12 BD. "1 WD for acknowledgement to be added." Escalation: L1 Finance Operations Manager, L2 Service Delivery Manager, L3 Service Delivery Lead. Client roles: Functional SPOC, Functional HOD.

**Roles (swimlanes):** Finance Manager (NewCo); Accountant, Senior Accountant, Accounting Manager, Procurement Department (Tasama); Tax Advisors; PIF SSC; Bank.

**Period-end close (FAP_100_006):** Accountant prepares all schedules (BRS, FA register, prepayments, AP, AR) → policy check → finalise → Accounting Manager review → management accounts → Finance Manager approve. BRS is one schedule inside the process; no separate BRS procedure. ERP-era steps: extract bank statement from portal, upload to ERP to reconcile with statement lines, create accounting for Payables and Cash Management (5 min each).

**Management accounts timing:** 3–5 BD for the draft after all inputs; client review 2–3 BD.

**AP effort (Business Case):** manual AP 40.5 min/invoice vs ERP 21.5; payment manual 80 min vs ERP 27.5. Pain: "15 min per payment" on the bank portal, "might take up to 1 month" for senior review, first-time vendor approvals, "1 excel", shared folder, email intake, "back and forth with the client", fixed-asset and prepayment schedules in Excel reconciled to ERP by hand.

**Volumes:** 30,000 transactions/yr (v1) → 17,000 (v2: P2P 56%, FA 8%, R2R+O2C+GL 36%); AP ≈1,500/month; 20 clients (10 Oracle, 10 manual); ServiceNow 37,000 tickets in 2 years, AP = 60%; 11 staff; towers P2P 3 · Treasury 3 · O2C 4 · FP&A 2; "22 client entities closed end-to-end in 5 days by 2 people"; MSA close SLA 10 working days.

**Service charters (Oct 2025) — Order-to-Cash Management SLAs:** 3 WD to respond to contract requests; 2 WD cash allocation; 100% allocation accuracy; >90% dunning runs on time; **2 WD average lead time for invoice issuance**; AR report 5 WD. Scope: customer credit & account set-up; billing & invoicing (invoices, debit and credit notes "based on contractual terms"); collections & receivables (escalate ageing per policy); cash application & ledger maintenance (AR sub-ledger to GL); reconciliations & period close ("periodic reconciliations between contract, billing, and accounting data; monthly AR closing"). AP charter: 3 WD scan/verify, 2 WD posting, >98% right first time, 8 WD receipt-to-scheduled, 100% month-end tasks on time. GL charter: 2 WD JEs, 8 WD intercompany and balance-sheet reconciliations, 8–20 WD consolidation. Commercial models: Time & Material, Fixed Fee, Subscription, Dedicated Resource, Value/Outcome, Consumption.

**ERP = Oracle Fusion Cloud** (NEWCO_ security roles, "Company-in-a-Box leveraging Oracle Fusion MVO", "Oracle MT bundle 25 users SAR 162,500/yr"); SAP offered as alternative, none deployed; ServiceNow for intake. Chart-of-accounts: procurement taxonomy L1–L4 with a blank "Finance Integration" mapping (asset clearing, P&L expense, liability accounts); vendor master with liability/prepayment accounts, WHT %, payment terms; "natural account" terminology; cost centre and project accounting set up per NewCo.

## World B — Tasama's own finance

**Organisation:** Chief Finance → Accounting; Revenue & Treasury; Reporting and Budgeting. Chief Commercial → Business Development (Solution & Bidding; Strategic Partnerships); Sales Management; Key Account Management (PIF; Government; Private); Commercial. Operations → Finance Shared Services, HR/Legal/Procurement Shared Services, SDM, TMO (TO, PMO), Operation Hub.

**Processes marked Manual / no application:** Client Onboarding; Key Account Management; Proposal-to-Purchase-Order Workflow; Purchase Order Creation; MSA Management; Standard and Non-Standard Proposal Development; Corporate Finance — Financial Planning & Budgeting, Forecasting, Management Reporting, Cash Flow Management, **Invoicing and Billing**. Only "Account Management" is semi-automated (ERP).

**Budget / Target / Forecast (sheet "Without SA" = without the PIF Service Agreement):** monthly columns, FY total; blocks Budget, Target, Forecast As of Today, Forecast vs Budget, Forecast vs Target; rows Revenue and Digital & Technology. D&T FY2026 budget SAR 75.0M; target SAR 169.9M; forecast SAR 29.2M. Finance Data Model normalises as `Metric | Jan…Dec | FY 2026`; `MODEL_Revenue Monthly` adds Stretch = Target × 1.10 and Variance vs Target; target GM 23%.

**P&L structure (Q1 2026 D&T):** Revenue 8,748,161 vs budget 12,144,980; Cost of Revenue 10,808,632; GP −23.6% vs 9.4%. Revenue booked **per client PO per month** (`B/L | Client | Revenue | PO#`, PO# free text and inconsistent). Cost categories: Staff; Subscriptions & Professional Fees (Consultancy, Internal Software Licence, Internet Subscriptions, IT Consultancy, Software Licence); Uncapitalized Assets (IT Infrastructure, Support); D&A; Insurance; Office Supplies; R&M; Business trips; Others. Cost-to-deliver pivot: Client → Vendor → Cost category → **Tasama vendor PO (4-digit)** → Net.

**Finance Data Model entities:** `RAW_Revenue Monthly` (Month, Business Line, Client, Revenue, PIF flag, PO#); `RAW_C2D@`; `RAW_Targets & Forecast`; `RAW_Transformation Budget` (Initiative, Source DT/GTM, CAPEX/OPEX budget-spend-remaining, PO#, Vendor — incl. Salesforce 6.0M Deloitte, CLM 2.0M Sirion, CRM enhancement 0.6M Accenture, agentic platform work with MMS/Deep/Arrow/Cntxt); `MODEL_Revenue by Client` (KSIA 38.3%, GPLC 26.9%, R1 RCM 10.3%); `MODEL_Revenue by Line` (504 72.9%, 502 16.8%, 506 10.3%); `MODEL_Gross Margin`; `MODEL_Budget Adherence` (Source × Cost Type: Budget, Spend, Remaining, % Used — total 78.3%). Business-line codes 502 Foundation Technology, 504 Enterprise Solutions, 506 Business Solutions; client codes 322 Jada, 326 UADC, 343 DRDC, 351 KSIA, 357 TDREDC, 362 Salwan, 369 RLC, 372 FAIC, 373 REDC, 379 GPLC, 417 R1 RCM.

**PO Summary — the de-facto billing and AR tracker (557 rows × 21 columns):** `Client Name | Activity | ERP Implement / AMS / TechF | Proposal Number | Client PO Details | PO Date | Qty | PO Value | DN Sign-off Status | Invoice Number | Invoice Date | Invoice Amount (Excl VAT) | Collection Status (Y/N) | Open PO | Vendor Name | Vendor PO | Invoice Comments | KAM | Delivery | Vendor PO`. Mixed grain (PO line rows then invoice rows). Service tags ERP, AMS, TechF, PMIS, PMIS-Aconex, PMIS-IBM, EPMO, Service Now. Proposal numbers `T39999_0325`. Client PO formats `GPLC-PO-002`, `KSIA-PO-00000524`, `SALWAN-PO-202500118`, `JADA_PO_0449`, `PO-0000061_CO`, `TDREDC-PO-0000099`. DN sign-off: Available / Not Available / Rq 4 CoC Sent / To send / cancelled. Invoice numbers `YYYYMM####`; credit notes in comments. Collection status overloaded: Yes, No, To Invoice, Credit Note, To Invoice-Completed 50%, To Invoice: Completed 70%, **To Invoice: Missed**, Consumed, To check payment. Vendors: Accenture, Oracle, Consertus, Masterworks, Exquitech, NATCOM, TWAASOL, STC, Mobily, Mastek, NTT, IBM. KAMs Majed, Nayef, Abulrahman, Sarah A, Loay; delivery owners Kareem, Charles, Dina, etc.

**Client-side structures (Data Collection, reusable):** Contract Dashboard (`Contract Title | Reference | Type (Frame / Service / MSA / Engagement letter / NDA) | Supplier | Status | Start | End | Total Value | Remark`; e.g. "Shared Services | GPLC-2025-002 | MSA | BIAC | Open | 2025-05-15 | 2028-05-14"); PO Dashboard with repeating `DATE | COC AMOUNT` drawdown pairs and `Remaining Balance`; vendor payment terms 30/45/60/75/90 days "from receipt and acceptance of invoice by Finance", advances 5–40%; catalogue items `BIAC-0001…`.

## How Tasama bills (contract types actually observed)

Multi-year MSA → proposal → client PO per bundle against the catalogue. Pricing: monthly subscription bundle with volume caps and add-ons ("F&A Managed Services underpinned by ERP 39,969/month"; "50 JEs 2,166/month"; "1 bank account, 1 reconciliation 2,256/month"; HR bundle 33,482/month ≤30 employees; Procurement bundle 39,649/month, "20 PRs/POs 3,655/month"); dedicated resource ("Senior Finance Manager 105,000/month"; "Accounting Snr Specialist 72,857/month × 12"); T&M day rates (Director 5,838; Manager 3,883; Senior Specialist 3,068; Specialist 2,272; Oracle functional specialist onshore 4,312/day billed monthly on days); fixed one-off (set-up 450,000; MT activation 375,000; transition 375,000); milestones 20–25% (Design/Build/UAT/Deployment/Hypercare; "at Production sign-off", "at Go-Live"; Salwan HCM 40/60); annual licence pass-through ("Oracle MT 162,500/yr", "licences cost +15%"); management fee % (7.5% on spend, 20% servicing fee); retainer; hour bundles (legal 100 h at 2,500/h). Invoice trigger: month end per PO line (sometimes batched several months), gated by DN/CoC; projects at milestone acceptance; amounts excl. VAT; collection tracked Yes/No only — no due date, DSO or ageing fields.

## Use cases already proposed (avoid duplicating)

Finance: Automated AP & Asset Control; 3-way reconciliation; Automated Policy Compliance; Asset Lifecycle; Tax Compliance Automation; Prepayment Management; Payment Orchestration (ISO 20022); **Monthly bank reconciliation**; Fraud & Duplicate Detection (O2C); Client Intelligence Dashboard; Financial Reporting Automation; Finance Query Bot. Procurement: Policy Agent, RFP Agent, Vendor Data Agent, CLM Agent, Vendor Proposal Agent. Payroll: ten use cases. Only O2C-tagged item: Fraud & Duplicate Detection; AR automation appears as DAMAT "CPA – AR Automation (Med/Med)" and EA interventions ("Automated Invoicing and Financial Tracking System", "COC, invoice and credit note approval workflow").
