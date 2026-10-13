/**
 * Inbox — "What is waiting on me?" Every item ends in a decision, named, with
 * the authority making it.
 */
import { useEffect, useMemo, useState } from 'react';
import { PageContainer, PageMasthead } from '@cognirise/atelier/layout';
import { DecisionBar, DemoReference, InboxFilters, InboxItem, InboxLayout, InboxList, InboxReader, InboxTabs, ReaderSection, ProvenanceChip } from '@cognirise/atelier/archetypes';
import { useApp } from '../app/state';
import { Body, AgentMark, Btn, Chip, EventStatusChip, KV, Money, PostingPreview, Trail } from '../app/bits';
import { bankRec, clientOf, eventStatus, inboxItems, invoiceOf, lineOf, payrollRun, payrollSummary, poConsumption, vatForPeriod, type InboxItemModel } from '@mizan/domain/derive';
import { date, money, pct } from '@mizan/domain/format';
import { ERP_LABEL, invoiceCall, journalCall, receiptCall } from '@mizan/domain/erp';
import type { DunningStage } from '@mizan/domain/types';

export function InboxScreen() {
  const { world, persona, focus, setFocus, actions, settings } = useApp();
  const all = useMemo(() => inboxItems(world), [world]);
  const mine = useMemo(() => all.filter((i) => persona.id === 'noura' || i.roles.includes(persona.id)).filter((i) => !persona.clients.length || !i.clientId || persona.clients.includes(i.clientId)), [all, persona]);
  const waiting = useMemo(() => all.filter((i) => !mine.includes(i)).filter((i) => !persona.clients.length || !i.clientId || persona.clients.includes(i.clientId)), [all, mine, persona]);
  const [tab, setTab] = useState<'mine' | 'waiting' | 'all'>('mine');
  const [agent, setAgent] = useState<string>('all');
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { if (focus) { setSel(focus); setTab(mine.some((i) => i.id === focus) ? 'mine' : waiting.some((i) => i.id === focus) ? 'waiting' : 'all'); setFocus(null); } }, [focus, mine, waiting, setFocus]);
  const list = (tab === 'mine' ? mine : tab === 'waiting' ? waiting : [...mine, ...waiting]).filter((i) => agent === 'all' || i.agentId === agent);
  const selected = list.find((i) => i.id === sel) ?? [...mine, ...waiting].find((i) => i.id === sel) ?? null;
  useEffect(() => { if (sel && !all.some((i) => i.id === sel)) setSel(null); }, [all, sel]);
  const agents = Array.from(new Set(all.map((i) => i.agentId)));

  return (
    <>
      <PageMasthead title="Inbox" meta={`${mine.length} decisions for ${persona.name} · ${waiting.length} waiting on others · ${all.length} open across Mizan`} />

      <Body>
        <div>
        <InboxLayout
          tabs={<InboxTabs value={tab} onChange={(id) => setTab(id as typeof tab)} items={[{ id: 'mine', label: 'Needs my decision', count: mine.length, tone: 'attention' }, { id: 'waiting', label: 'Waiting on others', count: waiting.length }, { id: 'all', label: 'All open', count: all.length }]} />}
          filters={
            <InboxFilters>
              <select value={agent} onChange={(e) => setAgent(e.target.value)} className="rounded-md border border-border/70 bg-card/60 px-2 py-1 text-xs">
                <option value="all">All agents</option>
                {agents.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </InboxFilters>
          }
          list={
            <InboxList label={tab === 'mine' ? 'Your decisions' : tab === 'waiting' ? 'Waiting on others' : 'All open'} count={list.length} emptyState={<p className="p-4 text-xs text-muted-foreground">Nothing here. Switch persona or run a scenario from Settings to see the inbox fill.</p>}>
              {list.map((i) => (
                <InboxItem key={i.id} selected={sel === i.id} onSelect={() => setSel(i.id)} unread={i.attention}
                  thumbnail={<AgentMark id={i.agentId} size={28} showName={false} />}
                  reference={<DemoReference>{i.reference}</DemoReference>}
                  state={<Chip tone={i.attention ? 'warn' : 'muted'}>{i.type.replace(/_/g, ' ')}</Chip>}
                  title={i.title}
                  preview={i.preview}
                  meta={<span className="font-mono tabular-nums">{i.amount ? money(i.amount, i.currency ?? 'SAR', { compact: true }) : ''}{i.clientId ? ` · ${clientOf(world, i.clientId).short}` : ''}</span>} />
              ))}
            </InboxList>
          }
          reader={selected ? <Reader item={selected} canAct={mine.includes(selected)} /> : <InboxReader empty={<div className="p-6 text-sm text-muted-foreground">Select an item. Each one ends in a decision — the agent prepared it, you make it.</div>} />}
        />
      </div>
      </Body>
    </>
  );
}

function Reader({ item, canAct }: { item: InboxItemModel; canAct: boolean }) {
  const { world, actions, settings, go } = useApp();
  const [reason, setReason] = useState('');
  const [stage, setStage] = useState<DunningStage | ''>('');
  const [vatNo, setVatNo] = useState('300455000000003');
  const client = item.clientId ? clientOf(world, item.clientId) : null;
  const trail = world.trail.filter((t) => t.recordRef === item.recordRef || t.recordRef === item.reference);
  const erp = ERP_LABEL[settings.erp];

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-2"><DemoReference>{item.reference}</DemoReference><Chip tone="primary">{item.type.replace(/_/g, ' ')}</Chip><ProvenanceChip kind="synthetic" /></div>
        <h2 className="text-base font-semibold leading-tight">{item.title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">Prepared by <AgentMark id={item.agentId} size={18} /> · authority: {item.authority}{client ? ` · ${client.name}` : ''}</p>
      </div>
      {item.amount ? <div className="text-end"><div className="font-mono text-lg tabular-nums">{money(item.amount, item.currency ?? 'SAR')}</div></div> : null}
    </div>
  );

  let body: React.ReactNode = null;
  let bar: React.ReactNode = null;
  const notMine = !canAct ? <p className="text-xs text-warn">This decision belongs to the {item.authority}. Switch persona to take it.</p> : null;

  switch (item.type) {
    case 'release_invoice': {
      const inv = invoiceOf(world, item.recordRef)!; const ev = world.events.find((e) => e.id === inv.eventIds[0])!; const line = lineOf(world, ev.lineId);
      const call = invoiceCall(settings.erp, inv, client!, inv.poId);
      body = (<>
        <ReaderSection label="Invoice"><KV rows={[['Client', client!.name], ['PO', <DemoReference>{inv.poId}</DemoReference>], ['Line', line.activity], ['Billing event', ev.label], ['Net', money(inv.net, inv.currency)], ['VAT 15%', money(inv.vat, inv.currency)], ['Gross', money(inv.gross, inv.currency)], ['Due', `${date(inv.dueDate)} (${client!.paymentTermsDays} days)`], ['Buyer VAT no.', client!.vatNo ?? <span className="text-danger">missing — ZATCA will reject</span>]]} /></ReaderSection>
        <ReaderSection label="Evidence">{ev.evidence.map((v) => <div key={v.label} className="text-xs">✓ {v.label} <span className="text-muted-foreground">· {v.source} · {date(v.date)}</span></div>)}{ev.coc !== 'not_required' ? <div className="text-xs">CoC: {ev.coc}</div> : null}</ReaderSection>
        <ReaderSection label={`Posting preview — ${erp}`}><PostingPreview call={call} erp={settings.erp} /></ReaderSection>
      </>);
      bar = (<DecisionBar prompt={item.decision}>{notMine}<Btn tone="ghost" onClick={() => actions.rejectDraft(inv.id, reason || 'returned to Fatoora')} disabled={!canAct}>Reject draft</Btn><Btn tone="primary" onClick={() => actions.releaseInvoice(inv.id)} disabled={!canAct}>Release to {settings.erp === 'oracle' ? 'Oracle AR' : 'Odoo'}</Btn></DecisionBar>);
      break;
    }
    case 'draft_catchup': {
      const ev = world.events.find((e) => e.id === item.recordRef)!; const line = lineOf(world, ev.lineId);
      body = (<>
        <ReaderSection label="What Hares found"><p className="text-sm leading-snug">{item.preview}</p></ReaderSection>
        <ReaderSection label="Billing event"><KV rows={[['PO', <DemoReference>{ev.poId}</DemoReference>], ['Line', line.activity], ['Period', ev.period], ['Due', date(ev.dueDate)], ['Expected', money(ev.expectedAmount, ev.currency)], ['Status', <EventStatusChip status={eventStatus(world, ev)} />], ['CoC', ev.coc]]} /></ReaderSection>
        <ReaderSection label="Evidence">{ev.evidence.map((v) => <div key={v.label} className="text-xs">✓ {v.label} <span className="text-muted-foreground">· {v.source} · {date(v.date)}</span></div>)}</ReaderSection>
      </>);
      bar = (<DecisionBar prompt={item.decision}>{notMine}<Btn tone="primary" disabled={!canAct} onClick={() => { void actions.draftForEvent(ev.id).then((id) => { if (id) go('inbox', `rel:${id}`); }); }}>Draft catch-up invoice</Btn></DecisionBar>);
      break;
    }
    case 'approve_coc': case 'escalate_coc': {
      const ev = world.events.find((e) => e.id === item.recordRef)!; const line = lineOf(world, ev.lineId);
      body = (<>
        <ReaderSection label="Why it is blocked"><p className="text-sm leading-snug">{ev.note ?? 'The contract requires a certificate of completion before this event can be invoiced.'}</p></ReaderSection>
        <ReaderSection label="Billing event"><KV rows={[['PO', <DemoReference>{ev.poId}</DemoReference>], ['Line', line.activity], ['Expected', money(ev.expectedAmount, ev.currency)], ['CoC status', ev.coc], ['CoC sent', ev.cocSentOn ? date(ev.cocSentOn) : '—'], ['Reminder cadence', settings.cocReminderDays.map((d) => `+${d}`).join(', ') + ' working days']]} /></ReaderSection>
        <ReaderSection label="Evidence pack attached">{ev.evidence.map((v) => <div key={v.label} className="text-xs">✓ {v.label} <span className="text-muted-foreground">· {v.source} · {date(v.date)}</span></div>)}</ReaderSection>
        <ReaderSection label={item.type === 'approve_coc' ? 'Draft request' : 'Draft escalation'}><div className="whitespace-pre-wrap rounded-md border border-border/50 bg-card/40 px-3 py-2 text-xs leading-relaxed">{item.type === 'approve_coc' ? `To: ${client!.short} Finance / PMO\nSubject: Certificate of completion — ${ev.label}\n\nPlease find attached the delivery evidence for ${ev.label} under ${ev.poId}. We would be grateful for the signed certificate so that invoicing can proceed per the agreement.` : `To: ${client!.short} Programme Sponsor\nCc: ${client!.kam} (Tasama KAM)\nSubject: Escalation — certificate of completion outstanding for ${ev.label}\n\nThe UAT exit report was accepted in your PMIS on ${ev.evidence[0]?.date ?? ''}. The certificate request of ${ev.cocSentOn ? date(ev.cocSentOn) : ''} and two reminders have not been answered. Without it, SAR ${ev.expectedAmount.toLocaleString('en-US')} cannot be invoiced and the programme's September position is understated on both sides. May we have the signed certificate, or the reason it is withheld, by Thursday?`}</div></ReaderSection>
      </>);
      bar = (<DecisionBar prompt={item.decision}>{notMine}<Btn tone="ghost" disabled={!canAct} onClick={() => actions.signCoc(ev.id)}>Record CoC as signed (received outside Mizan)</Btn><Btn tone="primary" disabled={!canAct} onClick={() => (item.type === 'approve_coc' ? actions.sendCoc(ev.id) : actions.escalateCoc(ev.id))}>{item.type === 'approve_coc' ? 'Approve and send' : 'Approve escalation'}</Btn></DecisionBar>);
      break;
    }
    case 'approve_dunning': {
      const dn = world.dunning.find((d) => d.id === item.recordRef)!; const inv = invoiceOf(world, dn.invoiceId)!;
      const days = Math.round((Date.parse(world.asOf) - Date.parse(inv.dueDate)) / 86_400_000);
      body = (<>
        <ReaderSection label="Invoice"><KV rows={[['Invoice', <DemoReference>{inv.id}</DemoReference>], ['Gross', money(inv.gross, inv.currency)], ['Due', date(inv.dueDate)], ['Days overdue', days], ['Channel', client!.channel], ['Current stage', dn.stage], ['Proposed', dn.proposedStage]]} /></ReaderSection>
        <ReaderSection label="Draft notice"><div className="whitespace-pre-wrap rounded-md border border-border/50 bg-card/40 px-3 py-2 text-xs leading-relaxed">{dn.draft}</div></ReaderSection>
        <ReaderSection label="Change the stage (override — give the reason)">
          <div className="flex flex-wrap gap-2">
            <select value={stage} onChange={(e) => setStage(e.target.value as DunningStage)} className="rounded-md border border-border/70 bg-card/60 px-2 py-1 text-xs"><option value="">Keep {dn.proposedStage}</option>{(['reminder', 'second', 'formal', 'escalated'] as DunningStage[]).map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for changing or holding" className="min-w-[14rem] flex-1 rounded-md border border-border/70 bg-card/60 px-2 py-1 text-xs" />
          </div>
        </ReaderSection>
      </>);
      bar = (<DecisionBar prompt={item.decision}>{notMine}<Btn tone="ghost" disabled={!canAct || !reason} onClick={() => actions.holdDunning(dn.id, reason)}>Hold (promise to pay)</Btn><Btn tone="primary" disabled={!canAct || (Boolean(stage) && stage !== dn.proposedStage && !reason)} onClick={() => actions.approveDunning(dn.id, (stage || undefined) as DunningStage | undefined, reason || undefined)}>Send {stage || dn.proposedStage} notice</Btn></DecisionBar>);
      break;
    }
    case 'apply_cash': {
      const r = world.receipts.find((x) => x.id === item.recordRef)!; const bl = world.bankLines.find((b) => b.id === r.bankLineId)!;
      const invs = r.invoiceIds.map((id) => invoiceOf(world, id)!);
      const call = receiptCall(settings.erp, { clientCode: client?.code ?? '', amount: r.amount, currency: 'SAR', date: bl.date, invoiceIds: r.invoiceIds, bankAccount: bl.accountId });
      body = (<>
        <ReaderSection label="Bank line"><KV rows={[['Account', `${world.bankAccounts.find((a) => a.id === bl.accountId)!.bank} — ${world.bankAccounts.find((a) => a.id === bl.accountId)!.label}`], ['Date', date(bl.date)], ['Raw description', <span className="font-mono text-[11px]">{bl.rawDescription}</span>], ['Amount', money(bl.amount)], ['Source', bl.source]]} /></ReaderSection>
        <ReaderSection label={`Proposed application — ${r.method.replace('_', ' + ')} · confidence ${pct(r.confidence)}`}>
          {invs.map((i) => <div key={i.id} className="flex justify-between text-xs"><span><DemoReference>{i.id}</DemoReference> {i.description}</span><Money v={i.gross} /></div>)}
          <div className="mt-1 flex justify-between border-t border-border/40 pt-1 text-xs"><span>Invoices total</span><Money v={invs.reduce((s, i) => s + i.gross, 0)} /></div>
          {r.shortfall ? <div className="flex justify-between text-xs text-warn"><span>Shortfall → bank charges (tolerance SAR {settings.cashTolerance})</span><Money v={r.shortfall} /></div> : null}
          <p className="mt-2 text-xs text-muted-foreground">{r.note}</p>
        </ReaderSection>
        <ReaderSection label={`Posting preview — ${erp}`}><PostingPreview call={call} erp={settings.erp} /></ReaderSection>
      </>);
      bar = (<DecisionBar prompt={item.decision}>{notMine}<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason if rejecting" className="rounded-md border border-border/70 bg-card/60 px-2 py-1 text-xs" /><Btn tone="ghost" disabled={!canAct || !reason} onClick={() => actions.rejectReceipt(r.id, reason)}>Reject match</Btn><Btn tone="primary" disabled={!canAct} onClick={() => actions.applyReceipt(r.id)}>Apply receipt</Btn></DecisionBar>);
      break;
    }
    case 'approve_vendor': case 'resolve_vendor': {
      const v = world.vendorInvoices.find((x) => x.id === item.recordRef)!; const po = world.vendorPOs.find((p) => p.id === v.vendorPOId);
      const line = v.clientPOLineId ? lineOf(world, v.clientPOLineId) : null;
      body = (<>
        <ReaderSection label="Vendor invoice (from CogniDocs)"><KV rows={[['Vendor', v.vendorName], ['Reference', v.invoiceRef], ['Issued / due', `${date(v.issueDate)} / ${date(v.dueDate)}`], ['Net / VAT / total', `${money(v.net)} / ${money(v.vat)} / ${money(v.total)}`], ['Source', v.source + (v.cognidocsJobId ? ` · job ${v.cognidocsJobId}` : '')]]} />
          <div className="mt-2 space-y-1">{v.lineItems.map((l, i) => <div key={i} className="flex justify-between text-xs"><span>{l.description}</span><Money v={l.amount} /></div>)}</div></ReaderSection>
        <ReaderSection label="Three-way match"><KV rows={[['Vendor PO', po ? `${po.id} — ${po.vendor} · ${money(po.value)} · open ${money(po.value - po.consumed)}` : <span className="text-danger">none found</span>], ['Client PO line', line ? `${line.poId} · ${line.activity}` : '—'], ['Delivery evidence', po ? 'Milestone / service month confirmed in PPM' : '—'], ['Mawrid\'s note', v.matchNote ?? '']]} /></ReaderSection>
      </>);
      bar = (<DecisionBar prompt={item.decision}>{notMine}<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason if rejecting" className="rounded-md border border-border/70 bg-card/60 px-2 py-1 text-xs" /><Btn tone="danger" disabled={!canAct || !reason} onClick={() => actions.rejectVendor(v.id, reason)}>Reject</Btn>{v.matchStatus === 'proposed' ? <Btn tone="primary" disabled={!canAct} onClick={() => actions.approveVendor(v.id)}>Approve match, post to AP</Btn> : <Btn tone="ghost" disabled>Awaiting vendor PO from Procurement</Btn>}</DecisionBar>);
      break;
    }
    case 'approve_journal': {
      const j = world.journals.find((x) => x.id === item.recordRef)!; const call = journalCall(settings.erp, j);
      body = (<>
        <ReaderSection label="Journal"><p className="text-sm leading-snug">{j.description}</p>
          <table className="mt-2 w-full text-xs"><thead><tr className="text-start font-mono text-[10px] uppercase text-muted-foreground"><th className="text-start font-normal">Account</th><th className="text-end font-normal">Dr</th><th className="text-end font-normal">Cr</th></tr></thead><tbody>{j.lines.map((l, i) => <tr key={i} className="border-t border-border/30"><td className="py-1">{l.account}</td><td className="py-1 text-end font-mono tabular-nums">{l.dr ? money(l.dr).replace('SAR ', '') : ''}</td><td className="py-1 text-end font-mono tabular-nums">{l.cr ? money(l.cr).replace('SAR ', '') : ''}</td></tr>)}</tbody></table>
          {j.kind === 'Unbilled revenue accrual' ? <p className="mt-2 text-[11px] text-muted-foreground">Amounts are computed at the moment of approval from the delivered-not-invoiced events, so the accrual reflects whatever has been invoiced since the proposal.</p> : null}</ReaderSection>
        <ReaderSection label={`Posting preview — ${erp}`}><PostingPreview call={call} erp={settings.erp} /></ReaderSection>
      </>);
      bar = (<DecisionBar prompt={item.decision}>{notMine}<Btn tone="primary" disabled={!canAct} onClick={() => actions.approveJournal(j.id)}>Approve and post</Btn></DecisionBar>);
      break;
    }
    case 'sign_bank_rec': {
      const rec = bankRec(world, item.recordRef);
      body = (<>
        <ReaderSection label="Reconciliation"><KV rows={[['Statement balance', money(rec.statementBalance, rec.account.currency)], ['Ledger balance', money(rec.ledgerBalance, rec.account.currency)], ['Difference', money(rec.difference, rec.account.currency)], ['Matched lines', rec.matchedCount], ['Open statement lines', rec.unmatchedStatement.length], ['Open ledger entries', rec.unmatchedLedger.length], ['Explained', rec.explained ? 'Yes — difference equals the open items' : 'No']]} /></ReaderSection>
        <ReaderSection label="Open items">{rec.unmatchedStatement.map((b) => <div key={b.id} className="flex justify-between text-xs"><span>Statement · {date(b.date)} · {b.description}</span><Money v={b.amount} currency={rec.account.currency} /></div>)}{rec.unmatchedLedger.map((l) => <div key={l.id} className="flex justify-between text-xs"><span>Ledger · {date(l.date)} · {l.description} <span className="text-muted-foreground">(timing)</span></span><Money v={l.amount} currency={rec.account.currency} /></div>)}{rec.unmatchedStatement.length + rec.unmatchedLedger.length === 0 ? <p className="text-xs text-muted-foreground">None.</p> : null}</ReaderSection>
      </>);
      bar = (<DecisionBar prompt={item.decision}>{notMine}<Btn tone="ghost" onClick={() => go('close', undefined, 'bank')}>Open the reconciliation</Btn><Btn tone="primary" disabled={!canAct || !rec.explained} onClick={() => actions.signOffBankRec(rec.account.id)}>Sign off September</Btn></DecisionBar>);
      break;
    }
    case 'fix_zatca': {
      const inv = invoiceOf(world, item.recordRef)!;
      body = (<>
        <ReaderSection label="Rejection"><p className="text-sm leading-snug text-danger">{inv.zatcaReason}</p><p className="mt-2 text-xs text-muted-foreground">A standard (B2B) tax invoice is cleared by ZATCA before it is valid; the stamped XML is what the buyer may pay against. Until the buyer VAT number is on the customer master, every invoice to this client will be rejected.</p></ReaderSection>
        <ReaderSection label="Fix"><label className="text-xs text-muted-foreground">Buyer VAT registration number (15 digits, starts and ends with 3)</label><input value={vatNo} onChange={(e) => setVatNo(e.target.value)} className="mt-1 w-full rounded-md border border-border/70 bg-card/60 px-2 py-1 font-mono text-xs" /></ReaderSection>
      </>);
      bar = (<DecisionBar prompt={item.decision}>{notMine}<Btn tone="primary" disabled={!canAct || !/^3\d{13}3$/.test(vatNo)} onClick={() => actions.fixZatca(inv.id, vatNo)}>Update master and re-submit</Btn></DecisionBar>);
      break;
    }
    case 'acknowledge_finding': {
      const f = world.findings.find((x) => x.id === item.recordRef)!;
      const po = f.kind === 'PO over-consumed' ? poConsumption(world, f.recordRef) : null;
      body = (<>
        <ReaderSection label="Finding"><p className="text-sm leading-snug">{f.detail}</p></ReaderSection>
        {po ? <ReaderSection label="PO consumption"><KV rows={[['PO value', money(po.value)], ['Invoiced', money(po.invoiced)], ['Unbilled', money(po.unbilled)], ['Remaining schedule', money(po.remainingTerm)], ['Uncovered', <span className="text-danger">{money(po.uncovered)}</span>], ['Consumed', pct(po.pct, 1)]]} /></ReaderSection> : null}
      </>);
      bar = (<DecisionBar prompt={item.decision}>{notMine}<Btn tone="ghost" onClick={() => go('l2c', f.clientId, 'clients')}>Open the account</Btn><Btn tone="primary" disabled={!canAct} onClick={() => actions.acknowledgeFinding(f.id)}>Acknowledge</Btn></DecisionBar>);
      break;
    }
    case 'confirm_schedule': {
      const po = world.pos.find((p) => p.id === item.recordRef)!;
      body = (<ReaderSection label="Lines and flags">{po.lines.map((l) => <div key={l.id} className="border-b border-border/30 py-1.5 text-xs last:border-0"><div>{l.activity}</div>{l.matchFlags.map((m) => <div key={m} className="text-warn">⚠ {m}</div>)}</div>)}</ReaderSection>);
      bar = (<DecisionBar prompt={item.decision}>{notMine}<Btn tone="primary" disabled={!canAct} onClick={() => actions.confirmSchedule(po.id)}>Confirm schedule</Btn></DecisionBar>);
      break;
    }
    case 'receive_payroll': case 'approve_payroll': {
      const ps = payrollSummary(world)!; const run = ps.run; const prior = payrollRun(world, '2026-08');
      const input = world.inputs.find((i) => i.procedure === 2);
      body = (<>
        <ReaderSection label="Tasama's procedure 2"><p className="text-sm leading-snug">{item.preview}</p><KV rows={[['Source', run.source], ['Paid', `${date(run.paidOn)} · WPS`], ['Register due', `${date(run.dueOn)} (3 WD after pay-out)`], ['Received', run.receivedOn ? date(run.receivedOn) : <span className="text-danger">not yet — {ps.late} WD late</span>], ['Reminders by Iqfal', input?.reminders.map(date).join(', ') || '—'], ['HR says', input?.note ?? '—']]} /></ReaderSection>
        {run.proof ? <ReaderSection label="Rawatib's proof"><KV rows={[['Net pay = WPS payment', run.proof.bankTies ? '✓ ties' : '✗ does not tie'], ['Net pay = GL clearing', run.proof.glTies ? '✓ ties' : '✗ does not tie'], ['Headcount', run.proof.headcountTies ? `✓ ${prior?.headcount ?? '—'} + ${run.joiners} − ${run.leavers} = ${run.headcount}` : '✗ does not tie'], ['Gross / net', `${money(run.grossPay)} / ${money(run.netPay)}`], ['Employer cost', money(run.employerCost)], ['GOSI payable', `${money(ps.gosiTotal)} · due ${date(run.gosiDueOn)}`]]} /><p className="mt-2 text-xs text-muted-foreground">{run.proof.note}</p></ReaderSection> : <ReaderSection label="What happens when it lands"><p className="text-xs leading-snug text-muted-foreground">Rawatib reads totals by cost centre, proves net pay against the WPS batch on the SNB statement and the GL, checks the headcount against August, and proposes the payroll and provisions journals. No employee record enters Mizan.</p></ReaderSection>}
        {ps.journals.length ? <ReaderSection label="Journals proposed">{ps.journals.map((j) => <div key={j.id} className="flex justify-between text-xs"><span><DemoReference>{j.id}</DemoReference> {j.kind} · {j.status}</span><Money v={j.lines.reduce((x, l) => x + l.dr, 0)} /></div>)}</ReaderSection> : null}
      </>);
      bar = (<DecisionBar prompt={item.decision}>{notMine}<Btn tone="ghost" onClick={() => go('close', undefined, 'payroll')}>Open payroll</Btn>{item.type === 'receive_payroll' ? <Btn tone="primary" disabled={!canAct} onClick={() => actions.receivePayrollRegister()}>Read the register from HR</Btn> : <Btn tone="primary" disabled={!canAct || !(run.proof?.bankTies && run.proof.glTies && run.proof.headcountTies)} onClick={() => actions.approvePayroll(run.id)}>Sign the proof</Btn>}</DecisionBar>);
      break;
    }
    case 'prepare_vat': case 'approve_vat': {
      const v = vatForPeriod(world); const f = v.figures;
      body = (<>
        <ReaderSection label={`Return — ${v.ret?.period} · due ${v.ret ? date(v.ret.filingDueOn) : ''}`}><KV rows={[['Standard-rated sales', `${money(f.standardRatedSales)} → output VAT ${money(f.outputVat)} (${f.salesCount} invoices)`], ['Standard-rated purchases', `${money(f.standardRatedPurchases)} → input VAT ${money(f.inputVat)} (${f.purchaseCount})`], ['Not claimable yet', f.deferredInputVat ? `${money(f.deferredInputVat)} — ${f.deferredNote}` : 'none'], ['Excluded', f.excluded.length ? f.excluded.map((x) => `${x.ref}: ${x.reason}`).join('; ') : 'none'], ['Net payable to ZATCA', <span className="font-mono text-base tabular-nums">{money(f.netPayable)}</span>]]} /></ReaderSection>
        {v.rejected.length ? <ReaderSection label="Blocked"><p className="text-sm text-danger">{v.rejected.length} invoice(s) in the period rejected by ZATCA — not valid tax invoices until re-submitted: {v.rejected.map((i) => i.id).join(', ')}.</p></ReaderSection> : null}
      </>);
      bar = (<DecisionBar prompt={item.decision}>{notMine}<Btn tone="ghost" onClick={() => go('close', undefined, 'vat')}>Open the return</Btn>{item.type === 'prepare_vat' ? <Btn tone="primary" disabled={!canAct || !v.canPrepare} onClick={() => actions.prepareVatReturn()}>Prepare the return</Btn> : <Btn tone="primary" disabled={!canAct} onClick={() => v.ret && actions.approveVatReturn(v.ret.id)}>Approve for filing</Btn>}</DecisionBar>);
      break;
    }
    case 'record_po_cover': {
      const ev = world.events.find((e) => e.id === item.recordRef)!; const line = lineOf(world, ev.lineId); const po = world.pos.find((p) => p.id === ev.poId)!;
      const opp = world.opportunities.find((o) => o.clientId === ev.clientId && o.stage === 'Verbal award');
      body = (<>
        <ReaderSection label="Delivery without an instrument"><p className="text-sm leading-snug">{ev.note}</p><KV rows={[['PO', <DemoReference>{po.id}</DemoReference>], ['PO term', `${date(po.start)} – ${date(po.end)} · ${po.status}`], ['Line', line.activity], ['Delivered', `${ev.label} · ${money(ev.expectedAmount, ev.currency)}`], ['Status', <EventStatusChip status={eventStatus(world, ev)} />], ['Verbal award', opp ? `${opp.name} — ${opp.owner}, ${pct(opp.probability)} in the pipeline` : '—']]} /></ReaderSection>
        <ReaderSection label="What recording the extension does"><p className="text-xs leading-snug text-muted-foreground">Aqd reads the amendment from Sirion, extends the PO term, re-expands the schedule, and the September event becomes due for Fatoora to draft. Mizaniya's "expired PO cover" driver shrinks by the recognised amount. Until the client issues the instrument, the money cannot be recognised or billed — Mizan does not pretend otherwise.</p></ReaderSection>
      </>);
      bar = (<DecisionBar prompt={item.decision}>{notMine}<Btn tone="primary" disabled={!canAct} onClick={() => actions.recordPoCover(ev.id, `${po.id}-A1`, '2027-03-31')}>Record PO extension {po.id}-A1 (to 31 Mar 2027)</Btn></DecisionBar>);
      break;
    }
    case 'read_erp_jobs': {
      const jobs = world.erpJobs.filter((j) => j.period === world.closingPeriod);
      body = (<ReaderSection label="Fixed Assets and Leases — ERP jobs">{jobs.map((j) => <div key={j.id} className="flex items-start justify-between gap-2 border-b border-border/30 py-1.5 text-xs last:border-0"><div><div>P{j.procedure} · {j.name}</div><div className="text-[11px] text-muted-foreground">{j.summary}</div></div><Chip tone={j.status === 'completed' ? 'success' : j.status === 'errors' ? 'danger' : 'muted'}>{j.status.replace('_', ' ')}</Chip></div>)}<p className="mt-2 text-[11px] text-muted-foreground">Mizan does not run these; it reads the job results and the sub-ledger tie back so the checklist shows them as what they are.</p></ReaderSection>);
      bar = (<DecisionBar prompt={item.decision}>{notMine}<Btn tone="primary" disabled={!canAct} onClick={() => actions.readBackErpJobs()}>Read back from the ERP</Btn></DecisionBar>);
      break;
    }
    default:
      body = <ReaderSection label="Detail"><p className="text-sm">{item.preview}</p></ReaderSection>;
  }

  return (
    <InboxReader header={header} actions={bar}>
      {body}
      <ReaderSection label="Decision trail"><Trail entries={trail} /></ReaderSection>
    </InboxReader>
  );
}
