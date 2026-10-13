/**
 * Scenarios — the demo's remote control. Six scripts, each a sequence of
 * real actions the Director plays one step at a time, with the narration to
 * read and the screen to watch. Reset restores the seeded world.
 */
import { useState } from 'react';
import { ListChecks, RotateCcw } from 'lucide-react';
import { PageContainer, PageMasthead, PageSection, Panel } from '@cognirise/atelier/layout';
import { ProvenanceNote, ScenarioCard, ScenarioRunner } from '@cognirise/atelier/archetypes';
import { useApp } from '../app/state';
import { Body, Btn, Chip } from '../app/bits';
import { SCENARIOS } from '@mizan/domain/scenarios';
import { PERSONAS } from '@mizan/domain/personas';

export function ScenariosScreen() {
  const { world, director, startScenario, reset, backend } = useApp();
  const [resetting, setResetting] = useState(false);
  const doReset = async () => { setResetting(true); try { await reset(); } finally { setResetting(false); } };
  const who = (id?: string) => PERSONAS.find((p) => p.id === id)?.name.split(' ')[0] ?? id ?? '';
  return (
    <>
      <PageMasthead title="Scenarios" meta={`Six scripts · ${SCENARIOS.reduce((s, x) => s + x.steps.length, 0)} steps · world revision ${world.flags.rev}`}
        figures={<><Chip tone="primary">happy path · exception · escalation · refusal · cash · close</Chip><Chip tone={backend.mode === 'server' ? 'success' : 'warn'}>{backend.mode === 'server' ? 'shared world · PostgreSQL' : 'this browser only'}</Chip></>}
        actions={<Btn tone="ghost" small onClick={() => void doReset()} disabled={resetting}><RotateCcw size={13} /> {resetting ? 'Rebuilding…' : 'Reset the demo'}</Btn>} />

      <Body>
        <PageSection label="Pick a scenario — the Director bar plays it step by step">
        <ScenarioRunner>
          {SCENARIOS.map((s) => {
            const why = s.blocked(world);
            const state = director?.key === s.key ? (director.status === 'done' ? 'complete' : 'running') : why ? 'complete' : 'idle';
            return (
              <ScenarioCard key={s.key} name={`${s.key} · ${s.name}`} premise={<>{s.summary} <span className="text-muted-foreground">— {s.steps.length} steps, as {[...new Set(s.steps.map((x) => who(x.persona)).filter(Boolean))].join(', ')}{why ? '; already run on this world' : ''}</span></>} demonstrates={s.demonstrates} state={state} onRun={() => startScenario(s.key)} />
            );
          })}
        </ScenarioRunner>
      </PageSection>
      <PageSection label="How to run the room">
        <div>
          <Panel icon={<ListChecks size={16} />} title="Order, timing, reset">
            <ol className="list-decimal space-y-1 ps-5 text-xs leading-relaxed">
              <li>Reset the demo before the room fills. The seeded world is 6 October 2026, Day 4 of the September close — every number ties (<span className="font-mono">npm run check:world</span>).</li>
              <li>Run S1 → S6 in order. Each step switches to the persona whose decision it is and opens the screen to watch; the Director bar shows the narration, the trigger and what changed. "Step" advances; "Play" advances every 11 seconds.</li>
              <li>Step back shows the previous screen again without undoing anything — the trail is append-only, like the real thing.</li>
              <li>A scenario that has already run on this world says so and offers the reset. Running them out of order is fine; S2, S3 and S6 do not depend on S1.</li>
              <li>Muhasib answers from the same world at any point: "what is unbilled?", "can we close September?", "why is KSIA blocked?".</li>
            </ol>
            <ProvenanceNote>Scenarios inject nothing: every step is an action the screens could take by hand, run through the same reducer and written to the same trail.</ProvenanceNote>
          </Panel>
        </div>
      </PageSection>
      </Body>
    </>
  );
}
