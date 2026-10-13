/**
 * Documents — the CogniDocs surface. Upload → parse job → canonical envelope →
 * routed to the right agent. Simulated by default; Live through the proxy.
 */
import { useRef, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, Plug, XCircle } from 'lucide-react';
import { PageColumns, PageContainer, PageMasthead, PageSection, Panel, StatRow, StatTile } from '@cognirise/atelier/layout';
import { DemoBanner, DemoReference, OutputCard, ProvenanceChip, ProvenanceNote } from '@cognirise/atelier/archetypes';
import { useApp } from '../app/state';
import { Body, Btn, Chip, KV, Table } from '../app/bits';
import { SAMPLE_DOCS, emulateCompletion, emulateJob, type SampleDoc } from '@mizan/domain/cognidocs';
import { liveBase, pollLive, submitLive } from '../lib/cognidocs-live';
import { date, dateTime, from10k, money } from '@mizan/domain/format';
import type { DeclaredType, ParseJob } from '@mizan/domain/types';

const TYPES: { id: DeclaredType; label: string }[] = [{ id: 'auto', label: 'Auto-detect' }, { id: 'invoice', label: 'Invoice' }, { id: 'receipt', label: 'Receipt' }, { id: 'bank_statement', label: 'Bank statement' }, { id: 'credit_card_statement', label: 'Card statement' }];

export function DocumentsScreen() {
  const { world, settings, actions, go, apiKey, backend } = useApp();
  const [declared, setDeclared] = useState<DeclaredType>('auto');
  const [sel, setSel] = useState<string | null>(world.jobs[0]?.id ?? null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cfg = settings.cognidocs;
  const job = world.jobs.find((j) => j.id === sel) ?? world.jobs[0] ?? null;

  /** Simulated: the emulator produces the job and its envelope; the status transitions are real actions on the shared world. */
  const runSimulated = (file: { name: string; size: number; type: string }, sample: SampleDoc | null) => {
    const j = emulateJob(file, declared === 'auto' ? (sample?.declaredType ?? 'auto') : declared, sample, cfg.sandbox);
    void actions.addJob(j); setSel(j.id);
    window.setTimeout(() => { void actions.updateJob({ ...j, status: 'processing', startedAt: new Date().toISOString() }); }, 900);
    window.setTimeout(() => { const done = emulateCompletion({ ...j, status: 'processing', startedAt: new Date().toISOString() }, sample); void actions.updateJob(done).then(() => { if (done.status === 'completed') return actions.routeJob(done); }); }, 2600);
  };

  const onFile = async (file: File) => {
    setErr(null);
    const sample = SAMPLE_DOCS.find((s) => s.fileName.toLowerCase() === file.name.toLowerCase()) ?? null;
    if (cfg.mode === 'simulated') { runSimulated(file, sample); return; }
    try {
      const live = { baseUrl: liveBase(cfg, backend.served), apiKey, sandbox: cfg.sandbox };
      if (!live.baseUrl) throw new Error('Live mode needs a CogniDocs base URL (Settings → CogniDocs) when the app is not served by the Mizan server.');
      const j = await submitLive(live, file, declared);
      await actions.addJob(j); setSel(j.id);
      const done = await pollLive(live, j.id, (u) => { void actions.updateJob(u); });
      await actions.updateJob(done);
      if (done.status === 'completed') await actions.routeJob(done);
    } catch (e) { setErr((e as Error).message); }
  };

  const completed = world.jobs.filter((j) => j.status === 'completed');
  return (
    <>
      <PageMasthead title="Documents" meta={`${world.jobs.length} parse jobs this session · ${completed.length} completed · CogniDocs ${cfg.mode === 'live' ? `live (${cfg.sandbox ? 'sandbox' : 'production'} key)` : 'simulated'}`}
        figures={<><Chip tone={cfg.mode === 'live' ? 'success' : 'warn'}><Plug size={10} /> {cfg.mode === 'live' ? 'Live' : 'Simulated'}</Chip><Chip>POST /documents → GET /jobs/{'{id}'}</Chip><Chip>money = integer ×10,000</Chip></>}
        actions={<Btn tone="ghost" small onClick={() => go('settings', undefined, 'cognidocs')}>Connection settings</Btn>} />

      <Body>
        <div><DemoBanner kind={cfg.mode === 'live' ? 'verified' : 'simulated'}>{cfg.mode === 'live' ? 'Live mode: results below come from the CogniDocs deployment configured in Settings.' : 'Simulated mode: the built-in emulator returns the canonical CogniDocs envelope for the sample documents, with real status transitions. Switch to Live in Settings to parse your own PDFs.'}</DemoBanner></div>

      <PageSection label="Upload">
        <PageColumns aside={
          <Panel icon={<FileUp size={16} />} title="Send a document">
            <div className="mb-2 flex flex-wrap gap-1.5">{TYPES.map((t) => <button key={t.id} type="button" onClick={() => setDeclared(t.id)} className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ${declared === t.id ? 'border-primary/50 bg-primary/12 text-primary' : 'border-border/60 text-muted-foreground'}`}>{t.label}</button>)}</div>
            <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void onFile(f); }} onClick={() => fileRef.current?.click()} className="cursor-pointer rounded-lg border border-dashed border-border/70 p-5 text-center text-xs text-muted-foreground hover:border-primary/60 hover:text-foreground">
              Drop a PDF, PNG, JPEG or CSV here (≤ 20 MB), or click to choose.<br /><span className="text-[10px]">declaredType = {declared}</span>
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} />
            {err ? <p className="mt-2 rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger">{err}</p> : null}
            <ProvenanceNote>{cfg.mode === 'simulated' ? 'In simulated mode a file that is not one of the samples fails with an explicit message — the browser cannot read a PDF, and the emulator does not invent a result.' : 'Protected PDFs return 422 and are not retried; a 403 LEGAL_ACCEPTANCE_REQUIRED means a person must accept the terms in the CogniDocs console first.'}</ProvenanceNote>
          </Panel>
        }>
          <Panel title="Sample documents" action={<span className="text-[11px] text-muted-foreground">synthetic PDFs shipped with the demo</span>}>
            <div className="grid gap-2 sm:grid-cols-2">
              {SAMPLE_DOCS.map((s) => (
                <div key={s.id} className="rounded-lg glass-l3 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2"><Chip tone="primary">{s.declaredType.replace('_', ' ')}</Chip><span className="font-mono text-[10px] text-muted-foreground">{s.fileName}</span></div>
                  <div className="text-sm font-medium leading-tight">{s.label}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">→ {s.routeHint}</p>
                  <div className="mt-2 flex gap-2"><Btn small tone="primary" onClick={() => { if (cfg.mode === 'simulated') runSimulated({ name: s.fileName, size: 48_211 + s.id.length * 1000, type: 'application/pdf' }, s); else window.open(`samples/${s.fileName}`, '_blank'); }}>{cfg.mode === 'simulated' ? 'Send to CogniDocs' : 'Open PDF'}</Btn><a href={`samples/${s.fileName}`} download className="inline-flex items-center rounded-lg border border-border/70 bg-card/50 px-2.5 py-1 text-[11px] hover:bg-card/80">Download</a></div>
                </div>
              ))}
            </div>
          </Panel>
        </PageColumns>
      </PageSection>

      <PageSection label="Parse jobs">
        <PageColumns aside={job ? <JobDetail job={job} /> : <Panel title="Result">Select a job.</Panel>}>
          <Panel title={`${world.jobs.length} jobs`} action={<span className="text-[11px] text-muted-foreground">GET /jobs?limit=100, newest first</span>}>
            {world.jobs.length === 0 ? <p className="text-xs text-muted-foreground">No jobs yet. Send a sample document, or run the "Cash day" or "Duplicate vendor invoice" scenario.</p> : (
              <Table head={['Job', 'File', 'Declared / detected', 'Status', 'Parser', 'Confidence', 'AI cost', 'Routed to']} rows={world.jobs.map((j) => [
                <button type="button" className="text-start hover:underline" onClick={() => setSel(j.id)}><DemoReference>{j.id}</DemoReference><div className="text-[10px] text-muted-foreground">{dateTime(j.createdAt)} · {j.mode}{j.sandbox ? ' · sandbox' : ''}</div></button>,
                <span className="font-mono text-[11px]">{j.fileName}</span>, <span className="text-[11px]">{j.declaredType} / {j.detectedType ?? '—'}</span>,
                <Chip tone={j.status === 'completed' ? 'success' : j.status === 'failed' ? 'danger' : 'primary'}>{j.status === 'processing' || j.status === 'queued' ? <Loader2 size={10} className="animate-spin" /> : j.status === 'completed' ? <CheckCircle2 size={10} /> : <XCircle size={10} />} {j.status}</Chip>,
                <span className="font-mono text-[11px]">{j.parserPath ?? '—'}</span>, <span className="font-mono tabular-nums">{j.confidence ?? '—'}</span>, <span className="font-mono tabular-nums text-[11px]">{j.aiCostAmount10k !== null ? `$${from10k(j.aiCostAmount10k).toFixed(4)}` : '—'}</span>,
                <span className="text-[11px]">{j.routedTo ?? (j.status === 'failed' ? <span className="text-danger">{j.error}</span> : '—')}</span>,
              ])} />
            )}
          </Panel>
        </PageColumns>
      </PageSection>

      {world.expenses.length ? <PageSection label="Rebillable expenses (from receipts)"><PageContainer><div className="grid gap-2 sm:grid-cols-3">{world.expenses.map((x) => <OutputCard key={x.id} title={x.description} format="Expense" destination={`Re-bill to ${world.clients.find((c) => c.id === x.clientId)?.short} on the next T&L invoice`} provenance={<ProvenanceChip kind="simulated" />} meta={money(x.amount)} />)}</div></PageContainer></PageSection> : null}
      </Body>
    </>
  );
}

function JobDetail({ job }: { job: ParseJob }) {
  const r = job.result;
  return (
    <Panel title={<span className="flex items-center gap-2">Job <DemoReference>{job.id}</DemoReference></span>} action={<Chip tone={job.mode === 'live' ? 'success' : 'warn'}>{job.mode}</Chip>}>
      <KV rows={[['Status', job.status], ['File', `${job.fileName} · ${job.mimeType ?? '—'} · ${job.fileSizeBytes ? `${(job.fileSizeBytes / 1024).toFixed(0)} KB` : '—'}`], ['Created / started / completed', `${dateTime(job.createdAt)} / ${job.startedAt ? dateTime(job.startedAt) : '—'} / ${job.completedAt ? dateTime(job.completedAt) : '—'}`], ['Parser path', job.parserPath ?? '—'], ['Confidence', job.confidence ?? '—'], ['AI tokens / cost', job.aiPromptTokens !== null ? `${job.aiPromptTokens} + ${job.aiCompletionTokens} · $${from10k(job.aiCostAmount10k ?? 0).toFixed(4)}` : '—'], ['Sandbox', job.sandbox ? 'yes' : 'no']]} />
      {job.error ? <p className="mt-2 rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger">{job.error}</p> : null}
      {r?.invoice ? (
        <div className="mt-3 space-y-2 text-xs">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">result.invoice — {r.documentType} · {r.invoice.detailTier}</div>
          <KV rows={[['Vendor', `${r.invoice.vendorName} (${r.invoice.vendorKey})`], ['Reference', `${r.invoice.invoiceRef} → ${r.invoice.normalizedInvoiceRef}`], ['Issue / due', `${r.invoice.issueDate ?? '—'} / ${r.invoice.dueDate ?? '—'}`], ['Subtotal / tax / total', `${from10k(r.invoice.subtotalAmount10k).toLocaleString('en-US')} / ${from10k(r.invoice.taxAmount10k).toLocaleString('en-US')} / ${from10k(r.invoice.totalAmount10k).toLocaleString('en-US')} ${r.invoice.currency}`], ['Reconciliation', r.invoice.reconciliation ? (r.invoice.reconciliation.matchesTotal ? 'line items match total' : <span className="text-warn">delta {r.invoice.reconciliation.delta10k} (×10k) — flagged, not corrected</span>) : '—'], ['Fields missing', r.invoice.fieldsMissing.length ? r.invoice.fieldsMissing.join(', ') : 'none'], ['Banking details', r.invoice.bankingDetails?.iban ?? '—'], ['Payment method', r.invoice.paymentMethod ?? '—']]} />
          <Table head={['#', 'Description', 'Qty', 'Unit', 'Amount', 'Tax']} rows={r.invoice.lineItems.map((l) => [l.lineNumber, <span className="text-[11px]">{l.description}{l.periodStart ? <span className="text-muted-foreground"> · {date(l.periodStart)} – {date(l.periodEnd!)}</span> : null}</span>, from10k(l.quantity10k), from10k(l.unitPriceAmount10k).toLocaleString('en-US'), from10k(l.amount10k).toLocaleString('en-US'), from10k(l.taxAmount10k).toLocaleString('en-US')])} />
          <ProvenanceNote>Values shown ÷ 10,000 for display. The envelope keeps integers; nothing is rounded before matching.</ProvenanceNote>
        </div>
      ) : null}
      {r?.statement ? (
        <div className="mt-3 space-y-2 text-xs">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">result.statement — {r.statement.statementType}</div>
          <KV rows={[['Bank', `${r.statement.bankName} (id ${r.statement.bankId})`], ['Account', r.statement.accountRef ?? '—'], ['Period', `${r.statement.periodStart} → ${r.statement.periodEnd}`], ['Template', `${r.statement.templateId}${r.statement.templateGenerated ? ' (generated — review)' : ''}`], ['Transactions', r.statement.transactions.length]]} />
          <Table head={['Date', 'Description', 'Direction', 'Amount', 'Type', 'Category']} rows={r.statement.transactions.map((t) => [<span className="text-[11px]">{t.date}</span>, <span className="text-[11px]">{t.description}<div className="font-mono text-[10px] text-muted-foreground">{t.rawDescription}</div></span>, <Chip tone={t.direction === 'credit' ? 'success' : 'muted'}>{t.direction}</Chip>, <span className="font-mono tabular-nums">{from10k(t.amount10k).toLocaleString('en-US')}</span>, t.type, t.effectiveCategory])} />
          <ProvenanceNote>Direction is read from <code>direction</code>, never inferred from the sign — the guide's rule for statements and card statements alike.</ProvenanceNote>
        </div>
      ) : null}
      {job.routedTo ? <p className="mt-3 rounded-md border border-primary/30 bg-primary/8 p-2 text-xs">Routed: {job.routedTo}</p> : null}
    </Panel>
  );
}

export { StatRow, StatTile };
