# TASAMA Business Services — public research (6 October 2026)

Method: ~20 web searches (English and Arabic), ~30 page fetches across tasama.com.sa (EN/AR and the stylesheet), pif.gov.sa, SPA, Argaam, Arab News, Fast Company ME, Finance Middle East, Saudi Standard, MarketScreener/Maaal (Tadawul disclosure), TheOrg, ZoomInfo, Saudipedia, and Saudi tax/payroll references.

## 1. What Tasama is

Tasama Business Services Company (شركة تسامى لخدمات الأعمال) is wholly owned by the Public Investment Fund, publicly launched 13 July 2025 in Riyadh. Formed by merging the Business Incubators and Accelerators Company (BIAC, previously under TAQNIA) and PIF's internal Shared Services Center. PIF frames it as "an integrated operational arm" serving government entities, national institutions and international companies in Saudi Arabia. The CEO told Argaam a five-year strategy is aligned with PIF priorities: spending efficiency, local content, investment diversification.

Vision: "A thriving economy elevated by innovative and state-of-the-art business services." Mission: "Empowering businesses and government institutions to grow and drive efficiencies by delivering reliable, agile, and digitally native business services tailored to their needs."

Leadership (as published): CEO H.E. Eng. Mohammed N. AlJasser; Board Chairman Abdulah Al Salem; board members Alexander Modrow, Bashayer AlFayez, Shahd Attar, Yasser AlGhofaily. Third-party listings (TheOrg, ZoomInfo — indicative only): Saed Hussein CFO; Hamad AlSaghir CCO; Jeremy Briat Chief of Staff; Saeed Alshahrani SVP Innovation Management & Operations; Nawaf Al Sahhaf COO; Tariq AlYemni CHRO. HQ 8476 King Fahad Road, Almuhammadiyah, Riyadh 12363.

## 2. Service lines and business model (site wording)

- **Enterprise Value-Added Services** — innovation programme management, marketing, data/analytics/AI.
- **Smart Enterprise Services** — "Optimize operations, finance, HR and procurement with digital tools": Finance, Accounting & Tax; Human Capital and Talent Search; Procurement; Legal; PMO as a Service; Technology Operations.
- **Business Enablement Services** — workplace infrastructure; PIF calls this pillar "Establishment".

Products: TASAMA Business Landing (market entry, Establish/Operate/Expand, 2–4 months, SLAs, a Service Delivery Lead, legal advisor and Key Account Manager per engagement); TASAMA Payroll Management (GOSI, Mudad WPS); **Finance Managed Services** — seven areas (GL, Bank Management, AP, AR, Fixed Assets, Employee Disbursement, Zakat & Tax), "fixed monthly subscription based on the selected package, with a 12-month term that renews annually", packages tiered by transaction volumes, bank accounts and payment cycles, data hosted in KSA; TASAMA Business Center Portal (unified digital gateway, launched April 2026).

Business model in short: a PIF captive shared-services centre converted into a commercial BPO/managed-services provider selling subscription-priced back-office operations plus market-entry and workspace services, to PIF portfolio companies, government entities and inbound multinationals.

## 3. Clients and scale

Homepage logo strip: Ma'aden, Riyadh Air, Ministry of Health, MCIT, Social Development Bank, KACST, "and 30+ additional organizations". No revenue, client count or headcount disclosed; third-party estimates conflict (TheOrg 51–200 staff; ZoomInfo 11–50). Main sponsor of the Saudi Law Conference 2025; "Elevate with Tasama" event 28 April 2026.

## 4. Technology

Oracle Fusion Cloud is the confirmed core platform: the supplier portal points to an Oracle Fusion SaaS tenancy; careers run on Oracle Cloud HCM Recruiting (a second pod). Tadawul disclosure 21–22 July 2026: Purity for Information Technology (Nomu 9614) signed a three-year MSA with Tasama for "Oracle module implementation services and Application Management Services (AMS)". No public mention of Odoo, SAP, Salesforce or ServiceNow (the internal documents do name Salesforce, Sirion, Odoo and ServiceNow). Business Center uses "advanced technologies and AI".

## 5. Brand (from tasama.com.sa/css/style.css)

Fonts: "Alexandria", "Open Sans" (Google Fonts import, Alexandria 100–900, Poppins 400/700); "IBM Plex Sans Arabic" for RTL. Colours: dark blue `#10069F` (primary), light green `#ADDC91` (accent), white, black, light grey `#F7F7F7`, gold `#B59E5F`, orange `#FF9800` (rare). Logo assets: logo.png, t-svg.svg (the T mark), pif-company.svg (endorsement badge). Arabic site uses the Arabic-only wordmark "تسامى". Taglines: "Boundlessly Elevating Business Services"; AR "تسامى الشريك الأمثل لتمكين الجهات من تحقيق مساهمتها الفعالة في رؤية السعودية".

## 6. Saudi context for a lead-to-cash / close product

- **ZATCA e-invoicing (Fatoora) Phase 2**: waves by revenue (threshold down to SAR 187,500 by Feb 2027). Standard B2B/B2G tax invoices use the **Clearance** model (XML submitted in real time, ZATCA stamps; only the stamped version is valid for the buyer); simplified B2C invoices use **Reporting** within 24 h. UBL 2.1 XML with KSA extension or PDF/A-3 with embedded XML; invoice type codes 388/381/383; mandatory UUID, Invoice Counter Value, Previous Invoice Hash, invoice hash, cryptographic stamp (ECDSA with CSID), QR as base64 TLV (tags 1–9). Buyer VAT number (15 digits, starts/ends with 3) required on B2B invoices; penalties SAR 5,000–50,000. Implication: invoice issuance gated on clearance success; stamped XML and QR stored.
- **VAT** 15%; registration mandatory above SAR 375,000; returns monthly above SAR 40M taxable supplies, else quarterly; due the last day of the following month.
- **Zakat / CIT**: Zakat 2.5% of the Zakat base on the Saudi/GCC share (equity-based, not income); 20% CIT on the foreign share; returns within 120 days of year end; Hijri or Gregorian fiscal years accepted. Receivables and closing balances feed the Zakat base — close data quality matters.
- **WHT** on non-residents: 5% (rent, dividends, interest, technical/consulting, insurance, freight), 15% (royalties, other services), 20% (management fees); monthly return within 10 days.
- **Calendars**: Umm al-Qura Hijri alongside Gregorian; Hijri year ~354 days; dual dates; holiday effects on due dates.
- **Banking**: SAMA regulator; SARIE RTGS/instant rail (preferred B2B); Mada debit; SADAD bill payment; Open Banking. Banks: SNB, Al Rajhi, Riyad Bank, SAB, Alinma, BSF, ANB, Albilad, SAIB, AlJazira. Statements as MT940/MT942 and increasingly CAMT.053/052 via host-to-host or portals; CSV/Excel exports common. Cash application should accept all and match SARIE references and SADAD invoice numbers.
- **Payment terms**: Saudi B2B terms are long — Net 30/60/90 contractually, often 90–120+ in practice; government and government-affiliated buyers frequently pay late; Etimad for government invoices. DSO tracking, bilingual dunning, promise-to-pay and approval-chain visibility matter more than discounting.
- **GOSI / payroll**: Saudi employees 21.5–23.5% (stepping up under the 2024 law), non-Saudi 2%; cap SAR 45,000; WPS via Mudad; contracts in Qiwa.

## Sources

tasama.com.sa (index, about, publication, news, services pages, finance-managed-services, payroll, business-landing, business-center, suppliers, careers, /ar, css/style.css); pif.gov.sa Tasama page; spa.gov.sa N2357646; argaam.com 1827759, 1827318; arabnews.com 2607931; fastcompanyme.com; financemiddleeast.com; saudistandard.com; saudigazette.com.sa 653392; my.gov.sa 635115; theorg.com/org/tasama; zoominfo.com/c/tasama; saudipedia.com BIAC article; marketscreener.com and maaal.com (Purity MSA); daftra.com, novaledgeadvisory.com, qeemahcloud.com, sharayeh.com (ZATCA Phase 2); fonoa.com and motaded.com.sa (VAT/WHT); legal500.com and invoicedataextraction.com (Zakat); ummalquracalendar.org; juspay.io (payments landscape); gfmag.com and investriyadh.ai (banks); treasuryease.com and bankxlsx.com (MT940/CAMT.053); himma.sa and halsimplify.com (payment terms); mercans.com (GOSI 2026).
