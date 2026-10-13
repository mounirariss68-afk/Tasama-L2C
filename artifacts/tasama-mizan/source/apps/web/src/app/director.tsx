/**
 * The Demo Director bar, docked at the bottom of the display: the step's
 * narration, the trigger, what the app did, and what changed, with
 * Back / Step / Play / Stop. The same pattern as QIB Jahiz and Tasama HR:
 * the presenter reads, the agents work, the room watches the screens move.
 */
import { ChevronLeft, ChevronRight, Loader2, Pause, Play, Square, Zap } from 'lucide-react';
import { PERSONAS } from '@mizan/domain/personas';
import { useApp } from './state';
import { Btn, Chip } from './bits';

export function DirectorBar() {
  const { director, stepScenario, stopScenario, setAuto, open, persona, reset } = useApp();
  if (!director) return null;
  const st = director.index >= 0 ? director.steps[director.index] : null;
  const nextStep = director.steps[director.index + 1];
  const who = (id?: string) => PERSONAS.find((p) => p.id === id)?.name.split(' ')[0] ?? id;
  const atStart = director.index < 0;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-6">
      <div className="pointer-events-auto mx-auto max-w-[1400px] rounded-2xl border border-primary/30 bg-background/95 p-3 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex items-center gap-1.5">
            <Btn small onClick={() => void stepScenario(-1)} disabled={director.busy || director.index <= 0}><ChevronLeft size={14} /></Btn>
            <Btn small tone="primary" onClick={() => void stepScenario(1)} disabled={director.busy || director.status === 'done' || (atStart && !!director.error)}>{director.busy ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />} {atStart ? 'Start' : 'Step'}</Btn>
            <Btn small onClick={() => setAuto(!director.auto)} disabled={director.status === 'done' || !!director.error}>{director.auto ? <Pause size={14} /> : <Play size={14} />}</Btn>
            <Btn small onClick={stopScenario}><Square size={14} /></Btn>
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-mono uppercase tracking-wider text-primary">{director.key} · {director.name}</span>
              <span>{atStart ? `${director.steps.length} steps` : `step ${director.index + 1} of ${director.steps.length}`}</span>
              {st?.persona ? <Chip tone="primary">as {who(st.persona)}</Chip> : <Chip tone="muted">as {persona.name.split(' ')[0]}</Chip>}
              {director.status === 'done' ? <Chip tone="success">Scenario complete</Chip> : null}
              {director.auto ? <Chip tone="muted">auto · 11 s per step</Chip> : null}
            </p>
            {atStart ? (
              <>
                <p className="mt-0.5 text-sm font-semibold">{director.error ? 'This scenario cannot start on the current world' : `Ready — first step: ${nextStep?.title}`}</p>
                {director.error
                  ? <p className="mt-0.5 text-[13px] leading-relaxed text-danger">{director.error} <button type="button" className="underline" onClick={() => { void reset().then(() => stopScenario()); }}>Reset the demo now</button></p>
                  : <p className="mt-0.5 text-[13px] leading-relaxed text-foreground/90">{nextStep?.narration}</p>}
              </>
            ) : (
              <>
                <p className="mt-0.5 text-sm font-semibold">{st?.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-foreground/90">{st?.narration}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px]"><Zap size={12} className="text-primary" /><span className="text-muted-foreground">Trigger:</span> <span className="font-medium">{st?.trigger}</span>{director.result ? <><span className="text-muted-foreground">· Result:</span> <span className="font-mono">{director.result}</span></> : null}{director.error ? <span className="text-danger">Error: {director.error}</span> : null}</p>
              </>
            )}
          </div>
          <div className="w-full lg:w-[360px]">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">What changed</p>
            {director.changes.length ? (
              <ul className="mt-1 max-h-28 space-y-0.5 overflow-auto text-[12px]">
                {director.changes.slice(0, 12).map((c) => <li key={c.key}><button type="button" onClick={() => open(c.screen)} className="text-start hover:text-primary">• {c.label}</button></li>)}
                {director.changes.length > 12 ? <li className="text-muted-foreground">… and {director.changes.length - 12} more</li> : null}
              </ul>
            ) : <p className="mt-1 text-[12px] text-muted-foreground">{director.busy ? 'Running the step through the reducer…' : atStart ? 'Press Start. Each step switches the persona and the screen, then shows what it changed.' : st?.action.kind === 'show' ? 'Nothing executed: this step shows what is already there.' : 'Nothing changed.'}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
