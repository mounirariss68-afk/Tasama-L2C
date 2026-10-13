/**
 * Settings — personas, data (where the world lives), ERP, CogniDocs
 * connection, thresholds, scenarios.
 */
import { useEffect, useState } from 'react';
import { Database, HardDrive } from 'lucide-react';
import { PageContainer, PageMasthead, PageSection, Panel, ThemeModeToggle } from '@cognirise/atelier/layout';
import { PersonaSwitcher, ProvenanceNote, SettingsGroup, SettingsRow } from '@cognirise/atelier/archetypes';
import { useApp } from '../app/state';
import { Body, Btn, Chip, KV, Tabs } from '../app/bits';
import { PERSONAS } from '@mizan/domain/personas';
import { ERP_LABEL } from '@mizan/domain/erp';
import { money } from '@mizan/domain/format';

export function SettingsScreen() {
  const { persona, go } = useApp();
  return (
    <>
      <PageMasthead title="Settings" meta={`Signed in as ${persona.name} — ${persona.role}`} actions={<Btn tone="ghost" small onClick={() => go('scenarios')}>Scenarios & reset</Btn>} />

      <Body>
        <Tabs storageKey="settings" tabs={[{ id: 'personas', label: 'Personas', body: () => <Personas /> }, { id: 'connections', label: 'Connections', body: () => <><Data /><Erp /><CogniDocs /></> }, { id: 'thresholds', label: 'Thresholds', body: () => <Thresholds /> }]} />
      </Body>
    </>
  );
}

function Personas() {
  const { persona, setPersona } = useApp();
  return (
    <PageSection label="Who am I, and what may I approve?">
      <Panel title="Switch persona">
        <PersonaSwitcher value={persona.id} onChange={setPersona} personas={PERSONAS.map((p) => ({ id: p.id, name: p.name, role: p.role, initials: p.initials, remit: p.remit, authority: p.authority, restrictions: p.restrictions }))} />
        <ProvenanceNote>Switching changes the inbox, the approvable set, the amounts, the accounts you can open and the menu — not a label in the title bar.</ProvenanceNote>
      </Panel>
    </PageSection>
  );
}

function Data() {
  const { backend, world, reset } = useApp();
  const server = backend.mode === 'server';
  return (
    <PageSection label="Where the world lives">
      <Panel icon={server ? <Database size={16} /> : <HardDrive size={16} />} title={server ? 'PostgreSQL — shared, persisted' : 'This browser only'} action={<Chip tone={server ? 'success' : 'warn'}>{server ? 'server · PostgreSQL' : 'local · localStorage'}</Chip>}>
        <KV rows={[
          ['Store', server ? `PostgreSQL schema "mizan" (${backend.db})` : 'localStorage in this browser'],
          ['Revision', String(world.flags.rev)],
          ['Rows', `${world.clients.length} clients · ${world.pos.length} POs · ${world.events.length} billing events · ${world.invoices.length} invoices · ${world.bankLines.length} bank lines · ${world.trail.length} trail entries`],
          ['Who sees changes', server ? 'Every browser that opens this deployment (polled every 4 s)' : 'Only this browser'],
          ['Survives a reload', 'Yes'],
          ['Survives a server restart', server ? 'Yes — the world is in the database' : 'n/a'],
          ['CogniDocs on the server', backend.cognidocsConfigured ? 'configured (COGNIDOCS_BASE_URL + COGNIDOCS_API_KEY)' : 'not configured'],
        ]} />
        {backend.reason ? <p className="mt-2 rounded-md border border-warn/40 bg-warn/10 p-2 text-xs text-warn">{backend.reason}</p> : null}
        <div className="mt-3 flex items-center gap-2"><Btn tone="ghost" small onClick={() => void reset()}>Reset to the seeded world</Btn><span className="text-[11px] text-muted-foreground">{server ? 'Truncates every table and re-seeds from the deterministic generator (seed 20261006).' : 'Rebuilds the world from the deterministic generator.'}</span></div>
        <ProvenanceNote>Every action is applied by the same reducer on the server and written as one transaction: the rows it changed are upserted, nothing else is touched. The decision trail is a by-product of acting — there is no separate log to keep.</ProvenanceNote>
      </Panel>
    </PageSection>
  );
}

function Erp() {
  const { settings, setSettings } = useApp();
  return (
    <PageSection label="The ERP under Mizan (fictional)">
      <Panel title="Posting dialect">
        <SettingsGroup title="ERP" description="Tasama runs Oracle Fusion Cloud for corporate finance and is introducing Odoo for the operations team. Mizan posts through one connector; the dialect changes the previews and the trail, nothing else.">
          <SettingsRow label="System" hint="Changes every posting preview on the inbox, the journals and the trail." control={<div className="flex gap-2">{(['oracle', 'odoo'] as const).map((e) => <button key={e} type="button" onClick={() => setSettings({ erp: e })} className={`rounded-lg border px-3 py-1.5 text-xs ${settings.erp === e ? 'border-primary/50 bg-primary/12 text-primary' : 'border-border/60 bg-card/40'}`}>{ERP_LABEL[e]}</button>)}</div>} />
          <SettingsRow label="Calls Mizan makes" control={<div className="text-[11px] text-muted-foreground">{settings.erp === 'oracle' ? 'Receivables invoices and credit memos · cash receipts · Payables invoices · GL journal import · purchase orders · projects (Fusion REST)' : 'Customer invoices and credit notes · vendor bills · journal entries · payments · bank statement lines · purchase orders · projects (JSON-RPC)'}</div>} />
          <SettingsRow label="Not connected" control={<Chip tone="warn">simulated</Chip>} />
        </SettingsGroup>
        <ProvenanceNote>Nothing is posted to a real system. The call shapes are plausible for each product; the ERP's own ZATCA integration is assumed for clearance.</ProvenanceNote>
      </Panel>
    </PageSection>
  );
}

function CogniDocs() {
  const { settings, setCogniDocs, apiKey, setApiKey, backend } = useApp();
  const c = settings.cognidocs;
  const [key, setKey] = useState(apiKey);
  const [base, setBase] = useState(c.baseUrl);
  useEffect(() => setBase(c.baseUrl), [c.baseUrl]);
  return (
    <PageSection label="CogniDocs connection">
      <Panel title="Document parsing">
        <SettingsGroup title="Mode" description="Simulated uses the built-in emulator and the sample documents. Live calls the deployment below — through the server proxy when the app is served, directly when it is the standalone file.">
          <SettingsRow label="Mode" control={<div className="flex gap-2">{(['simulated', 'live'] as const).map((m) => <button key={m} type="button" onClick={() => setCogniDocs({ mode: m })} className={`rounded-lg border px-3 py-1.5 text-xs ${c.mode === m ? 'border-primary/50 bg-primary/12 text-primary' : 'border-border/60 bg-card/40'}`}>{m}</button>)}</div>} />
          <SettingsRow label="Server proxy" hint="When the app is served by the Mizan server, live calls go to /api/cognidocs and the server adds the key from its environment." control={<Chip tone={backend.cognidocsConfigured ? 'success' : backend.mode === 'server' ? 'warn' : undefined}>{backend.mode !== 'server' ? 'no server (standalone)' : backend.cognidocsConfigured ? 'COGNIDOCS_BASE_URL + COGNIDOCS_API_KEY set' : 'not configured on the server'}</Chip>} />
          <SettingsRow label="Base URL" hint="e.g. https://<cognidocs-host>/api — leave empty to use the server proxy. Saved with the shared settings." control={<div className="flex gap-2"><input value={base} onChange={(e) => setBase(e.target.value)} onBlur={() => { if (base !== c.baseUrl) setCogniDocs({ baseUrl: base }); }} placeholder="https://…/api" className="w-72 rounded-md border border-border/70 bg-card/60 px-2 py-1 font-mono text-xs" /></div>} />
          <SettingsRow label="API key" hint="Sent as X-API-Key when calling a base URL directly. Kept in this browser only — never written to the shared store." control={<div className="flex gap-2"><input type="password" value={key} onChange={(e) => setKey(e.target.value)} className="w-72 rounded-md border border-border/70 bg-card/60 px-2 py-1 font-mono text-xs" /><Btn small onClick={() => setApiKey(key)}>{apiKey && key === apiKey ? 'Saved' : 'Save'}</Btn></div>} />
          <SettingsRow label="Sandbox key" hint="Sandbox jobs do not count toward the live quota; they return sandbox: true." control={<button type="button" onClick={() => setCogniDocs({ sandbox: !c.sandbox })} className={`rounded-lg border px-3 py-1.5 text-xs ${c.sandbox ? 'border-primary/50 bg-primary/12 text-primary' : 'border-border/60 bg-card/40'}`}>{c.sandbox ? 'sandbox' : 'live quota'}</button>} />
        </SettingsGroup>
        <SettingsGroup title="Contract Mizan honours" description="From the CogniDocs API guide.">
          <div className="grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
            <div>· POST /documents (multipart file + declaredType) → 202 ParseJob</div><div>· GET /jobs/{'{id}'} polled ~2 s, backoff with jitter to ~10 s; stop on completed / failed</div>
            <div>· Money is integer ×10,000; divided by 10,000 for display only</div><div>· Statement direction read from `direction`, never from the sign</div>
            <div>· detailTier, fieldsMissing, reconciliation.delta10k gate what agents may auto-apply</div><div>· 4xx never retried unchanged; 422 password challenges and 403 LEGAL_ACCEPTANCE_REQUIRED surfaced to a person</div>
            <div>· Invoices unique on (vendorKey, normalizedInvoiceRef) → duplicates refused</div><div>· Failed jobs show `error` verbatim; nothing is fabricated or corrected</div>
          </div>
        </SettingsGroup>
      </Panel>
    </PageSection>
  );
}

/** A numeric field that commits on blur or Enter — every commit is an action on the shared world. */
function NumField({ value, onCommit, width = 'w-28' }: { value: number; onCommit: (n: number) => void; width?: string }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const commit = () => { const n = Number(v.replace(/[^0-9.]/g, '')) || 0; if (n !== value) onCommit(n); else setV(String(value)); };
  return <input value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className={`${width} rounded-md border border-border/70 bg-card/60 px-2 py-1 font-mono text-xs`} />;
}

function Thresholds() {
  const { settings, setSettings } = useApp();
  const [cad, setCad] = useState(settings.cocReminderDays.join(', '));
  useEffect(() => setCad(settings.cocReminderDays.join(', ')), [settings.cocReminderDays]);
  return (
    <PageSection label="Where agents stop and people decide">
      <Panel title="Thresholds">
        <SettingsGroup title="Cash and collections">
          <SettingsRow label="Cash-match tolerance" hint="A receipt within this amount of the open invoices is proposed as a tolerance match with the difference to bank charges." control={<NumField value={settings.cashTolerance} onCommit={(n) => setSettings({ cashTolerance: n })} />} />
          <SettingsRow label="Auto-dunning limit (private accounts)" hint="Below this Tahseel sends and reports (A3); above it, and for every PIF or Government account, the KAM approves (A2)." control={<NumField value={settings.autoDunningLimit} onCommit={(n) => setSettings({ autoDunningLimit: n })} />} />
        </SettingsGroup>
        <SettingsGroup title="Contracts and evidence">
          <SettingsRow label="PO consumption alert" hint="Aqd drafts the top-up request at this percentage." control={<NumField value={settings.poConsumptionAlertPct} onCommit={(n) => setSettings({ poConsumptionAlertPct: n })} width="w-20" />} />
          <SettingsRow label="CoC reminder cadence (working days)" hint="After the request is sent." control={<input value={cad} onChange={(e) => setCad(e.target.value)} onBlur={() => { const days = cad.split(',').map((x) => Number(x.trim())).filter(Boolean); if (days.join(',') !== settings.cocReminderDays.join(',')) setSettings({ cocReminderDays: days }); }} className="w-28 rounded-md border border-border/70 bg-card/60 px-2 py-1 font-mono text-xs" />} />
        </SettingsGroup>
        <SettingsGroup title="Appearance"><SettingsRow label="Theme" control={<ThemeModeToggle />} /></SettingsGroup>
        <ProvenanceNote>Current: tolerance {money(settings.cashTolerance)} · auto-dunning below {money(settings.autoDunningLimit)} · PO alert {settings.poConsumptionAlertPct}% · reminders +{settings.cocReminderDays.join(', +')}.</ProvenanceNote>
      </Panel>
    </PageSection>
  );
}
