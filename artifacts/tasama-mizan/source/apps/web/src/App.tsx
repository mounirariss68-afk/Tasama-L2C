/**
 * Tasama Mizan — the shell. The Atelier default frame: backdrop, chat rail,
 * pinned header block, the menu as chrome outside the display area, and the
 * product inside <MainPanel>. The client lens follows you onto every screen.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AppShell, ContextNav,
  LensPicker, MainPanel, TitleBar, TitleBarSearch, UserBadge, Wordmark, useAppChrome, useChatRail,
  type ContextNavItem,
} from '@cognirise/atelier/layout';
import { Bot, Database, FileScan, Gauge, HardDrive, Inbox as InboxIcon, Landmark, Settings as SettingsIcon, Workflow, X } from 'lucide-react';
import { AppState, useApp } from './app/state';
import { PERSONAS, type Section } from '@mizan/domain/personas';
import { ClaudeChatRail } from './app/claude-chat';
import { OverviewScreen } from './screens/overview';
import { InboxScreen } from './screens/inbox';
import { L2CScreen } from './screens/l2c';
import { DocumentsScreen } from './screens/documents';
import { CloseScreen } from './screens/close';
import { AgentsScreen } from './screens/agents';
import { SettingsScreen } from './screens/settings';
import { inboxItems } from '@mizan/domain/derive';
import { PersonaMenu } from './app/persona-menu';

try { if (!localStorage.getItem('atelier-nav-orientation')) localStorage.setItem('atelier-nav-orientation', 'vertical'); } catch { /* private browsing */ }

const ICON: Record<Section, React.ReactNode> = {
  overview: <Gauge size={14} />, inbox: <InboxIcon size={14} />, l2c: <Workflow size={14} />, documents: <FileScan size={14} />, close: <Landmark size={14} />, agents: <Bot size={14} />, settings: <SettingsIcon size={14} />,
};
const LABEL: Record<Section, string> = { overview: 'Overview', inbox: 'Inbox', l2c: 'Lead to cash', documents: 'Documents', close: 'Close', agents: 'Agents', settings: 'Settings' };

function Shell() {
  const rail = useChatRail(false);
  const chrome = useAppChrome();
  const { world, persona, setPersona, nav, section, go, clientLens, setClientLens, backend, clearNotice } = useApp();
  const [search, setSearch] = useState('');
  const [personaOpen, setPersonaOpen] = useState(false);
  useEffect(() => { if (!personaOpen) return; const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPersonaOpen(false); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [personaOpen]);

  const visibleClients = persona.clients.length ? world.clients.filter((c) => persona.clients.includes(c.id)) : world.clients;
  const lenses = useMemo(() => [{ id: 'all', label: visibleClients.length > 1 ? 'All clients' : 'Tasama' }, ...visibleClients.map((c) => ({ id: c.id, label: c.short }))], [visibleClients]);
  const waiting = inboxItems(world).filter((i) => persona.id === 'noura' || i.roles.includes(persona.id)).length;
  const items: ContextNavItem[] = nav.map((id) => ({ id, label: id === 'inbox' && waiting ? `${LABEL[id]} (${waiting})` : LABEL[id], icon: ICON[id], onSelect: () => go(id) }));

  const hits = useMemo(() => {
    const q = search.toLowerCase().trim(); if (q.length < 2) return [];
    const out: { label: string; sub: string; run: () => void }[] = [];
    for (const c of visibleClients) if (c.short.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) out.push({ label: c.short, sub: c.name, run: () => { setClientLens(c.id); go('l2c', undefined, 'clients'); } });
    for (const i of world.invoices) if (i.id.toLowerCase().includes(q)) out.push({ label: i.id, sub: i.description, run: () => go('l2c', undefined, 'collections') });
    for (const p of world.pos) if (p.id.toLowerCase().includes(q)) out.push({ label: p.id, sub: world.clients.find((c) => c.id === p.clientId)!.short, run: () => { setClientLens(p.clientId); go('l2c', undefined, 'orders'); } });
    for (const j of world.journals) if (j.id.toLowerCase().includes(q) || j.kind.toLowerCase().includes(q)) out.push({ label: j.id, sub: j.kind, run: () => go('close', undefined, 'journals') });
    return out.slice(0, 8);
  }, [search, world, visibleClients, go, setClientLens]);

  return (
    <AppShell rail={rail} chrome={chrome}
      chatRail={<ClaudeChatRail rail={rail} />}
      titleBar={<TitleBar brand={<Wordmark>Mizan</Wordmark>}
        search={<div className="relative"><TitleBarSearch placeholder="Search clients, POs, invoices, journals…" value={search} onChange={setSearch} />{hits.length ? <div className="glass-popover absolute start-0 top-full z-50 mt-1 w-[26rem] rounded-xl p-1.5">{hits.map((h, i) => <button key={i} type="button" onClick={() => { setSearch(''); h.run(); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start hover:bg-card/70"><span className="font-mono text-[11px] text-foreground">{h.label}</span><span className="truncate text-[11px] text-muted-foreground">{h.sub}</span></button>)}</div> : null}</div>}
        lens={<div className="flex items-center gap-2"><LensPicker lenses={lenses} value={clientLens ?? 'all'} onChange={(id) => setClientLens(id === 'all' ? null : id)} />
          <button type="button" onClick={() => go('settings', undefined, 'data')} title={backend.mode === 'server' ? `World in PostgreSQL · revision ${backend.rev}` : backend.reason ?? 'World in this browser'} className={`hidden items-center gap-1 rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-wider md:inline-flex ${backend.mode === 'server' ? 'border-success/40 text-success' : 'border-warn/40 text-warn'} ${backend.busy ? 'animate-pulse' : ''}`}>
            {backend.mode === 'server' ? <Database size={10} /> : <HardDrive size={10} />} {backend.mode === 'server' ? 'PostgreSQL' : 'local'}
          </button></div>}
        user={<div className="relative z-[60]"><UserBadge name={persona.name} role={persona.role} initials={persona.initials} onClick={() => setPersonaOpen((o) => !o)} />
          {personaOpen ? <PersonaMenu currentId={persona.id} onSelect={id => { setPersona(id); setPersonaOpen(false); }} onDismiss={() => setPersonaOpen(false)} /> : null}</div>} />}
      contextNav={<ContextNav items={items} value={section} chrome={chrome} />}>
      <MainPanel>
        {backend.notice ? <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"><span className="flex-1">{backend.notice}</span><button type="button" onClick={clearNotice} aria-label="Dismiss"><X size={12} /></button></div> : null}
        <Screen />
      </MainPanel>
    </AppShell>
  );
}

function Screen() {
  const { section } = useApp();
  switch (section) {
    case 'overview': return <OverviewScreen />;
    case 'inbox': return <InboxScreen />;
    case 'l2c': return <L2CScreen />;
    case 'documents': return <DocumentsScreen />;
    case 'close': return <CloseScreen />;
    case 'agents': return <AgentsScreen />;
    case 'settings': return <SettingsScreen />;
    default: return <OverviewScreen />;
  }
}

export default function App() { return <AppState><Shell /></AppState>; }
