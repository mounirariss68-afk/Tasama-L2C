/**
 * Agents — who is on the team, what they may do, how the work actually runs,
 * and the decision trail.
 */
import { useEffect, useMemo, useState } from 'react';
import { Bot, GitBranch, History } from 'lucide-react';
import { PageColumns, PageContainer, PageMasthead, PageSection, Panel } from '@cognirise/atelier/layout';
import { AgentAutonomyChip, AgentCard, AgentDirectory, AgentProfile, ProvenanceNote, WorkflowCard, WorkflowCatalog, WorkflowStep, WorkflowWalkthrough } from '@cognirise/atelier/archetypes';
import { useApp } from '../app/state';
import { Body, AgentMark, Chip, Tabs, Trail } from '../app/bits';
import { AGENTS, ASSISTANT, avatarFor, type AgentDef } from '@mizan/domain/agents';
import { WORKFLOWS } from '@mizan/domain/workflows';
import { STAGES } from '@mizan/domain/process';
import { bankRec, cashStats, inboxItems, unbilled } from '@mizan/domain/derive';
import { money, pct } from '@mizan/domain/format';

export function AgentsScreen() {
  const { world } = useApp();
  return (
    <>
      <PageMasthead title="Agents" meta={`${AGENTS.length} agents · ${WORKFLOWS.length} workflows · ${world.trail.length} trail entries`} figures={<><Chip tone="muted">A0 observe → A4 autonomous</Chip><Chip tone="primary">labelled at the rung they run at</Chip></>} />

      <Body>
        <Tabs storageKey="agents" tabs={[{ id: 'team', label: 'Team', body: () => <Team /> }, { id: 'workflows', label: 'Workflows', body: () => <Workflows /> }, { id: 'trail', label: 'Decision trail', body: () => <TrailTab /> }]} />
      </Body>
    </>
  );
}

function statsFor(a: AgentDef, world: ReturnType<typeof useApp>['world']) {
  const inbox = inboxItems(world);
  const mine = inbox.filter((i) => i.agentId === a.id);
  const trail = world.trail.filter((t) => t.actor.kind === 'agent' && t.actor.id === a.id);
  switch (a.id) {
    case 'fatoora': return [{ label: 'Invoices this month', value: String(world.invoices.filter((i) => i.date >= '2026-10-01').length) }, { label: 'Awaiting release', value: String(world.invoices.filter((i) => i.status === 'draft').length) }, { label: 'ZATCA first-pass', value: pct(world.invoices.filter((i) => i.zatca === 'cleared').length / Math.max(1, world.invoices.filter((i) => i.zatca !== 'draft').length)) }, { label: 'Rejected open', value: String(world.invoices.filter((i) => i.zatca === 'rejected').length) }];
    case 'hares': return [{ label: 'Findings open', value: String(world.findings.filter((f) => !f.acknowledged).length) }, { label: 'Leakage found', value: money(world.findings.reduce((s, f) => s + f.amount, 0), 'SAR', { compact: true }) }, { label: 'Recovered / resolved', value: money(world.findings.filter((f) => f.acknowledged).reduce((s, f) => s + f.amount, 0), 'SAR', { compact: true }) }, { label: 'Unbilled now', value: money(unbilled(world), 'SAR', { compact: true }) }];
    case 'tasweya': { const c = cashStats(world); const recs = world.bankAccounts.map((b) => bankRec(world, b.id)); return [{ label: 'Receipts applied', value: String(c.applied) }, { label: 'Auto-match rate', value: pct(c.autoRate) }, { label: 'Proposed / unapplied', value: `${c.proposed.length} / ${c.unapplied.length}` }, { label: 'Accounts explained', value: `${recs.filter((r) => r.explained).length} / ${recs.length}` }]; }
    case 'tahseel': return [{ label: 'Notices proposed', value: String(world.dunning.filter((d) => d.status === 'proposed').length) }, { label: 'Sent', value: String(world.dunning.filter((d) => d.status === 'sent').length) }, { label: 'Held (promise)', value: String(world.dunning.filter((d) => d.status === 'held').length) }, { label: 'Overrides kept', value: String(world.trail.filter((t) => t.kind === 'overridden' && t.recordRef?.startsWith('DEMO-DN')).length) }];
    case 'mawrid': return [{ label: 'Vendor invoices', value: String(world.vendorInvoices.length) }, { label: 'Matched', value: String(world.vendorInvoices.filter((v) => v.matchStatus === 'matched').length) }, { label: 'Refused (dup / no PO)', value: String(world.vendorInvoices.filter((v) => ['no_po', 'duplicate', 'rejected'].includes(v.matchStatus)).length) }, { label: 'Cost allocated', value: money(world.vendorInvoices.filter((v) => v.matchStatus === 'matched').reduce((s, v) => s + v.net, 0), 'SAR', { compact: true }) }];
    case 'iqfal': return [{ label: 'Close day', value: `${world.closeDay} / 10` }, { label: 'Journals proposed', value: String(world.journals.filter((j) => j.status === 'proposed').length) }, { label: 'Journals posted', value: String(world.journals.filter((j) => j.status === 'posted').length) }, { label: 'Items derived', value: String(world.closeItems.filter((c) => c.derivedFrom).length) }];
    case 'shahid': return [{ label: 'CoC open', value: String(world.events.filter((e) => ['to_send', 'sent', 'reminded', 'escalated'].includes(e.coc)).length) }, { label: 'Reminders sent', value: String(trail.filter((t) => t.summary.includes('reminder')).length) }, { label: 'Escalations', value: String(trail.filter((t) => t.kind === 'escalated').length) }, { label: 'Blocked value', value: money(world.events.filter((e) => ['sent', 'reminded', 'escalated'].includes(e.coc) && !e.invoiceId).reduce((s, e) => s + e.expectedAmount, 0), 'SAR', { compact: true }) }];
    case 'aqd': return [{ label: 'POs scheduled', value: String(world.pos.length) }, { label: 'Billing events', value: String(world.events.length) }, { label: 'Mismatch flags', value: String(world.pos.flatMap((p) => p.lines.flatMap((l) => l.matchFlags)).length) }, { label: 'Schedules to confirm', value: String(world.pos.filter((p) => !p.scheduleConfirmed).length) }];
    case 'mizaniya': return [{ label: 'Drivers explained', value: String(world.drivers.length) }, { label: 'Explained value', value: money(world.drivers.reduce((s, d) => s + Math.abs(d.amount), 0), 'SAR', { compact: true }) }, { label: 'Pipeline items', value: String(world.pipeline.length) }, { label: 'Reforecast', value: world.flags.reforecastAccepted ? 'accepted' : 'proposed' }];
  }
  return [{ label: 'Open items', value: String(mine.length) }];
}

function Team() {
  const { world } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const a = AGENTS.find((x) => x.id === open);
  const inbox = useMemo(() => inboxItems(world), [world]);
  return (
    <>
      <PageSection label="The team">
        <Panel icon={<Bot size={16} />} title={`${AGENTS.length} agents and one assistant`}>
          <AgentDirectory>
            {AGENTS.map((x) => <AgentCard key={x.id} agent={{ id: x.id, name: `${x.name} · ${x.arabic}`, role: x.role, purpose: x.purpose, avatar: avatarFor(x), autonomy: x.autonomy, activity: inbox.some((i) => i.agentId === x.id) ? 'waiting' : 'idle' }} onOpen={() => setOpen(x.id)} footer={<span className="text-[11px] text-muted-foreground">{inbox.filter((i) => i.agentId === x.id).length} item(s) waiting on a person</span>} />)}
            <AgentCard agent={{ id: ASSISTANT.id, name: `${ASSISTANT.name} · ${ASSISTANT.arabic}`, role: ASSISTANT.role, purpose: ASSISTANT.purpose, avatar: avatarFor(ASSISTANT), autonomy: 'assisted' }} footer={<span className="text-[11px] text-muted-foreground">Powered by Claude. Reads current data and prepares actions; a person confirms changes. Specialist workflows and external connectors remain simulated.</span>} />
          </AgentDirectory>
        </Panel>
      </PageSection>
      {a ? (
        <PageSection label={`${a.name} — profile`}>
          <PageColumns aside={<Panel title="Autonomy, as built"><p className="text-xs leading-snug">{a.autonomyNote}</p><div className="mt-3 flex flex-wrap gap-1.5">{(['observe', 'recommend', 'assisted', 'supervised', 'autonomous'] as const).map((l) => <AgentAutonomyChip key={l} level={l} className={l === a.autonomy ? '' : 'opacity-40'} />)}</div><ProvenanceNote>The ladder is also the agenda for the conversation about where Tasama is willing to move each agent.</ProvenanceNote><div className="mt-3"><div className="eyebrow mb-1">Recent activity</div><Trail entries={world.trail.filter((t) => t.actor.kind === 'agent' && t.actor.id === a.id)} limit={5} /></div></Panel>}>
            <Panel title={`${a.name} · ${a.arabic}`}>
              <AgentProfile agent={{ id: a.id, name: a.name, role: a.role, avatar: avatarFor(a), autonomy: a.autonomy }} functions={a.functions} superpower={a.superpower} impact={a.impact} stats={statsFor(a, world)} onClose={() => setOpen(null)} />
            </Panel>
          </PageColumns>
        </PageSection>
      ) : null}
    </>
  );
}

function Workflows() {
  const { focus, go } = useApp();
  const [open, setOpen] = useState<string | null>(focus && WORKFLOWS.some((w) => w.id === focus) ? focus : null);
  useEffect(() => { if (focus && WORKFLOWS.some((w) => w.id === focus)) setOpen(focus); }, [focus]);
  const wf = WORKFLOWS.find((w) => w.id === open);
  const stage = wf ? STAGES.find((s) => s.id === wf.stage) : undefined;
  return (
    <>
      {STAGES.map((st) => {
        const list = WORKFLOWS.filter((w) => w.stage === st.id);
        if (!list.length) return null;
        return (
          <PageSection key={st.id} label={`Stage ${st.index} — ${st.name}`} action={<button type="button" className="text-[11px] text-muted-foreground hover:text-foreground" onClick={() => go('l2c', undefined, 'process')}>See the stage in the process view →</button>}>
            <Panel icon={<GitBranch size={16} />} title={`${list.length} workflow${list.length === 1 ? '' : 's'}`} action={<span className="text-[11px] text-muted-foreground">{list.filter((w) => w.coverage === 'implemented').length} implemented · {list.filter((w) => w.coverage === 'partial').length} partial</span>}>
              <WorkflowCatalog>
                {list.map((w) => <WorkflowCard key={w.id} name={`${w.id.toUpperCase()} · ${w.name}`} purpose={w.purpose} trigger={w.trigger} outcome={w.outcome} coverage={w.coverage} autonomy={<AgentAutonomyChip level={w.autonomy} />} agents={<span className="flex gap-1">{w.agents.map((id) => <AgentMark key={id} id={id} size={20} showName={false} />)}</span>} stepCount={w.steps.length} onOpen={() => setOpen(w.id)} />)}
              </WorkflowCatalog>
            </Panel>
          </PageSection>
        );
      })}
      {wf ? (
        <PageSection label={`${wf.name} — walkthrough`} action={<button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setOpen(null)}>Close</button>}>
          <Panel title={`${wf.id.toUpperCase()} · ${wf.name}`} action={<span className="flex items-center gap-2">{stage ? <Chip tone="primary">Stage {stage.index} · {stage.name}</Chip> : null}<Chip tone="muted">{wf.steps.length} steps</Chip></span>}>
            <WorkflowWalkthrough>
              {wf.steps.map((s, i) => <WorkflowStep key={i} index={i + 1} title={s.title} actor={s.actor} detail={s.detail} inputs={s.inputs} outputs={s.outputs} decision={s.decision} autonomy={s.autonomy ? <AgentAutonomyChip level={s.autonomy} /> : undefined} coverage={s.coverage} />)}
            </WorkflowWalkthrough>
          </Panel>
        </PageSection>
      ) : null}
    </>
  );
}

function TrailTab() {
  const { world } = useApp();
  const [who, setWho] = useState('all');
  const [kind, setKind] = useState('all');
  const entries = world.trail.filter((t) => (who === 'all' || (t.actor.kind === 'agent' ? t.actor.id === who : who === 'people')) && (kind === 'all' || t.kind === kind));
  return (
    <PageSection label="Who did what, at what authority, and what a person changed">
      <Panel icon={<History size={16} />} title={`${entries.length} entries`} action={<span className="flex gap-2"><select value={who} onChange={(e) => setWho(e.target.value)} className="rounded-md border border-border/70 bg-card/60 px-2 py-1 text-xs"><option value="all">Everyone</option><option value="people">People</option>{AGENTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select><select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-md border border-border/70 bg-card/60 px-2 py-1 text-xs"><option value="all">All kinds</option>{['observed', 'proposed', 'acted', 'approved', 'rejected', 'overridden', 'escalated'].map((k) => <option key={k} value={k}>{k}</option>)}</select></span>}>
        <Trail entries={entries} />
        <ProvenanceNote>Overrides are the most valuable rows: the evidence a person is still in charge, and in a real deployment the training data.</ProvenanceNote>
      </Panel>
    </PageSection>
  );
}
