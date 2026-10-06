# TASAMA Lead-to-Cash: Process, Systems, Pain Points, Deal Structure and Initiative Status

All files listed in the brief were read in full (22 files, plus two small adjacent client-input files — "TASAMA Current Processes.xlsx" and "Tasama - F&A - Workflows.pptx" — read because they bear directly on billing/MSA/PO handling). Source tags used below:

| Tag | File (all under `/mnt/user-data/uploads/Cognirise/apps/tasama-lead-to-cash/research/extracts/`) |
|---|---|
| [CG-Maps] | `Digital_Factory_Pre-Work_Phase_0_03._Input_Oracle_CRM_05.08.2025_Commercial_Governance-Customer_Lifecycle_Process_Maps_v6.pptx.txt` |
| [VCI-PMO] | `Digital_Factory_Pre-Work_Phase_0_03._Input_Oracle_CRM_VCI_PMO_Weekly_Report_05_-_16_Oct_25.pptx.txt` |
| [CPQ] | `Proposal_15._Lead_to_Cash_CPQ_CPQ_Deal_Summary.xlsx.txt` |
| [RFP] | `Proposal_6..._RFP_TASAMA_Digital_Technology_CRM_RFP.docx.txt` |
| [Q&A] | `Proposal_6..._Tasama_Requirements_Workshop_Answers.xlsx.txt` |
| [WS-Deck] | `Proposal_6..._Tasama_Workshop_Presentation.pptx.txt` |
| [Kickoff] | `Proposal_6..._Tasama_Kick_Off_-_v3.pptx.txt` |
| [Estimate] | `Proposal_6..._Supporting_documents_Draft_Estimate.docx.txt` |
| [ArchDiag] | `Proposal_6..._NEW_architectural_diagram2.pptx.txt` |
| [BD-Uplift] | `Proposal_7._Sales_BD_Uplift_Program_Proposal_TASAMA_BD_Uplift_-_Commercial_Proposal_V2.pptx.txt` |
| [SysFlow] | `0._DTO_Operate_4..._16._System_Flow_20260520_-_TASAMA_-_DTO_-_System_Flow_-_v2.pptx.txt` |
| [CoreInt] | `0._DTO_Operate_4..._22._Core_Integration_Plan_20260521....pptx.txt` |
| [AppCat] | `0._DTO_Operate_4..._01._Current_State_Report_20260519_-_TASAMA_-_DTO_-_Application_Catalog.pptx.txt` |
| [EA-Obs] | `0._DTO_Operate_4..._02._Target_State_Report_TASAMA_-_EA_-_Current_State_Obervsation.xlsx.txt` |
| [CRM-Cmp] | `0._DTO_Operate_4..._01._CRM_Comparison_20251028....pptx.txt` |
| [CLM-Cmp] | `0._DTO_Operate_4..._05._CLM_Tool_Comparison_251211....pptx.txt` |
| [Nawras] | `0._DTO_Operate_4..._11._Local_ERP_Tool_Comparison_for_H.E_20260303....ppt.txt` |
| [VT-Odoo] | `0._DTO_Operate_3._VRO..._Rawan_Almubidh_Odoo_ERP.xlsx.txt` |
| [VT-SF] | `0._DTO_Operate_3._VRO..._Rawan_Almubidh_Salesforce_CRM.xlsx.txt` |
| [VT-CRMEnh] | `0._DTO_Operate_3._VRO..._Horia_Ioan_Andronescu_CRM_Enhancement_VCI_initiative_.xl.txt` |
| [VT-CLM] | `0._DTO_Operate_3._VRO..._Horia_Ioan_Andronescu_Contract_Lifecycle_Mgmt._CLM_Imple.txt` |
| [Status-W29] | `0._DTO_Operate_2..._2026.06.02_Tasama_-_DTO_-_Status_Update_-_.txt` |
| [CurProc] | `0._DTO_Operate_4._Enterprise_Architecture_01._Client_Inputs_TASAMA_Current_Processes.xlsx.txt` |
| [F&A-WF] | `Digital_Factory_Pre-Work_Phase_0_04._Working_Files_2._Finance_Accounting_Tasama_-_F_A_-_Workflows.pptx.txt` |

One important caveat up front: the documented process maps cover Stage 1 (lead to signed contract) and Stage 2 (onboarding and in-life governance) in detail. Stage 3 (billing/collection/renewal/contract close) is explicitly **"TO BE DEVELOPED"** [CG-Maps slide 23] and was **"not started due to resource limitations"** [VCI-PMO slide 14]. Billing and collection steps are therefore only visible through the System Flow deck, the Salesforce Q&A and the EA observations, not through a formal TASAMA process map.

---

## 1. Customer Lifecycle / Commercial Governance process as documented

### 1.1 Framing
The deck "Customer Life-cycle Process — Commercial Governance" (v6, dated 05.08.2025, prepared under the VCI programme) states: "The customer lifecycle at UNICO is structured around three high-level stages" (UNICO is the earlier name used for Tasama in this deck). Stage 1 is described as "from the moment a lead is identified to the point a deal is finalized and ready to be handed over for delivery … how tools like CRM, CPQ, ServiceNow, and ERP come together to support the workflow." [CG-Maps slide 2]

The three stages, as named in the VCI plan: **"Stage 1: Lead to Contract"**, **"Stage 2: Contract to Service Mgmt. (transition)"**, **"Stage 3: Service Mgmt. to contract close"** [VCI-PMO slide 14]. In the sprint plan, Stage 2 is also described as "contract to invoice" and Stage 3 as "contract closure/renewal" [VCI-PMO slide 18]. Stage 1 is also sliced as **"Lead to Sales (L2S)", "Sales to Proposal (S2P)", "Proposal to Contract (P2C)"** [CG-Maps slide 4].

Annotations in the maps use tags **[Gov]** (government clients), **[PIF]** (PIF-related clients) and **[Int]** (international) to show where the current practice deviates per client segment.

### 1.2 Stage 1 — "Lead Generation to Deal Close" (exact stage names and steps)

| Stage (verbatim) | Steps (verbatim) | Gate / approval | Systems named | Current-state annotation (verbatim) |
|---|---|---|---|---|
| **1.0 Prospect Management (Prospect to Qualified Lead)** — "Objective: Identify and assess potential leads before entering sales funnel" | 1.1 Capture prospect details (CRM); 1.2 Assign sales ownership (if applicable); 1.3 Score prospect using predefined criteria; 1.4 Deal Review 1 Qualification Check | "Check if prospect meets required score"; output "Qualified Lead" / "Unqualified Lead"; "Automated trigger to assign budget" | CRM | "[Gov] Filtered RfPs are not registered in CRM until initial scoring has been made, sometimes without Sales"; "[Gov] Go/no-go decision done informally, and not always involving Sales"; "[Gov] does not happen in all cases" (ownership) |
| **2.0 Lead Management (Qualified Lead to Qualified Opportunity)** — "Objective: Validate and enrich lead information" | 2.1 Initial contact by sales; 2.2 Understand Needs and Pain Points; 2.3 Validate BANT (Budget, Authority, Need, Timeline); 2.4 Build Decision Making Stakeholder map; 2.5 Log All Findings in CRM; 2.6 Deal Review 2; 2.7 Assign Win Probability | "Automated or manual review based on predefined qualification criteria" | CRM | "[Gov] Does not happen for incoming RfPs"; "[Gov], [PIF], [Int] Happens informally, not captured in CRM"; "[Gov] Not captured formally; does not include Sales for all RfPs"; "Not consistently captured in CRM" |
| **3.0 Opportunity Assessment (Qualified Opportunity to Proposal initiation)** — "Objective: Deep dive to shape the deal" | 3.1 Conduct Detailed Client Discovery; 3.2 Share Capability Decks and Case Studies; 3.3 Identify Solution Fit and Delivery Model; 3.4 Engage Solutioning Team and Deal Design (for non-standard deals); 3.5 Deal Review 3 Go / No-Go Decision | Five questions: "Can we make the promise? … Can we deliver the promise? … Will it make money? … Do we have differentiation? … Does this improve win probability?"; "Reasons for No-go captured in systems (all data point)" | CRM, Service catalogue | "[Gov] Not done"; "[PIF] Client knowledge exists, however, not all necessary information is captured to scope the services"; "Lack of solutioning resources"; "Lack of standard ready-made proposals – still requires solutioning team" |
| **4.0 Proposal Development (Proposal Initiation to Submission)** — "Objective: Craft solution, pricing, and develop proposal articulating win strategy" | 4.1 Solution Design and Costing (leveraging service catalogue and deal design parameters); 4.2 Draft Commercial Model ("Include pricing options (tiers, volumes, models)", "Define high-level T&Cs"); 4.3 Proposal Creation; 4.4 Initial Proposal Deal Review "(price, win themes, deliverability, any third-party involvements and associated high level T&Cs)"; 4.6 Appoint Key Account Manager (KAM) | "If standard service: automate submission approval workflow. If bespoke: initiate an automated email approval flow for leadership/legal/finance sign-off" | CRM/CPQ, service catalogue | "Deal review committee established, however, can be streamlined for standard proposals"; "Currently Sales and KAM roles are combined – need to be aligned to org decisions"; "Lack of standard commercial models" |
| **5.0 Proposal Refinement with Client (Iterative Process)** — "Objective: Conduct detailed engagement and negotiation" | 5.1 Proposal Submission ("Submission is logged in the CRM system"); 5.2 Client Q&A and Solution Clarifications (participants: Sales Lead, KAM, Solution Architect, Delivery Lead); 5.3 Commercial Negotiation ("Price adjustments, Payment terms, Commercial model variations, Risk sharing") | — | CRM | "[Gov]: not part of the formal RfP process"; "[PIF]: Update of the proposal takes long time due to re-approval"; "[PIF]: Update of pricing takes long time due to re-approval" |
| **6.0 Internal Proposal Approval** — "Objective: Reconfirm go/no-go post-negotiation" | 6.1 Executive Deal Review ("final decision checkpoint … conducted by executive leadership" covering "Adjustments to the solution scope, Changes to pricing or commercial terms, Risk profile modifications, Final contract clauses and obligations, Any third-party dependencies or escalations"); Loss Review ("Findings are recorded in CRM") | Approved → 7; Not approved → back to 5 or Loss Review | CRM | "[Gov]: Done once as part of proposal submission"; "[PIF]: May be done multiple times as part of negotiation, and each time goes to senior leadership, adding to client waiting time" |
| **7.0 Closure and Handover (Win and Handover OR Loss and Review)** — "Objective: Sign-off and internal transition" | 7.1 Legal and Contract Review ("Final contract terms and redlines are logged in the CRM system for recordkeeping"); 7.2 Contract Finalization and Signature ("signed by authorized representatives from both parties"); 7.3 Handover to Delivery Team ("structured handover session is led by the KAM and Sales Lead"); 7.4 Contract Logging and Onboarding Trigger ("Finalized contract is logged in the Technology System. This action automatically triggers the onboarding workflow in ServiceNow (SN)"); 7.5 Win Review | "To Stage 2" | CRM, "Technology System", ServiceNow | "Lengthy process due to lack of resources in Legal, and lack of formalized accelerated path for standard contracts"; "Contract T&Cs are not formally captured and not transparent for the delivery team"; "not all the deals are registered in CRM, and important metrics are missing (such as lead time at each step)" |

All of the above: [CG-Maps slides 4–11].

### 1.3 The Deal Evaluation Check Forum (the stage-gate scoring model)
A single "Deal evaluation form is gradually filled in by the cross-functional responsible team through-out deal review stage gates. Answers from previous stage gates are reviewed at each next stage gate." Scoring columns are **Sales, Ops, BD, PO**. [CG-Maps slide 12]

| Gate (verbatim) | Questions (verbatim) | Weight |
|---|---|---|
| **1.4 Opening [Request review]** | 1. Is the client problem a good match with Tasama service catalogue? 2. Is the opportunity sponsor clearly known? 3. Client is on the white list (no legal restrictions, no previous problems) 4. Procurement process and timeline are clear and are suitable for Tasama? 5. Tasama has strong competitive position? | 20% each |
| **2.6 Scoping [Lead qualification]** | 1. Is the economic buyer / sponsor open to our proposal? 2. Do we clearly understand client needs and pain points? 3. Are there capabilities in place to deliver (internal or via partners) 4. Have we identified decision makers and influencers? 5. Are there strong business risks associated with the deal? | 20% each |
| **3.5 Go/No-go** | 1. Has a full discovery been conducted? 2. Do client's expectations for time and budget match 3. Have we differentiated from competitors? (pricing, value add, relationships) 4. Approved commercially for DRC (for selected deals – TBD) | 33% each; DRC "/ 100%" |
| **6.2 / 6.3 Proposing & negotiation** | 1. Is pricing tailored to the client? 2. Does our proposal cover all client needs and pain points? 3. Have risks been reviewed and mitigated? 4. Are there remaining client's objections? 5. Approved commercially by DRC (for selected deals – TBD) | 25% each; DRC "/ 100%" |
| **7. Closing** | 1. Are key terms agreed upon? 2. Has a risk review been conducted? 3. Is the handover plan confirmed? 4. Win/Loss analysis conducted? 5. PO received and contract signed by both parties? | 100% each (binary) |

"DRC" is the Deal Review Committee. The Salesforce Q&A confirms the real-world approval actors: "There are a number of stage gates in the deal processes that will require approval from sales directors and finance and operations" and "Both [sequential and parallel approvals] will most likely be required." Discounts: "Much of this is currently done via email and Excel sheets in the Deal Review Committees." [Q&A rows 2.1, 2.4, 4.6]. The RFP requires the vendor to "Codify deal review and approval stages via dynamic questionnaires/forms within the CRM" [RFP]. A formal **DoA** (delegation of authority) matrix is referenced in the Tech Integration plan as a deliverable to be reflected in CRM workflows: "Reconfigured workflows to reflect DoA & Org Chart" and "New Sales Process — DOA — RACI Matrix" [VCI-PMO slides 13, 18], but no DoA thresholds (SAR amounts, who approves what) appear in any of the files read. The only numeric approval-related figure is "We offer up to 7% on some services but others may be a lot more" [Q&A 4.5].

### 1.4 Stage 2 — "Deal Close to Service Management (Onboarding and In-Life Commercial Governance)"
Six steps [CG-Maps slide 18]:
1. **Internal Mobilization & Governance Setup** — "Triggered once the signed contract is received. Align internal delivery team; KAM provides context, scope, and client details. Set up governance structure (roles, cadence, reporting)."
2. **Project Initiation / Onboarding Workshop (PIW)** — "Triggered after internal mobilization sign-off. Led by KAM & Service Delivery Lead. Introduce delivery teams, confirm scope, readiness, and service start plan. Agree on governance cadence and escalation paths."
3. **Service Design & Transition Planning** — "Define operational action plans (system integrations, process schedules). Identify any non-standard delivery requirements. Prepare transition and stabilization plan."
4. **Pilot Delivery & Validation** — "Triggered after transition plan approval. Run pilot based on service scope (e.g., partial payroll cycle)… Conduct client feedback session with KAM."
5. **Go-Live & Stabilization** — "Maintain heightened governance for 2–4 months depending on complexity."
6. **Transition to Steady-State** — "Handover to standard operating cadence (daily, weekly, monthly, quarterly reviews)."

Stage 2 roles [CG-Maps slide 20]: **Key Account Manager (KAM)** "Owns the end-to-end commercial relationship post-deal … the formal interface with the client on all commercial matters"; **Service Delivery Lead** "day-to-day service performance, SLA tracking, and root cause analysis"; **Client Sponsor (CCO)** "Senior executive sponsor … Typically participates in quarterly reviews"; **Project Management Office (PMO)** "Tracks operational deliverables, maintains the governance calendar."

PIW documents ("Prepared collaboratively by the KAM and PMO") [CG-Maps slide 21]: **Signed contract summary** ("Key commercial terms including KPIs, SLAs, scope boundaries, pricing, and client obligations"), **Project Plan**, **Review and Governance Plan**, **RACI Matrix**, **Risk Mitigation Log**, **Escalation Matrix** (L1/L2/L3), **Operational Delivery Handbook**. PIW scope includes "Contract validation – Confirm key commercial terms including KPIs, SLAs, pricing structure, risk register, and both parties' contractual obligations" and a "Soft launch plan and Go-Live Governance Gate".

In-life cadence [CG-Maps slide 22]: Daily stand-ups (internal); Weekly "Internal Review & Client Status Update"; Monthly "Formal Review Meeting: Deep dive into SLAs, open issues, service KPIs, and team capacity" (Client + KAM + Delivery Lead); Quarterly "Executive Governance Review" (Client + CCO). Standard monthly/quarterly focus areas, verbatim: "Service Levels (KPIs & SLAs); Issue Log & Mitigation Status; Risk and Compliance (QA Findings); CSAT / NPS Results; Complaints Root Causes; People & Capacity; Change Requests & Approvals; **Invoicing & Payment Status: Highlight invoicing milestones, delays, or disputes**; Upsell Opportunities."

### 1.5 Stage 3 — billing, collection, renewal
Not mapped: "Introduction: Stage 3 – TO BE DEVELOPED" [CG-Maps slide 23]. What exists for the deal-to-cash tail comes from the May 2026 System Flow (section 2.4 below) and the Q&A: "Invoicing and billing is triggered once the order has been fulfilled"; "Once invoice is drafted, it is validated by business owner before processing" (invoice validation owner: "Finance but may be worth rechecking"); credit notes and partial billing: "Yes" needed; payments: "Payment are captured through Oracle ERP and there is no integration with any banks, hence relying on receiving transactions from the bank and do manual reconciliation" [Q&A 8.1–8.3, 4.9]. Renewals: contract expiration alerts to "sales & KAMs" are an RFP requirement; "Do you offer renewals and amendments? Yes" [RFP; Q&A 9.7].

### 1.6 Lead sources and sales tracks (useful for synthetic data)
"Two different tracks: 1. Government - leads usually come from Etimad - the government portal - they get qualified on whether to take part or not. Recommendations coming from different ministries … 2. PIF & private companies - helping companies soft land in Saudi (setup shop in Saudi). We work with many embassies, ministries and foreign programmes… PIF NDD real estate department." "The process is the same across all customer types. The only change will be the triggering point (KAM, Business Development Team or Sales Team)." [Q&A 1.4, 3.1]. Four business lines: "IM (Innovation Mgmt), Corporate Property Services, D&T and Shared Services"; "Corporate Property Services and IM not in CRM" [Q&A 1.1–1.2]. Personas: "Sales team; KAM (key account management) team; Commercial team (pricing and offering, offer management and generation); Finance team (… integration needed); Operations … internal operations and 3rd party; Service Delivery Management (quality assurance & quality controls); Procurement (cost based pricing …); HR (time management, time tracking)" [Q&A 1.5]. Expected CRM users: "~200 users" [Q&A 3.2].

---

## 2. Systems landscape — current vs target

### 2.1 Current state (Application Catalog, May 2026)
| App | Product | Status / notes |
|---|---|---|
| APP001 TASAMA Corporate ERP | Oracle Fusion (SaaS, "Oracle Cloud (Private Cloud)") | Running, Major; only integration listed: "ZATCA Integration — API Integration (Point to Point)" |
| APP002 TASAMA MT ERP | Oracle Fusion — "Finance, HR, Procurement, CX, Recruitment (under HR), analytics" for "All TASAMA clients employees" | Running (the multi-tenant ERP run for BPO clients) |
| APP003 TASAMA Service Management | ServiceNow ITSM — "Service Management Module for external TASAMA clients support" | Running |
| APP004 TASAMA CRM | "Oracle Advertising & Customer Experience" — "manage clients interactions … sales, marketing activities" | Running; Integration Points: "N/A" |
| APP008–APP027 | Oracle Fusion modules incl. Financials, Purchasing, Sourcing, Project Management, Expenses, Self Service Procurement, Project Financials, **Project Contract Billing Cloud Service (APP015)**, HCM, Payroll GCC, Time and Labor, Supplier Portal, Procurement Contracts, Supplier Qualification, ERP/HCM/SCM Analytics | All Running |
| APP047 | Power BI | Running, Moderate |
| APP032 | ZATCA Portal integration | "Catastrophic" criticality |
[AppCat slides 2–8]

Key current-state facts: no integration layer ("Mostly point-to-point integrations such as between ZATCA and Oracle ERP with limited middleware adoption and full absence of Enterprise-Wide Integration Platform (i.e. IPaaS, ESB, API Gateway)") [EA-Obs #182]; middleware: "Yes, OCI but not entirely happy with it" and "Integration should be handled by the SI given no integration team is in place" [Q&A 13.1–13.2]; CSAT configured in ServiceNow [Q&A 13.4]; two Oracle ERPs coexist ("TASAMA Oracle ERP and MT Oracle ERP … redundant platforms") [EA-Obs #3]; "20 distinct ERP modules are currently covered under TASAMA licensing scheme out of which a few are not actually implemented" [EA-Obs #29].

### 2.2 Decisions taken on the target stack
- **CRM**: Oracle CX → Salesforce. The DTO comparison (28 Oct 2025) scored "Salesforce CRM … 83% compared to Oracle CRM's 79%" [CRM-Cmp slide 7]. EA action: "Oracle CRM will be replaced with Salesforce CRM" [EA-Obs #28, #41, #80]. Q&A: "Yes scope is for Salesforce implementation and no work required for the existing Oracle CRM"; "Revenue Cloud Advanced licenses has been purchased" [Q&A 1.0; RFP Requirements 2.3]. Target products per the PS architecture: Sales Cloud ("Deal Management, Custom Pricing Engine, C360 Contract View"), Service Cloud ("Order Management Engine, SLA Tracking, Case Integration"), Salesforce Shield, MuleSoft Anypoint ("System and Process APIs"), "Salesforce Platform - KSA Data Center" [ArchDiag]. The Kick-off deck names "Revenue Cloud Dynamic pricing solution integrated to Oracle Fusion" [Kickoff slide 10].
- **CLM**: Sirion. "Sirion, cloud based and has a managed appexchange package"; e-signature "through Sirion as it integrates with both Sayeen and Signit (the only 2 authorized esignature providers in the kingdom)"; "Sirion subscription has been purchased and activated. Sirion config in Sirion to be done by Sirion" [Q&A 9.1, 9.4; RFP Requirements 2.5]. The DTO CLM assessment (Dec 2025) had recommended "Adopt a Fusion-first strategy: use Oracle Fusion Procurement Contracts for authoring… Introduce Sirion selectively for complex legal negotiations" [CLM-Cmp slide 6] — but the subsequent System Flow, Status update and value-tracking files all show Sirion as the CLM of record for client and vendor MSAs.
- **ERP**: Oracle Fusion remains the corporate ERP ("What ERP system do you currently use / are wanting to use in the future? Oracle Fusion"; modules in use "Procurement, Finance, PPM (Order Management), iSupplier") [Q&A 4.1, 7.1]. **Odoo** is being introduced separately as the ERP "for operation team" (the BPO/shared-services delivery side): "Introduce Odoo as ERP for operation team" [EA-Obs #107, #129]; "Odoo ERP Implementation" is project 15b [Status-W29]. **Nawras** (local ERP) was assessed in March 2026 "to support TASAMA's commercialization objectives" (scored 76% vs Daftra 74%, FoxERP 73%) — this is a product/commercialisation assessment, not a replacement of Fusion [Nawras slides 2, 9].
- **ServiceNow**: retained as service management / client request intake; to be enhanced ("Enhance ServiceNow") [EA-Obs #9, #27].
- **PPM**: Oracle Fusion PPM; "They do not think its fit for purpose for order management but there are certain information need to be captured such as (Project ID coming from PPM, Department Business Line…)" [Q&A 6.1]. "Project Portfolio Mgmt. (PPM) – Additional Capabilities" is live as project 10b [Status-W29].
- **BPM**: ARIS was the original VCI choice; a May 2026 assessment compared "Aris and Salesforce new workflow automation solution" [Status-W29 slide 6].
- **Analytics**: Power BI as single reporting layer ("Use Power BI as single reporting application") [EA-Obs #8]; System Flow Analytics slide: Salesforce Sales, Sirion, ERP Finance, ERP PPM → Power BI for "Cost of delivery/fulfillment", "Service Performance & Sales Performance Analytics", "Contracts and MSA Analytics" [SysFlow slide 8].
- **TASAMA Core**: referenced as "TASAMA Core (AI Agent-as-a-service) Internal" (project 15c, owner Nouf A., On Track, target 31/12/26, "Conducted the kick-off with CDO and initiated platform development") and "AI SoW New Murabba — Develop a SoW for AI use cases for New Murabba leveraging TASAMA Core platform"; a "TASAMA Core Pitch" deck was prepared [Status-W29 slides 6, 9, 10]. It is the agentic platform, not part of the L2C core system flow. The Odoo value case is explicitly built around it: benefits are "Agentic Platform Enablement Savings" with per-process "ERP Enablement Score" vs "Agentic Platform Score" (e.g., Accounts Receivable: ERP 0.28 / Agentic 0.72) [VT-Odoo].

### 2.3 Target state EA programmes relevant to L2C
"Program 5: Commercial & Revenue Operations Transformation — Enable scalable, automated, and integrated commercial operations from lead generation to revenue realization" with initiatives "1. CRM Modernization & Lead-to-Cash Automation", "2. Sales Enablement & Revenue Operations Transformation", "3. Order, Contract & Pricing Automation — Automate contracts, pricing, invoicing, and approvals". Program 7 includes "2. Finance Operations Automation & Lead-to-Cash Integration — Digitize financial approvals, requests, invoicing, and financial tracking integrated with CRM and ERP". [EA-Obs sheet P&I]. Initiative list marks "Automate Lead to Cash Process (In Progress take it from plan)" and "CRM Enhancement (not only implementing CRM salesforce, but implement it properly and cover all points)" [EA-Obs Sheet5].

### 2.4 The System Flow (May 2026) — data flows between CRM, CLM, ERP, ServiceNow
Deck title: "System Flow between CRM, Salesforce, CLM, ERP and ServiceNow" [SysFlow slide 1].

**Lead Onboarding**: "1. Receive / Register information for new lead (Client – Sales Team)" via channels **TASAMA Business Center, SAWT, Call, Email, WhatsApp** ("TASAMA Channels") → "2. Register required information (Sales Team)" → "3. Review, validate & create record for the lead (Sales Team)" in **Salesforce Sales** → "3. Create account on TASAMA Business portal (Sales Team)". [SysFlow slide 2]

**Opportunity to Deal — New Client with MSA if Required** [slide 3]:
1. Discuss services required and if MSA is required (Client ↔ Sales)
2. Create opportunity (Sales Team) — Salesforce Sales
3. Create account and generate new MSA for new client (If required) (Legal Team) — **Sirion** ("Client MSA (if applicable) & Vendor MSA (If required)")
4. Create quote for service request (Sales Team) — **Salesforce Revenue**
5. Share Quotation; 6. Issue proposal & quote (Sales Team)
7. Approved and issue PO (Client)
8. Fill KYB and Sign NDA (Client)
9. Share PO or contract and require information (Sales Team); 9. Share contract if provided (Legal Team)
10. Generate PO (if vendor required) (Procurement Team) — **Oracle Fusion Procurement**, "MSA (Vendors)" in Sirion
11. Share project details — **PPM**; **Oracle Fusion Finance** receives billing details

Variants: "Existing Client Requesting Service (Contract)" [slide 4] and "Existing Client Requesting Service with MSA" [slide 5] follow the same path (client approves and issues contract or PO respectively). "Lead to Deal — Public Sector Entity Service Request" [slide 6]: "1. Receive RFP (Public Sector Entity)" → opportunity → quote → "6. Receive award letter and contract* (Public Sector Entity)" ("*Award letter and contract sharing will be done via email") → "7. Create account (if needed) and sign & store contract (Legal Team)" in Sirion → PO to vendor if required → PPM.

**Deal to Cash** [slide 7]:
1. Share PO or Contract (Client)
2. Share service billing details and PO (or contract) to create / update account — Salesforce Sales → **ERP Finance**; in parallel "2. Create activity request for the PO or Contract (Delivery Team)" in **ServiceNow**
3. Share service details (Finance Team) — **ERP PPM**
4. **"Raise invoice once service is delivery and COC is collected (Finance Team)"**
5. Share invoice with Client (Service Delivery Team)

The 2 June 2026 status deck restates this as a single "High Level Lead to Cash Core System Flow" with 13 steps across CRM (Salesforce Sales/Revenue), CLM (Sirion), Service Delivery Management (ServiceNow) and "Enterprise Resource Management" (ERP Finance, ERP PPM, ERP Procurement): "9. Share service billing details and PO (or contract) to create / update account (Sales Team)"; "10. Generate PO (if vendor required) (Procurement Team)"; "11. Share service details (Finance Team)"; "12. Raise invoice once service is delivery and COC is collected (Finance Team)"; "13. Share invoice with Client (Service Delivery Team)". [Status-W29 slide 19]

Note: the flow depends on a **COC (Certificate of Completion)** before invoicing — the same COC that Finance observations call out as a manual bottleneck (section 3).

**Core Integration Plan** (04 May – 10 Oct 2026, owner Dina Ajjour; business owners "Sales, Finance, Delivery, Legal"): "establish seamless connectivity between TASAMA's core systems to enable efficient data exchange, eliminate silos, and support real-time business operations"; deliverables "Defined Integration Flows and System Interaction Models; Integration Governance Framework and Standards; Oversight and Validation Reports"; Budget "N/A"; dependencies "Availability of the core systems; Clarity on business processes and integration requirements" [CoreInt]. Status: "Core Systems Integration (VCI) — Planned — Detailed plan developed and under review with Project Owner", target 30/10/26, Board 31/12/26 [Status-W29 slide 10].

**PS proposed integration flows** (Salesforce architecture): "1-Way Price Cost" (ERP → SF), "2-Way PR PO", "2-Way Invoice Status", "2-Way Fulfillment Status" (Oracle PPM), "2-Way Ticket Case" (ServiceNow), "AppExchange Connector" (Sirion), "Legacy Data from Fusion — ETL via MuleSoft" [ArchDiag]. Event triggers assumed: "a Flow on 'Opportunity Closed-Won' will trigger an outbound API call to ERP" (PR/PO) and "a Flow on 'Fulfillment Milestone Complete' will trigger an outbound API call to ERP" (invoice); "ERP can provide real-time updates on invoice status (Sent, Paid, Overdue)" [Estimate R-04.1, R-05.1, R-05.2].

---

## 3. Pain points, gaps and observations (verbatim)

### 3.1 From the RFP / Salesforce workshop (Tasama's own statement)
"Current Pain Points: CRM is only in use for 2 out of 4 business lines. • Delivery teams are notified of closed deals via email, with no structured handover or SLA tracking. • Invoicing is requested manually through Excel, then processed via ERP. • PRs/POs/CoCs are manually raised and are not linked to specific deals • Pricing is manually calculated by extracting ERP procurement data and building markups in Excel. • Ticketing system is not integrated and client self-service requests are manually invoiced • No centralized customer visibility or supplier engagement tools." [RFP; WS-Deck slide 5 notes; Q&A Headline]

Management priorities: "Earlier CRM implementation was narrow, led by business owner with limited scope, leaving a 'crippled and dysfunctional' system. Main gaps are with: - analytics (why are we loosing deals, whitespace etc.) - customer 360 (view of invoices, payments, bad debt, cross-sell etc.) - time to close a deal due to tasks being done manually (pricing on excel, discussions through in person meetings etc.) - **Revenue assurance; Insuring a timely and accurate billing as well as collection**" [Q&A 1.6]. Adoption barrier: "Resistance to change and legacy tool (FM Tech)" [Q&A 1.3]. Payments: "no integration with any banks … manual reconciliation" [Q&A 4.9]. Scope gap raised by PS: "There is no mention of billing, receipts/collections, credits, refunds, bad debt, compliance etc - are they in scope? → The integration with ERP will need to support this" [Q&A 8.5].

### 3.2 From the VCI PMO (Oct 2025) — programme-level and finance-side friction
"BPM, ERP Implementation and Integration may delay due to outstanding payments"; "Accenture invoicing stuck with finance in waiting of COCs"; "Outstanding payment of 600K to Exquitech; Outstanding payment to Oracle MT 1M; Outstanding payment to Accenture 5M" [VCI-PMO slide 4]. "Implement New Sales Process – Accenture activities on-hold until contract is extended – CFO support required to clear outstanding payments (aprox. 5 Mil SAR)" [slide 13]. "Stage 2 requires resources and ownership for engagement setup team"; "Stage 3 not started due to resource limitations" [slide 14]. Commercial governance pain points and quick wins table (slides 13–15) — every row quoted in section 1.2; additional quick-win phrasing: "Make CRM/ServiceNow logging a mandatory precondition for onboarding; Configure automatic SLA tracking once contract is logged"; "Enforce CRM tagging of final contract terms; Automate contract summary handoff to delivery team"; "Not all contracts are logged in CRM or trigger onboarding; delivery timelines are opaque".

### 3.3 From the EA Current State Observations (188 rows; L2C-relevant ones)
| # | Domain | Observation (verbatim) |
|---|---|---|
| 28 | Application | "CRM is currently in place; however, it lacks the required integration with relevant systems to automate the lead-to-cash process. It furthermore does not currently serve as a true customer relationship management covering customer profiles, account mapping, customer complains, marketing campaigns, etc." |
| 48 | Business | "Sales Enablement & CRM Admin: Capability exists but is scattered across multiple teams (Sales Management and KAM), covering areas such as PIF and Government Entities. It lacks a well-defined end-to-end process for managing the full lifecycle from lead capture / identification to invoicing and collection. Additionally, there is no integration with other functions such as Procurement and Finance" |
| 49 | Business | "Order & Contract Administration: Capability exists; however, processes require refinement and automation" |
| 50 | Business | "Pricing & Revenue Ops: Capability exists; however, processes require refinement and automation to ensure scalability" |
| 52 | Business | "Customer Data & Consent Admin: A single source of truth for customer data does not exist … customer data is scattered across multiple platforms and Excel sheets" |
| 54 | Business | "Finance & Accounting: … Automate the Certificate of Completion (COC) approval workflow to reduce manual effort … Automate the process for submitting financial requests and tracking follow-ups … Streamline finance operations through full automation of the Lead-to-Cash process" |
| 55 | Business | "Procurement: … Enhance procurement processes that are currently manual by introducing automation and integration across the Lead-to-Cash process; Automate internal procurement request submissions and follow-up processes, which are currently handled via email" |
| 65 | Data | "Master data likely spread across multiple applications (Oracle Fusion ERP, Oracle CRM, ServiceNow and Others) resulting in data duplication and inconsistency" |
| 76 | BD | "Manual Opportunity Tracking in Excel — Business opportunities are tracked manually in Excel, with no dedicated system for pipeline management, updates, or reporting" |
| 77 | BD | "Decentralized Proposal Management — Proposals are stored in Microsoft Teams without a centralized tool for organizing, searching, or managing versions" |
| 79 | BD | "Manual Proposal Creation Process — The proposal creation process is time-consuming and lacks automation" |
| 80 | Commercial | "Lack of a Unified CRM Repository — There is no centralized or consistent repository of customer and sales data within the CRM, leading to data duplication and limited visibility" |
| 81 | Commercial | "Manual Commercial Operations — Most commercial activities are managed manually without dedicated tools" |
| 82 | Commercial | "Incomplete Lead-to-Opportunity Coverage — The full sales lifecycle—from lead generation to opportunity management—is not fully automated or integrated" |
| 86 | Procurement | "Inefficient Tracking and Follow-up Mechanisms — No robust system to track purchase orders (POs), RFPs, and other procurement activities" |
| 92 | Finance | "Manual and Disconnected Financial Processes — Several financial activities—including COC approvals, invoice approvals, credit note adjustments, and pre-engagement spendings—are handled manually via email or outside the system" |
| 93 | Finance | "Lack of Integration Across Departments — Service flows between Finance, HR, and Procurement are not connected, resulting in repeated data entry, inconsistent records, and multiple manual reviews" |
| 94 | Finance | "Inefficient Project and Cost Management — Project Portfolio Management (PPM) and cost tracking are performed manually through spreadsheets and emails" |
| 130 | Procurement Ops | "Manual Procurement Processing — Purchase Requisitions (PRs) and Purchase Orders (POs) are manually created and tracked in Excel" |
| 132 | Procurement Ops | "Absence of a Contract Management System — No centralized solution exists for managing contract lifecycles, renewals, and compliance tracking" |
| 136 | Sales & AM | "Lack of Unified System and Single Source of Truth — Absence of an integrated system consolidating key sales and account data such as invoices, marketing, and customer surveys" |
| 137 | Sales & AM | "Incomplete Sales Cycle Automation — **The current process covers only half of the sales cycle; workflows stop at the proposal stage, with proposal-to-closing activities handled manually**" |
| 138 | Sales & AM | "No Integration with Finance for 360 Account View — Lack of system integration with finance prevents a comprehensive view of account health, payments, and financial performance" |
| 139 | Sales & AM | "Limited Visibility on Overdue Invoices and Customer Feedback — No integrated visibility into overdue invoices or automated linkage with survey tools" |
| 141 | Sales & AM | "Absence of Digital Signature Capability — No formal e-signature solution in place; teams rely on manual PDF signatures" |
| 143 | Sales & AM | "Manual Revenue Input and Reporting — Revenue data is entered manually, with company-wide financial tracking managed through Excel" |
| 144 | Sales & AM | "**Lengthy and Manual Invoicing Process — Invoicing is performed manually, leading to delays, limited tracking, and reduced operational efficiency**" |
| 149 | Service Delivery | "No Integration Between ERP and ServiceNow … duplicated entries and disjointed service management processes" |
| 151 | Strategic Partnership | "Fragmented Communication and Vendor Engagement … leading to multiple MSAs with the same vendor" |
| 154 | Strategic Partnership | "Non-Standardized Master Service Agreements (MSAs) — MSAs differ across vendors and departments, creating compliance risks" |
| 165 | TMO | "Lack of a Structured Invoicing and Follow-up System — There is no clear system for managing project-related invoicing, payment tracking, or financial follow-up activities" |
| 184 | Integration | "Absence of Integration Catalog to inventory all integrations (owner, method, frequency, payload, SLAs)" |
[EA-Obs Sheet1]

### 3.4 From client-supplied process inventory and F&A workflows
The client's own process list marks the entire sales-side chain as manual with no application: "Sales & Account Management — Client Onboarding / Key Account Management / **Proposal to Purchase Order Workflow** / Purchase Order Creation / Master Services Agreement (MSA) Management / Corporate Property Contract Management — Manual — N/A"; "Business Development — Standard Proposal Development and Submission; Non-Standard Proposal Development and Approval — Manual"; "Corporate Finance — **Invoicing and Billing — Manual — N/A**"; "Corporate Finance — Account Management — Semi — ERP" [CurProc]. The F&A workflow deck shows an email-driven invoice tracker: "FAP_100_004 – Detailed Invoice Tracker (both AP and AR) — Record Invoices based on email communication from Client — Record Invoice and Update tracker"; AP posting gated on "Delivery Approval/COC Signed?"; volumes noted "37,000 tickets for the past 2 years", "Accounts Payable is 60% of their job in servicenow", "Record invoices around 8k" [F&A-WF slides 2–5].

### 3.5 Financial symptoms visible in the Board scorecard (Jan–Apr 2026)
"Revenue (incl. SA) Q2 Target 33M, Current 13.3M, Forecast 17M — AT RISK"; "Share of Revenue from non-PIF 23% target, 7% current"; "Gross Margin (incl. SA) 49% target, -17% current"; "CSAT >4 target, 3.6 current"; "Long-Term Contract Value Ratio — Value of active contracts with duration >12 months ÷ total active contract value, excl. PIF SA — Due in Q4". Negative D&T gross margin root causes include "Delayed Oracle MT invoice (2025) … paid in 2026; its cost (~2M SAR) is fully loaded into April COGS" and "PIF Service Agreement expiry — The PIF SA ceases to apply from August". [Status-W29 slides 14, 17]

---

## 4. CPQ Deal Summary — what a Tasama deal/quote looks like

The workbook (Proposal/15. Lead to Cash/CPQ/CPQ Deal Summary.xlsx) is Publicis Sapient's own deal-costing model for staffing a Tasama engagement, priced against the **Tasama MSA rate card** (sheet "Tasma"). It is the best available template for a professional-services deal structure [CPQ].

### 4.1 Quote line structure (sheets "Aziz" and "Quote")
Columns (verbatim): `Expertise | Career Stage Plus Level | Home Metro | Start Date | End Date | Weeks | Commit % | Addl. Available Hours(NBH) | Billable Costed Hours | Hourly Override Rate | Revenue | Direct Labour Cost | Profit/Rev-Cost | Direct Margin %`, with helper columns `Take the role from Tasama Sheet | Daily | Hourly | Discount | Hourly | TH | BH | BD | BD | NBH`.

Example lines ("Quote" sheet):
| Expertise | Level | Metro | Start–End | Weeks | Commit % | Billable Hours | Hourly rate (SAR) | Revenue | Direct Labour Cost | Margin % | MSA role → daily rate |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Strategy - Technology Strategist - Technology Strategy | Senior Associate | Dubai | 06/07/2026–25/09/2026 | 12 | 1 | 480 | 712.5 | 342,000 | 162,822.65 | 52.4% | Strategy - Senior Consultant → 5,700/day |
| (same) | Senior Associate | Dubai | same | 12 | 1 | 480 | 712.5 | 342,000 | 162,822.65 | 52.4% | 5,700/day |
| (same) | Director/Expert L2 | Dubai | same | 12 | 0.1 | 48 | 1,769.375 | 84,930 | 44,746.13 | 47.3% | Strategy - Senior Director → 14,155/day |

Mechanics evident from the numbers: hourly rate = daily MSA rate ÷ 8 (5,700/8 = 712.5; 14,155/8 = 1,769.375); billable hours = weeks × 40 × commit % (12 × 40 × 1 = 480; 12 × 40 × 0.1 = 48); billable days = hours ÷ 8 (60; 6).

### 4.2 Deal roll-up block (verbatim labels, "Quote" sheet)
`Services 768,930 | Risk 0 | Discount 0 | Add 15,380 | Billable - Expenses 120,000 | Total Services 784,310 | Client Price 904,310 | PS Rev 784,310 | Margin 0.5029 | WHT 19,494.29 | T&L Expenses 120,000 | MSL Cost 0 | T&L 10,000 … 2 … 120,000 | Services 784,310 | Expenses 120,000 | Total 904,310`. Cost side: `Not Riyadh 370,391.43 | Riyadh 0`, WHT ≈ 5% of cost (370,391.43 × 0.0526 ≈ 19,494). The "Aziz" variant: 2 lines × 10 weeks, `Total Services 669,750 | Billable - Expenses 100,000 | Client Price 769,750 | Margin 0.5199 | WHT 16,078`. So a typical PS-to-Tasama deal: 2–3 named roles, 10–12 weeks, SAR 0.67–0.78M services + SAR 0.10–0.12M T&L, ~50–52% direct margin.

### 4.3 The Tasama MSA rate card (sheet "Tasma") — daily rates, SAR, exclusive of VAT
Columns: `Capability | Role | Range for Years of Experience | Rate Location (Exclusive of VAT): KSA | International | Offshore | Nearshore | Rate Frequency (Daily) | Currency (SAR)`.

| Capability | Role (verbatim) | Yrs | KSA | Intl | Offshore |
|---|---|---|---|---|---|
| Corporate & Digital Strategy (also "Business Incubation and Acceleration Services") | Strategy - Associate Consultant | 2-4 | 4,085 | 5,605 | — |
| | Strategy - Senior Consultant | 4-6 | 5,700 | 7,790 | — |
| | Strategy - Manager Consultant | 6-7 | 7,695 | 8,455 | — |
| | Strategy - Senior Manager Consultant | 7-9 | 9,120 | 9,690 | — |
| | Strategy - Director | 9-12 | 11,305 | 14,915 | — |
| | Strategy - Senior Director | 12-15 | 14,155 | 19,190 | — |
| | Strategy - Associate Managing Director | 15-17 | 20,520 | 21,090 | — |
| | Strategy - Managing Director | 17-20 | 23,370 | 24,035 | — |
| | Strategy - Senior Managing Director | 20+ | 30,780 | 32,775 | — |
| Product & Program Management | Product/Program Management - Senior Associate … VP | 2-5 … 20+ | 4,940 / 6,840 / 8,835 / 11,685 / 13,490 / 15,485 | 4,655 / 5,510 / 6,270 / 8,360 / 9,595 / 11,780 | 1,425 / 2,185 / 2,850 / 3,515 / 3,990 / 5,605 |
| Experience Management | Experience - Associate … VP | 0-2 … 20+ | 3,610 / 4,560 / 5,415 / 7,505 / 10,830 / 12,445 / 13,205 | 4,465 / 5,035 / 5,320 / 5,795 / 8,170 / 9,310 / 11,400 | 950 / 1,330 / 2,090 / 2,660 / 3,325 / 3,800 / 5,415 |
| Software Development, Cloud & Engineering (also "Operationalization, maintenance and support TASAMA systems") | Engineering - Associate … VP | 0-2 … 20+ | 4,845 / 5,795 / 7,220 / 9,405 / 12,445 / 14,250 / 16,910 | 4,180 / 4,845 / 5,795 / 6,650 / 8,550 / 9,785 / 12,350 | 1,045 / 1,520 / 2,280 / 2,945 / 3,990 / 4,560 / 5,700 |
| Data & AI | Data & AI - Associate … VP | 0-2 … 20+ | 4,940 / 6,175 / 7,790 / 9,785 / 13,490 / 15,485 / 17,955 | 4,465 / 5,415 / 6,080 / 7,030 / 9,405 / 10,830 / 13,490 | 1,235 / 1,710 / 2,470 / 3,230 / 4,560 / 5,225 / 6,555 |
| Communication Services | Communications - Executive … Business Lead | 0-3 … 15+ | 1,900 / 2,185 / 2,945 / 3,610 / 4,655 / 5,985 / 8,550 | — | — |
| Media & PR Services | PR - Associate … VP | 0-3 … 15+ | 1,900 / 2,185 / 2,945 / 3,610 / 5,985 / 6,650 / 9,215 | — | — |
| Media & PR / Performance Services | Media - Executive … Business Lead | 0-3 … 15+ | 2,185 / 2,565 / 3,230 / 3,610 / 4,940 / 5,890 / 8,075 | — | Nearshore 1,045 / 1,235 / 1,805 / 2,375 / 2,755 / 3,800 / 6,080 |
| Content Services | Content - Associate … Business Lead | 0-3 … 15+ | 2,185 / 2,565 / 3,230 / 3,610 / 4,940 / 5,890 / 8,075 | — | — |

Supporting sheets: "Cost" gives PS hourly cost per level (e.g., Strategy Senior Consultant 338.73/h; Manager 424.98/h; Senior Director 930.87/h); "Lookup" maps Home Metro to a cost band (Dubai 3, Riyadh 3, Bangalore 5, London 4, Berlin 4) and career-stage ↔ title across Strategy/Product/Exp/Eng/Data; "MC" maps "CPQ role – Strategy Title" (e.g., "Director/Expert L2 – Senior Principal", "VP / L2 – Managing Director").

### 4.4 A second worked commercial (BD Uplift proposal) — confirms the deal pattern
"All prices are quoted in Saudi Riyals (SAR). All prices are exclusive of Value-Added Tax (VAT). The quoted amount is based on a capacity model for 8 weeks. Should the project extend beyond the stated timelines, any additional time will be charged on a Time and Material as per the MSA agreement. Travel and living expenses will be invoiced based on actual costs incurred and capped at SAR 352,000." Lines: `Strategy - Managing Director | 4 days | 23,370 | 93,480`; `Strategy - Senior Director | 40 | 14,155 | 566,200`; `Strategy - Manager Consultant | 40 | 7,695 | 307,800` ×2; `Travel and Living Expenses 352,000`; `Total 1,627,280`. Payment schedule: "We will submit our invoices on monthly basis": "End of Month 1 637,640; End of Month 2 637,640; Total 1,275,280; Travel and Living Expenses — PS will invoice the actual on monthly basis." [BD-Uplift]

### 4.5 Implications for synthetic contract design
Tasama's **own** service deals (as seller) are not costed in these files, but the Q&A gives the shape: service categories "Implementation Services (e.g. implement ERP), Licensing (system licenses), Equipment (laptops, screens etc.), Consultative Services (bread and butter)"; "one-off, fixed-term or recurring — All three options need to be available"; bundles "(e.g. ERP implementation & licenses, Laptop, mouse, headset etc.)"; pricing models "Cost-plus %, Fixed rates, Tiered pricing, Dynamic pricing based on contract terms and vendor fluctuations"; discounts "up to 7% on some services"; "Term based discount … client extending with Tasama, or agreeing to have a longer contract terms"; currencies "Mainly SAR & USD … rate ~3.75 SAR/USD"; pricing changes "Likely once a year (depending on the MSA)"; contract types "Subscriptions, One-Off Supplies, Fixed Term etc."; delivery SLA "1 day to 1 month"; cost data refresh "Daily" [Q&A 4.2–4.8, 5.1, 2.6, 9.6; RFP Requirements 2.3]. Portfolio-level figures: 2025 pipeline 314 opportunities (CPS 65, Digital Services 69, Innovation Management 67, Shared Services 113); outcomes Won 94 / Lost 95 / TBC 110 / Cancelled 15; 2025 revenue SAR 73.79M (CPS 38.73M, Digital Services 14.35M, IM 6.98M, Shared Services 13.72M); gross profit SAR 42.32M; average deal size CPS 1,047,216, Digital Services 396,730, IM 455,105, Shared Services 140,204 [VT-SF Pipeline Raw Data]. CLM business case assumes "94 contracts per year", "Avg. contract value (ACV) 500,000 SAR", "Avg. contract cycle time — current (manual) 45 days", "Contract-related incidents per year (current) 12 … Missed renewals, obligation failures, penalty triggers, compliance gaps" [VT-CLM].

---

## 5. CRM requirements and workshop answers relevant to quote-to-cash

### 5.1 RFP scope (verbatim headings) [RFP]
1. CRM Expansion & Deal Management Automation — "Codify deal review and approval stages via dynamic questionnaires/forms within the CRM; Configure automated workflows for deal approval, delivery team notifications, and downstream systems."
2. Pricing Automation — "Integrate existing ERP procurement catalogues with the CRM service catalogue; Automate price calculation based on real-time cost data and predefined pricing logic; Enable configurable pricing models (e.g. cost-plus, fixed rates, tiered pricing); Adjust pricing dynamically based on contractual Terms & Conditions."
3. Order Fulfillment & Tracking — "Implement an order management engine to track fulfillment activities against deals using existing Oracle PPM; Use existing ServiceNow APIs to capture client self-service requests; Provide SLA tracking and escalation mechanisms."
4. Procurement Automation — "Automate purchase requisition and PO generation on the existing ERP system for vendor-fulfilled products upon deal closure; Integrate PR/PO workflow between the existing ERP and CRM for real-time visibility."
5. Invoicing & Finance Integration — "Automate invoice generation on the existing ERP based on closed deals, delivery status, and fulfillment data; Ensure seamless financial posting and reporting on the existing ERP."
6. Contract Lifecycle Management Integration — "Capture client contracts in Customer 360 view, notify sales & KAMs on upcoming contract expiration dates."
7. Analytics & Customer 360 Dashboard — "Invoicing history and collection status; Service white space analysis (upsell/cross-sell opportunities); Ticket/incidents overview and resolution status; Customer satisfaction scores and trends; Performance Analytics dashboards (products, services, partners, teams)."
Exclusions: "Development of a new ERP or ticketing system; Implementing Finance, Procurement & iSupplier and PPM modules; iSupplier enhancements; Procurement – CLM integration; Implementing a marketplace & marketing solution." Duration asked: "12–16 weeks" (PS: "The 12-16 week timeline is not feasible" [Estimate]).

### 5.2 Objects, fields and data model implied
- Standard: Lead, Account, Contact, Opportunity ("It will require lead, account, contact and opportunity management") [Q&A Headline]; migration from Oracle CRM "such as Customer Accounts, Leads, Open Transactions, Opportunities" for "one year so far" of data [Q&A 5.6, 12.2].
- "3 distinct lead journeys that map to 3 distinct sales processes that align to the services Tasama provides" (Enterprise Value-Added Services, Smart Enterprise Services, Business Enablement Services) [Q&A RFP Requirements 1.3].
- Deal review: "3-5 unique deal review forms" (Screen Flows / Dynamic Forms) [Estimate R-01.3].
- Pricing: "Product/asset/catalogue and pricing to be mastered in ERP and consumed in Salesforce"; "catalogues will be mastered in ERP and Salesforce will be the consumer"; "a one-way, nightly sync of the full catalog"; pricing fields "Will need to be discussed further with commercial team (To be discussed with Ahsan BaPPy)"; T&C-driven pricing assumed as "simple data points (e.g., 'Is_Preferred_Rate__c = true')" [Q&A RFP Requirements 2.1–2.3, 5.4; Estimate R-02].
- Orders: "'Order' and 'Order Line Item' objects will be created" (Service Cloud custom objects) with "3-5 defined SLA policies" via Entitlements/Milestones [Estimate R-03.1, R-03.3]. Required attributes from ERP: "Project ID coming from PPM, Department Business Line" [Q&A 6.1].
- PR/PO: status back into Salesforce via Platform Events; "approval hierarchies or budget checks before PR issuance? Yes" [Estimate R-04.2; Q&A 7.4].
- Invoices: custom objects holding "Invoice/Payment status back from ERP" ("Sent, Paid, Overdue") [Estimate R-05.2]; "Does ERP push back invoice status or payment confirmation to CRM? It will need to do so" [Q&A 8.4].
- Contracts: Sirion AppExchange "standard objects/components for the C360 view"; expiration alerts via "scheduled Flow or Report on the Contract end date"; "At the very least, in-app notifications and email alerts" [Estimate R-06; Q&A 9.3].
- Revenue recognition / milestones: no revenue-recognition requirement appears in any file. The closest items are "Invoicing and billing is triggered once the order has been fulfilled", invoicing frequencies asked as "milestone, delivery-based, or recurring", the proposed trigger "Fulfillment Milestone Complete", and the CLM case's "Revenue acceleration (% of ACV unlocked earlier) 3% … accelerated revenue recognition" [Q&A 8.1; WS-Deck slide 10; Estimate R-05.1; VT-CLM].
- Additional asks: "Need ability to capture vendor capacity (in iSupplier) — Yes"; "Need KPIs to measure realisation (e.g. we delivered X value) — Pending PIF Team"; knowledge management for sales collateral ("NICE TO HAVE") [Q&A 15.1–15.3].
- Analytics: "KPIs to include revenue, satisfaction, aging … Account Performance KPIs"; "AI driven analytics would be required"; "PowerBI is currently utilised too" [Q&A 10.1–10.4].

### 5.3 PS phase plan and estimates
Kick-off deliverable sequence: "Build – Iteration 1: Leads sourcing integration and leads management; Leads conversion and account creation; Integration to Oracle ERP and Service Now ready. Build – Iteration 2: Deal management, Order and invoice creation with Oracle integration; Dynamic pricing solution (revenue cloud) with Oracle integration; Order fulfilment tracking with Service now integration. Scale – Iteration 3: Customer 360 view with order, invoice, leads and deals; Account Tickets and incident view from Service Now; Einstein based forecasting and scoring…; Integration of finance data from Salesforce to ERP. Scale – Iteration 4: Procurement data from ERP; Contract Lifecycle Management with Sirion; Reports and Dashboards." [Kickoff slide 9]. Phase 1 out of scope: "Managing Procurement, Invoicing, PO/PR/Order, tickets/incidents are out of scope for Phase 1. Information for these entities are only going to be integrated into Sales Cloud for customer 360 view Only." [Kickoff slide 11]. Core build estimate 2,840 h (35% of total) [Estimate]; revised 2,540 h in the workbook, 12-month sustain pod 5,280 h; MuleSoft integration 8 APIs across Sirion (2), ERP (1), ERP Finance (1), ServiceNow (2), ERP Procurement (1), Logs (1) [Q&A Estimates; Mulesoft Integration Estimation]. Team plan dated 12.01.2026–21.06.2026 build, sustain 08.06.2026–30.11.2026 [Q&A R&R].

---

## 6. Current status of Salesforce CRM, Odoo ERP, CLM and related initiatives

### 6.1 Status as of 2 June 2026 (project status "as of 21st May 2026") [Status-W29 slides 10–12]
| # | Project | Owner | Status | Target end | Board target | Key update |
|---|---|---|---|---|---|---|
| 7 | Salesforce CRM Implementation | Rawan A. | **Delayed** (Issue) | 06/08/26 | 30/10/26 | "Completed Data Migration Strategy, Sprint 1 and BRD development". RAID: "Delay in project timeline due to multiple technical alignment sessions — Progress with the build phase while completing discovery and design — Developed the BRD based on current understanding" (due 31/05/2026) |
| 8 | CRM Enhancement (VCI) | Horia A. | **Completed** 21/05/26 | — | 31/05/2026 | Board scorecard lists "Oracle CRM Enhancement" as a completed digital initiative |
| 9 | Contract Lifecycle Mgmt. (VCI) | Rawan A. | **Delayed** (Issue) | 22/10/26 | 30/11/26 | "Conducted design workshops with business stakeholders". RAID: "delays in design workshops and Digital Signature procurement — Re-baseline the plan and expedite procurement — raised PR for digital signature — Support Required: Follow up with Procurement" |
| 11 | Core Systems Integration (VCI) | Dina A. | **Planned** | 30/10/26 | 31/12/26 | "Detailed plan developed and under review with Project Owner" |
| 15b | Odoo ERP Implementation | Rawan A. | **Delayed** (Issue) | 15/10/26 | 31/12/26 | "Analysis for all modules and golden template BRD completed". RAID: "multiple discovery sessions and BRD development — Expedite receival of BRD and sign-off — booked project Steerco" |
| 15a | TASAMA Business Center | Rasha A. | On Track (Risk) | 31/12/26 | 31/12/26 | "Phase 3 BRD sign-off"; Phase 3 "intended to go live on June 18th" |
| 15c | TASAMA Core (AI Agent-as-a-service) Internal | Nouf A. | On Track | 31/12/26 | 31/12/26 | "Conducted the kick-off with CDO and initiated platform development" |
| 2 | Business Process Mgmt. Platform (VCI) | Rawan A. | Under Mobilization | 28/08/26 | 30/09/26 | "project scope under definition" |
| 10a/10b | PPM Quick Win / Additional Capabilities | Rasha A./Rawan A. | Completed 03/03/2026 / On Track 28/06/26 | | | "SDD pending approval from Finance" |
| 5 | PMO Solution Development & Commercialization | Rawan A. | On Track | 27/08/26 | | kick-off and design workshops done |

Completion percentages shown for the transformation portfolio: "46% vs 46% internal vs 39% Board". Plan-on-a-page shows Salesforce CRM Implementation running Jan–Aug 2026 then "Hypercare & AMS"; CLM Implementation through Oct/Nov 2026; Odoo through Oct 2026; Core Systems Integration May–Oct 2026 [Status-W29 slide 9].

### 6.2 Earlier timeline anchors
- VCI programme: planned 1 Jul–30 Sep 2025, "Actual End Date 31 Dec 25"; "CRM RFP closed – technical evaluation done" by 16 Oct 2025; "CLM RFP in progress"; "Integration (est Mar 2026)"; "Migrate CRM to TASAMA's ERP" [VCI-PMO slides 13, 24].
- CRM comparison concluding for Salesforce: 28 Oct 2025 [CRM-Cmp]. CLM comparison: Dec 2025 [CLM-Cmp]. PS Salesforce build plan: weeks from 2026-01-05, build to 21.06.2026 [Q&A Phase 1 Team]. Application Catalog (May 2026) still lists Oracle CX as the running CRM [AppCat].

### 6.3 Value-tracking KPIs and business cases
**Salesforce CRM** [VT-SF]: Win-Rate Uplift Model — Baseline 314 opportunities, win rate 0.28, "Average Profit Value 509,813 SAR", baseline wins 87.92, baseline profit SAR 44.82M; target uplift 0.06 pp → win rate 0.34, 106.76 wins, incremental 18.84 wins, "Gross Incremental Revenue 9,604,876.92 SAR"; realization 0.5/0.7/1.0 over 3 years → attributed SAR 4.80M / 6.72M / 9.60M. Costs: "Implementation Cost to Vendor 2,235,752; Support Cost per year 521,983.80; Total Licenses per year 2,609,919 (Y1), 3,065,544.38 (Y2, Y3)"; "Total Incremental Profit Year 1 -565,216; Year 2 3,657,869; Year 3 6,539,333".

**CRM Enhancement (Oracle, VCI)** [VT-CRMEnh]: same win-rate archetype but "Realization Factor 0.3" because "this initiative will be stopped within a year, and migrated to Salesforce CRM"; attributed SAR 2,881,463 (SAR 240,122/month); costs "Implementation Cost to Accenture 526,000; Support Cost for 6 months 142,560; 10 Licenses 131,431; Required 20 Licenses minimum 262,862"; "ROI 1.09". Automation line: "Meeting Committees — 1/wk, 1 hr, 227 SAR/hr, 80% time reduction" → SAR 9,255/yr. Value-tracking metrics defined: "Win Rate = number of opportunities won / (won + lost) × 100"; "Average Deal Size = total revenue / number of opportunities won"; "YoY Revenue Change"; value drivers "Increase Total Recurring Revenue Across Service Layers — Total Revenues Across BES, SES, EVAS".

**CLM (Sirion)** [VT-CLM]: 94 contracts/yr × SAR 500k ACV = SAR 47M under management; cycle time 45 → 20 days; incidents 12/yr × SAR 50k, 70% reduction → SAR 420k saving; 3 FTEs × SAR 480k, 40% time saved → SAR 576k; revenue acceleration SAR 96,575; "Annual platform licence (Sirion) 318,750; Implementation cost (one-time) 225,000; Ongoing support & admin 56,250; Total annual cost 450,000"; "NET ANNUAL BENEFIT 642,575; ROI 1.43; Payback 4.94 months". Non-monetary: CSAT baseline 4.0/5 (80%) → target 4.5 (90%); NPS target 6.67 (no baseline); training index target 26.7 ("25 users estimate").

**Odoo ERP** [VT-Odoo]: "Based on the BPO business cases"; benefits "Agentic Platform Enablement Savings" SAR 1.03M (Y0) rising to 2.06M (Y6) plus "Other Services Savings"; costs Year 0 SAR 410,336 ("Odoo Core Modules 131,000; Customization 151,000; Integration – Per Touch Point 4,900; Custom Reports (10) 28,350; Training 21,500; Odoo License 25,182; Odoo Hosting 48,404"), SAR 73,586/yr thereafter; "Total Cost (6yr) 851,852; Total Benefit (6yr) 10,941,828; Net Benefit 10,089,976; Payback 0.47 years". Service coverage split (Odoo vs Agentic): Accounts Receivable "Odoo Impact 1 / Agentic 0" in summary but AR enablement sheet scores ERP 0.28 / Agentic 0.72, with steps "Customer Setup & Credit; Invoice Generation & Sending (Full automated from salesorder); Cash Application (Rule based matching); Collections Management (Automated reminders & dunning rules); Reporting & Provisioning (AR aging, forecasting bad debt)". Odoo price list includes "Sales-Subscriptions 3,000–38,000", "Finance-Invoicing 3,000–30,000", "Sales-CRM 3,000–8,000", licence "918–1,096.59 per user (Year 1)", hosting "3,937.5–92,871.7 (up to 25 users)".

### 6.4 Board KPIs the L2C platform is expected to feed
"Revenue (incl. SA)", "Share of Revenue from non-PIF", "Gross Margin", "CSAT (1–5, >4 target, current 3.6)", "Client retention — Revenue per retained client (23-client baseline as of Jan 2026)", "Long-Term Contract Value Ratio — Value of active contracts with duration >12 months ÷ total active contract value, excl. PIF SA (Due in Q4)", "No of active Digital Partnerships — 13 (Publicis Sapient, Masterworks, Exquitech, Oracle, Sirionlabs, Gravity, Sparkle Haze, ESRI, Accenture, Salesforce, Procore, Consertus, IBM)", "KPI data automation & quality — 90%" [Status-W29 slides 14–16].

---

## 7. Gaps in the source material worth knowing before designing
1. No DoA thresholds, approver names by amount, or discount approval matrix exist in any file; only the gate questions and "sales directors and finance and operations" as approvers.
2. No Tasama-as-seller quote or contract example exists; the only priced deals are PS-to-Tasama staffing deals on the Tasama MSA rate card.
3. Stage 3 (billing → collection → renewal → close) has no TASAMA process map; the COC-gated invoice step and manual bank reconciliation are the only documented billing mechanics.
4. No revenue-recognition rules, milestone schedules or credit-note policies are documented; credit notes/partial billing are only acknowledged as needed.
5. The System Flow does not show CPQ-to-ERP order/invoice data mapping; the PS estimate assumes "Order"/"Order Line Item" custom objects and ERP status callbacks ("Sent, Paid, Overdue") but these are vendor assumptions, not TASAMA requirements.
