import { useEffect, useRef, useState } from 'react';
import { ChatAssistantTurn, ChatComposer, ChatRail, ChatSuggestions, ChatUserTurn, RailBrandCard, BrandLogo, useChatRail } from '@cognirise/atelier/layout';
import { AgentAvatar } from '@cognirise/atelier/archetypes';
import { ASSISTANT, avatarFor } from '@mizan/domain/agents';
import { useApp } from './state';

type Proposal = { token: string; summary: string; action: { type: string; [key: string]: unknown }; state?: 'applied' | 'cancelled' | 'failed'; result?: string };
type Turn = { role: 'user' | 'assistant'; content: string; proposals?: Proposal[]; error?: boolean };
const SUGGESTIONS = ['What is unbilled?', 'Can we close September?', 'Which invoices are overdue?', 'Explain the budget variance', 'Is the bank reconciled?', 'Run the billing run'];

/** The proposal card says what Muhasib will do in words — never the reducer action as JSON. */
const ACTION_WORDS: Record<string, string> = {
  releaseInvoice: 'Release invoice', rejectDraft: 'Reject draft', draftForEvent: 'Draft an invoice for', runBillingRun: 'Run the billing run',
  fixZatca: 'Correct the VAT number on', sendCoc: 'Send the certificate of completion for', escalateCoc: 'Escalate the certificate of completion for', signCoc: 'Record the signed certificate for',
  approveDunning: 'Approve the reminder for', holdDunning: 'Hold the reminder for', applyReceipt: 'Apply receipt', rejectReceipt: 'Reject receipt',
  approveVendor: 'Approve vendor invoice', rejectVendor: 'Reject vendor invoice', approveJournal: 'Approve and post journal', signOffBankRec: 'Sign off the bank reconciliation for',
  acknowledgeFinding: 'Acknowledge finding', confirmSchedule: 'Confirm the delivery schedule for', acceptReforecast: 'Accept the reforecast', completeCloseItem: 'Record procedure complete:', closePeriod: 'Close the period',
};
const REF_KEYS = ['id', 'eventId', 'invoiceId', 'accountId', 'poId'];
function describeAction(a: Proposal['action']): string {
  const verb = ACTION_WORDS[a.type] ?? a.type;
  const ref = REF_KEYS.map((k) => a[k]).find((v) => typeof v === 'string') as string | undefined;
  const extras = Object.entries(a).filter(([k, v]) => k !== 'type' && !REF_KEYS.includes(k) && v !== undefined && v !== null && typeof v !== 'object').map(([k, v]) => `${k} ${String(v)}`);
  return [verb, ref, extras.length ? `· ${extras.join(' · ')}` : ''].filter(Boolean).join(' ');
}

async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'The assistant could not respond.');
  return result as T;
}

export function ClaudeChatRail({ rail }: { rail: ReturnType<typeof useChatRail> }) {
  const { persona, clientLens, backend, confirmAssistantAction, section, focus } = useApp();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'checking' | 'ready' | 'live' | 'error'>('checking');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const generation = useRef(0);
  const host = { id: ASSISTANT.id, name: ASSISTANT.name, role: ASSISTANT.role, avatar: avatarFor(ASSISTANT) };

  useEffect(() => {
    generation.current++;
    controller.current?.abort(); locked.current = false;
    setTurns([]); setDraft(''); setBusy(false); setConfirming(null); setStatus('checking');
    const abort = new AbortController();
    if (backend.mode !== 'server') { setStatus('error'); return () => { abort.abort(); controller.current?.abort(); }; }
    request<{ configured: boolean }>('/api/assistant/status', undefined, abort.signal)
      .then(result => setStatus(result.configured ? 'ready' : 'error'))
      .catch(() => { if (!abort.signal.aborted) setStatus('error'); });
    return () => { abort.abort(); controller.current?.abort(); };
  }, [persona.id, backend.mode]);

  async function ask(question: string) {
    if (!question.trim() || locked.current || confirming) return;
    if (backend.mode !== 'server') {
      setTurns(t => [...t, { role: 'assistant', content: 'Muhasib needs the connected PostgreSQL server. The app is currently in browser-only mode.', error: true }]);
      setStatus('error'); return;
    }
    const userTurn: Turn = { role: 'user', content: question.trim().slice(0, 6000) };
    let history = [...turns.filter(t => !t.error).map(({ role, content }) => ({ role, content: content.slice(0, 6000) })), userTurn].slice(-12);
    if (history[0]?.role === 'assistant') history = history.slice(1);
    const currentGeneration = generation.current;
    locked.current = true; setBusy(true); setDraft('');
    const abort = new AbortController(); controller.current = abort;
    setTurns(t => [...t, userTurn]);
    try {
      const result = await request<{ text: string; proposals: Proposal[] }>('/api/assistant/chat', { messages: history, personaId: persona.id, clientId: clientLens, section, focus }, abort.signal);
      if (generation.current !== currentGeneration) return;
      setStatus('live');
      setTurns(t => [...t, { role: 'assistant', content: result.text, proposals: result.proposals }]);
    } catch (e) {
      if (abort.signal.aborted || generation.current !== currentGeneration) return;
      setStatus('error');
      setTurns(t => [...t, { role: 'assistant', content: (e as Error).message, error: true }]);
    } finally {
      if (generation.current === currentGeneration) { locked.current = false; setBusy(false); }
    }
  }

  function updateProposal(token: string, update: Partial<Proposal>) {
    setTurns(t => t.map(turn => ({ ...turn, proposals: turn.proposals?.map(p => p.token === token ? { ...p, ...update } : p) })));
  }
  async function confirm(proposal: Proposal) {
    if (locked.current || confirming) return;
    locked.current = true; setConfirming(proposal.token);
    const currentGeneration = generation.current;
    try {
      const result = await confirmAssistantAction(proposal.token);
      if (generation.current !== currentGeneration) return;
      updateProposal(proposal.token, { state: 'applied', result: `Applied to the shared demo.${result.created ? ` Created ${result.created}.` : ''}${result.count !== undefined ? ` ${result.count} invoice(s) drafted.` : ''}` });
      setTurns(t => [...t, { role: 'assistant', content: `Confirmed and applied: ${proposal.summary}.${result.created ? ` Created ${result.created}.` : ''}${result.count !== undefined ? ` ${result.count} invoice(s) drafted.` : ''} The screens now show the updated data.` }]);
    } catch (e) {
      if (generation.current === currentGeneration) updateProposal(proposal.token, { state: 'failed', result: (e as Error).message });
    } finally {
      if (generation.current === currentGeneration) { locked.current = false; setConfirming(null); }
    }
  }

  return <ChatRail rail={rail}
    brand={<RailBrandCard onCollapse={() => rail.setOpen(false)}><BrandLogo on="light" alt="TASAMA Business Services" className="h-7 w-auto" /></RailBrandCard>}
    collapsedBrand={<img src="/brand/mark.png" alt="" className="h-7 w-7 rounded-md" />}
    transcript={<>
      <div className="mb-3 flex items-center gap-2.5 px-1">
        <AgentAvatar agent={host} size={34} showActivity={busy} />
        <div className="min-w-0 flex-1"><div className="truncate text-sm text-foreground">{host.name} · {ASSISTANT.arabic}</div><div className="truncate text-[11px] text-muted-foreground">{section === 'close' ? 'The September close' : 'Your finance assistant'}</div></div>
      </div>
      {status === 'error' && !turns.length && <p role="status" className="px-3 py-2 text-xs text-warn">Muhasib is currently unavailable. Please try again.</p>}
      {!turns.length && <ChatAssistantTurn avatar={<AgentAvatar agent={host} size={24} showActivity={false} />}>
        <p>Ask me to review billing, invoices, cash, budgets or close blockers. I read the current app data and can prepare supported actions for your confirmation.</p>
        <p className="mt-2 text-muted-foreground">You are {persona.name}, {persona.role}. Records are synthetic; ERP, bank and email operations remain simulated. Confirmed actions update the shared demo.</p>
      </ChatAssistantTurn>}
      {turns.map((turn, index) => turn.role === 'user'
        ? <ChatUserTurn key={index}>{turn.content}</ChatUserTurn>
        : <ChatAssistantTurn key={index} avatar={<AgentAvatar agent={host} size={24} showActivity={false} />}>
          <div className={`whitespace-pre-wrap break-words ${turn.error ? 'text-warn' : ''}`}>{turn.content}</div>
          {turn.proposals?.map(proposal => <div key={proposal.token} className="mt-3 rounded-lg border border-border bg-card/50 p-3">
            <p className="text-xs font-medium">Confirm demo action</p>
            <p className="mt-1 text-xs">{proposal.summary}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">Action · {describeAction(proposal.action)}</p>
            {proposal.state ? <p className="mt-2 text-xs">{proposal.result ?? 'Cancelled. Nothing changed.'}</p> : <div className="mt-2 flex gap-2">
              <button type="button" disabled={busy || Boolean(confirming)} onClick={() => void confirm(proposal)} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">{confirming === proposal.token ? 'Applying…' : 'Confirm action'}</button>
              <button type="button" disabled={Boolean(confirming)} onClick={() => updateProposal(proposal.token, { state: 'cancelled' })} className="rounded border border-border px-3 py-1.5 text-xs">Cancel</button>
            </div>}
          </div>)}
        </ChatAssistantTurn>)}
      {busy && <p role="status" className="px-3 py-2 text-xs text-muted-foreground">Muhasib is processing your request…</p>}
    </>}
    suggestions={<ChatSuggestions items={section === 'close' ? ['What blocks the September close?', 'Which of the 24 procedures are open?', 'Are the departmental inputs in?', 'Which journals are waiting for approval?', 'Is the bank reconciled?'] : SUGGESTIONS} onSelect={q => void ask(q)} />}
    composer={<ChatComposer value={draft} onChange={setDraft} onSend={() => void ask(draft)} placeholder={busy ? 'Muhasib is processing your request…' : 'Ask Muhasib about billing, cash, the close…'} />}
  />;
}
