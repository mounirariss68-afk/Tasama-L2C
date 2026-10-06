import type { World } from './types';
import type { CloseCommand, CloseInstance, ClosePaper } from './close-types';
import { PERSONAS } from './personas';
import { procedureByNumber, CLOSE_PROCEDURES } from './close-catalogue';
import { validPeriod, validDate } from './close-calendar';
import { toSAR } from './derive';
import { CLOSE_FINANCE, getCloseInstance, makeCloseInstance, closeOverview, validatePaper, paperFingerprint, closeFingerprint, generatedClosePack } from './close-derive';

type Context = { personaId: string; now: string };
const known = (id: unknown) => typeof id === 'string' && PERSONAS.some(p => p.id === id && p.nav.includes('close'));
const requireReason = (reason: unknown) => typeof reason === 'string' && reason.trim().length >= 5 && reason.length <= 4000;
const record = (instance: CloseInstance, ctx: Context, event: string, reason: string) => instance.history.push({ at: ctx.now, actor: ctx.personaId, event, reason });
function paperRecord(paper: ClosePaper, ctx: Context, event: string, detail: string) {
  paper.history.push({ at: ctx.now, actor: ctx.personaId, event, version: paper.version, detail });
}
function clearReview(paper: ClosePaper) {
  delete paper.reviewedBy; delete paper.acceptedAt; delete paper.reviewedFingerprint;
}
/** Replacing inputs/native evidence invalidates dependent reviews, not just the changed checkbox. */
export function invalidateCloseReviews(world: World, ctx: Context) {
  for (const instance of Object.values(world.closeWorkspace?.periods ?? {})) {
    if (instance.status === 'closed') continue;
    let changed = false;
    for (const procedure of CLOSE_PROCEDURES) {
      const p = instance.papers[String(procedure.number)];
      if (p.state === 'accepted' && p.reviewedFingerprint !== paperFingerprint(world, instance, p)) {
        p.state = 'returned'; p.version++; p.reviewNote = 'Evidence or dependencies changed after review. Re-submit and obtain independent review.';
        clearReview(p); paperRecord(p, ctx, 'review invalidated', p.reviewNote); changed = true;
      }
    }
    if (changed) { instance.version++; record(instance, ctx, 'reviews invalidated', 'Source evidence or a prerequisite changed.'); }
  }
}
function refreshPack(world: World, instance: CloseInstance) {
  if (instance.pack && instance.pack.fingerprint === closeFingerprint(world, instance)) instance.pack.content = generatedClosePack(world, instance);
}
function checkPayload(command: CloseCommand): string | null {
  if (!command || typeof command !== 'object' || !validPeriod(command.period)) return 'Use a valid close period (YYYY-MM).';
  if ('procedure' in command && !procedureByNumber(command.procedure)) return 'Unknown close procedure.';
  if ('expectedVersion' in command && (!Number.isInteger(command.expectedVersion) || command.expectedVersion < 0)) return 'A valid record version is required.';
  return null;
}
/** Called against a cloned world; any error causes the caller to discard the clone. */
export function applyCloseCommand(world: World, command: CloseCommand, ctx: Context): string | null {
  try {
    const invalid = checkPayload(command);
    if (invalid) return invalid;
    if (!known(ctx.personaId)) return 'This persona has no close workspace authority.';
    world.closeWorkspace ??= { version: 1, periods: {} };
    const existed = !!world.closeWorkspace.periods[command.period];
    const instance = world.closeWorkspace.periods[command.period] ?? makeCloseInstance(command.period);
    world.closeWorkspace.periods[command.period] = instance;
    const finance = CLOSE_FINANCE.includes(ctx.personaId), cfo = ctx.personaId === 'noura';
    if (command.kind === 'initialize') {
      if (!existed) record(instance, ctx, 'period initialized', 'Fresh template: no prior-month values, evidence or approvals copied.');
      return null;
    }
    const paper = 'procedure' in command ? instance.papers[String(command.procedure)] : undefined;
    const paperCommands = ['save', 'submit', 'review', 'delegate', 'remind'];
    const version = paper && paperCommands.includes(command.kind) ? paper.version : instance.version;
    if (!('expectedVersion' in command) || command.expectedVersion !== version) return 'This record changed in another session. Refresh the current record and reconcile your saved draft before trying again.';
    if (instance.status === 'closed' && !['reopen', 'requestErpClosure', 'confirmErpClosure'].includes(command.kind)) return 'The local close snapshot is locked. The CFO must reopen it with a reason before any edits.';
    if (command.kind === 'save') {
      const p = paper!;
      if (ctx.personaId !== p.owner && !cfo) return `Only the assigned preparer (${p.owner}) may edit this workpaper.`;
      if (p.state === 'submitted') return 'This submission is awaiting review. The reviewer must return it before the preparer edits it.';
      if (!command.values || typeof command.values !== 'object' || Array.isArray(command.values) || Object.values(command.values).some(v => typeof v !== 'string' || v.length > 12000)) return 'Invalid workpaper fields.';
      const allowedKeys = new Set(procedureByNumber(command.procedure)!.fields.map(f => f.key));
      if (Object.keys(command.values).some(k => !allowedKeys.has(k))) return 'Unsupported workpaper field.';
      if (!Array.isArray(command.receipts) || !Array.isArray(command.statements) || command.receipts.length > 1000 || command.statements.length > 2000) return 'Invalid or oversized workpaper rows.';
      if (command.procedure !== 3 && command.receipts.length) return 'Supplier receipt rows belong only to procedure 3.';
      if (command.procedure !== 22 && command.statements.length) return 'Statement rows belong only to procedure 22.';
      if (command.receipts.some(r => typeof r.id !== 'string' || typeof r.vendor !== 'string' || typeof r.poRef !== 'string' || typeof r.cocRef !== 'string' || typeof r.receivedDate !== 'string' || typeof r.description !== 'string' || !Number.isFinite(r.amount) || !['SAR', 'USD'].includes(r.currency))) return 'Invalid supplier receipt row.';
      if (command.statements.some(r => typeof r.id !== 'string' || typeof r.account !== 'string' || typeof r.commentary !== 'string' || typeof r.correctionRef !== 'string' || !['Trial balance', 'P&L', 'Balance Sheet'].includes(r.kind) || ![r.actual, r.prior, r.budget, r.debit, r.credit].every(Number.isFinite))) return 'Invalid financial statement row.';
      if (new Set(command.receipts.map(r => r.id)).size !== command.receipts.length || new Set(command.statements.map(r => r.id)).size !== command.statements.length) return 'Duplicate workpaper row IDs.';
      paperRecord(p, ctx, 'previous draft snapshot', JSON.stringify({ values: p.values, receipts: p.receipts, statements: p.statements }));
      p.values = structuredClone(command.values); p.receipts = structuredClone(command.receipts); p.statements = structuredClone(command.statements);
      p.state = 'draft'; p.version++; p.preparedBy = ctx.personaId; p.updatedAt = ctx.now; clearReview(p);
      paperRecord(p, ctx, 'draft saved', `Evidence ${p.values.evidenceRef || 'not supplied'}; ${p.values.provenance || 'unspecified'}.`);
    } else if (command.kind === 'submit') {
      const p = paper!;
      if (ctx.personaId !== p.owner && !cfo) return 'Only the assigned preparer may submit this workpaper.';
      if (!['draft', 'returned'].includes(p.state)) return 'This workpaper is already submitted or accepted.';
      const errors = validatePaper(world, instance, p, ctx.now.slice(0, 10));
      if (errors.length) return errors.join(' ');
      if (!p.preparedBy) return 'Save the workpaper before submitting it.';
      p.state = 'submitted'; p.submittedAt = ctx.now; p.version++;
      paperRecord(p, ctx, 'submitted', `Version ${p.version} submitted for independent review.`);
    } else if (command.kind === 'review') {
      const p = paper!;
      if (ctx.personaId !== p.reviewer && !cfo) return `Only ${p.reviewer} or CFO may review this workpaper.`;
      if (p.preparedBy === ctx.personaId) return 'The preparer cannot review their own submission. Assign another reviewer.';
      if (p.state !== 'submitted') return 'Only a submitted workpaper can be reviewed.';
      if (!requireReason(command.reason)) return 'Provide a review conclusion / return reason (at least 5 characters).';
      if (!['accept', 'return'].includes(command.decision)) return 'Invalid review decision.';
      if (command.procedure === 23 && command.decision === 'accept') return 'Procedure 23 requires the CFO sign-off action in Reports after all other close controls are ready.';
      if (command.decision === 'accept') {
        const errors = validatePaper(world, instance, p, ctx.now.slice(0, 10));
        if (errors.length) return `Cannot accept: ${errors.join(' ')}`;
        p.state = 'accepted'; p.reviewedBy = ctx.personaId; p.acceptedAt = ctx.now; p.reviewedFingerprint = paperFingerprint(world, instance, p);
      } else { p.state = 'returned'; clearReview(p); }
      p.reviewNote = command.reason.trim(); p.version++;
      paperRecord(p, ctx, command.decision === 'accept' ? 'accepted' : 'returned', p.reviewNote);
    } else if (command.kind === 'delegate') {
      if (!['noura', 'reem'].includes(ctx.personaId)) return 'Only the CFO or Accounting Manager may delegate close ownership.';
      if (!known(command.owner) || !['noura', 'reem', 'faisal'].includes(command.reviewer) || command.owner === command.reviewer) return 'Choose a known preparer and a different authorized reviewer.';
      if (!requireReason(command.reason)) return 'A delegation reason is required.';
      const p = paper!;
      if (p.state === 'submitted') return 'Return the current submission before reassigning it.';
      p.owner = command.owner; p.reviewer = command.reviewer; p.version++; p.state = 'draft'; clearReview(p);
      paperRecord(p, ctx, 'delegated', `${command.owner} prepares, ${command.reviewer} reviews: ${command.reason}`);
    } else if (command.kind === 'remind') {
      if (!finance && paper!.owner !== ctx.personaId && paper!.reviewer !== ctx.personaId) return 'This workpaper is outside your reminder authority.';
      if (!requireReason(command.note)) return 'Provide a reminder / clarification note (at least 5 characters).';
      const key = `${command.procedure}:${ctx.now.slice(0, 10)}:${command.note.trim().toLowerCase()}`;
      if (instance.reminders.some(r => r.key === key)) return 'This reminder is already recorded today. No duplicate was sent.';
      instance.reminders.push({ key, procedure: command.procedure, at: ctx.now, actor: ctx.personaId, note: command.note.trim() });
      paper!.version++; paperRecord(paper!, ctx, 'in-app reminder / clarification', command.note.trim());
    } else if (command.kind === 'calendar') {
      if (!['noura', 'reem'].includes(ctx.personaId)) return 'Only CFO or Accounting Manager may confirm the close calendar.';
      if (!Array.isArray(command.weekends) || command.weekends.length > 6 || command.weekends.some(d => !Number.isInteger(d) || d < 0 || d > 6) || new Set(command.weekends).size !== command.weekends.length) return 'Select valid weekend days, leaving at least one working day.';
      if (!Array.isArray(command.holidays) || command.holidays.length > 366 || command.holidays.some(d => !validDate(d))) return 'Use valid ISO holiday dates (YYYY-MM-DD).';
      if (!Number.isFinite(command.materiality) || command.materiality <= 0) return 'Materiality must be a positive SAR amount.';
      instance.calendar = { confirmed: command.confirmed === true, weekends: command.weekends, holidays: [...new Set(command.holidays)].sort() };
      instance.materiality = command.materiality;
      record(instance, ctx, 'calendar configured', `Confirmed=${instance.calendar.confirmed}; weekends=${command.weekends}; holidays=${command.holidays}; materiality SAR ${command.materiality}.`);
    } else if (command.kind === 'exception') {
      if (!finance && paper!.owner !== ctx.personaId) return 'This procedure is outside your exception authority.';
      if (!requireReason(command.title) || !Number.isFinite(command.amount) || command.amount < 0 || !['SAR', 'USD'].includes(command.currency) || !['minor', 'material', 'critical'].includes(command.severity)) return 'Provide a valid exception, nonnegative amount, currency and severity.';
      const id = `CX-${instance.period}-${++world.flags.seq}`;
      const severity = command.severity === 'critical' ? 'critical' : toSAR(command.amount, command.currency) >= instance.materiality ? 'material' : command.severity;
      instance.exceptions.push({ id, procedure: command.procedure, title: command.title.trim(), amount: command.amount, currency: command.currency, severity,
        owner: paper!.owner, source: 'manual', nonWaivable: command.severity === 'critical', status: 'open' });
      record(instance, ctx, 'exception opened', `${id}: ${command.title}`);
    } else if (command.kind === 'decideException') {
      const e = instance.exceptions.find(e => e.id === command.id);
      if (!e || e.status !== 'open') return 'No open manual exception matches this ID. Native errors must be fixed in their source workflow.';
      if (!finance || (command.decision === 'waive' && !cfo)) return 'Finance may record resolution; only the CFO may approve an eligible waiver.';
      if (!requireReason(command.reason)) return 'A resolution reference / waiver reason is mandatory.';
      if (!['resolve', 'waive'].includes(command.decision)) return 'Invalid exception decision.';
      if (command.decision === 'waive' && e.nonWaivable) return 'Critical exceptions are non-waivable. Resolve the source error and supply evidence.';
      e.status = command.decision === 'resolve' ? 'resolved' : 'waived'; e.reason = command.reason.trim(); e.decidedBy = ctx.personaId; e.decidedAt = ctx.now;
      record(instance, ctx, `exception ${e.status}`, `${e.id}: ${e.reason}`);
    } else if (command.kind === 'pack') {
      if (!finance) return 'Only Finance may generate the close pack.';
      instance.pack = { generatedAt: ctx.now, generatedBy: ctx.personaId, fingerprint: closeFingerprint(world, instance), content: '' };
      record(instance, ctx, 'pack generated', 'Pack assembled from this period’s current evidence and open blockers.');
      instance.pack.content = generatedClosePack(world, instance);
    } else if (command.kind === 'close') {
      if (!cfo) return 'Only the CFO may sign off the local close snapshot.';
      const overview = closeOverview(world, instance.period, ctx.personaId, ctx.now.slice(0, 10));
      if (!overview.ready) return `Close blocked: ${overview.blockers.join(' ')}`;
      const p = instance.papers['23'];
      const errors = validatePaper(world, instance, p, ctx.now.slice(0, 10));
      if (errors.length || p.state !== 'submitted') return `Submit the final review workpaper first. ${errors.join(' ')}`;
      if (p.preparedBy === ctx.personaId) return 'Final review requires independent CFO sign-off; another preparer must submit procedure 23.';
      p.state = 'accepted'; p.reviewedBy = ctx.personaId; p.acceptedAt = ctx.now; p.reviewNote = 'CFO approved the evidence-backed local demo close snapshot.'; p.version++;
      p.reviewedFingerprint = paperFingerprint(world, instance, p);
      paperRecord(p, ctx, 'CFO local sign-off', p.reviewNote);
      instance.status = 'closed'; instance.closedAt = ctx.now; instance.closedBy = ctx.personaId;
      record(instance, ctx, 'local demo closed', 'Reviewed snapshot locked. This does not close an external ERP accounting period.');
      instance.lockedSnapshot = generatedClosePack(world, instance);
      (instance.snapshots ??= []).push({ closedAt: ctx.now, closedBy: ctx.personaId, fingerprint: closeFingerprint(world, instance), content: instance.lockedSnapshot });
      if (instance.pack) instance.pack.content = instance.lockedSnapshot;
      if (instance.period === world.closingPeriod) world.flags.periodClosed = true;
    } else if (command.kind === 'requestErpClosure') {
      if (!cfo || instance.status !== 'closed') return 'Only CFO may record an ERP closure request after local sign-off.';
      if (instance.erpStatus !== 'Not requested') return 'ERP closure is already requested or externally confirmed.';
      instance.erpStatus = 'Closure requested';
      record(instance, ctx, 'external ERP closure requested', 'In-app request recorded only. No ERP API call or email was sent.');
    } else if (command.kind === 'confirmErpClosure') {
      if (!cfo || instance.status !== 'closed' || instance.erpStatus !== 'Closure requested') return 'CFO must record a closure request after local sign-off before external confirmation.';
      if (!requireReason(command.reference) || !requireReason(command.evidence)) return 'An external ERP closure reference and confirmation evidence are mandatory.';
      instance.erpStatus = 'Externally confirmed'; instance.erpReference = command.reference.trim(); instance.erpEvidence = command.evidence.trim();
      record(instance, ctx, 'external ERP closure confirmed', `${instance.erpReference}; ${instance.erpEvidence}. This is manually recorded external evidence.`);
    } else if (command.kind === 'reopen') {
      if (!cfo || instance.status !== 'closed') return 'Only CFO may reopen a locally closed period.';
      if (!requireReason(command.reason)) return 'A reopening reason is mandatory.';
      record(instance, ctx, 'local snapshot reopened', `${command.reason}. External ERP status ${instance.erpStatus} is unchanged; no external ERP period was reopened.`);
      instance.status = 'open'; delete instance.closedAt; delete instance.closedBy;
      const p = instance.papers['23']; p.state = 'returned'; p.version++; clearReview(p);
      if (instance.period === world.closingPeriod) world.flags.periodClosed = false;
    } else return 'Unsupported close command.';
    instance.version++;
    invalidateCloseReviews(world, ctx);
    refreshPack(world, instance);
    return null;
  } catch (error) { return `Invalid close request: ${error instanceof Error ? error.message : 'unsupported payload'}`; }
}
