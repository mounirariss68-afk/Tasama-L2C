import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PERSONAS } from '@mizan/domain/personas';
import { X } from 'lucide-react';

/** Portal avoids the shell's glass/scroll containers clipping mobile menus. */
export function PersonaMenu({ currentId, onSelect, onDismiss }: { currentId: string; onSelect: (id: string) => void; onDismiss: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (dialog.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? dialog.current?.querySelector<HTMLButtonElement>('button'))?.focus();
    return () => previous?.focus();
  }, []);
  return createPortal(<>
    <div className="fixed inset-0 z-[190] bg-black/15" onClick={onDismiss} aria-hidden="true" />
    <div ref={dialog} role="dialog" aria-modal="true" aria-label="Switch demo persona"
      className="fixed end-4 top-20 z-[200] max-h-[calc(100dvh-6rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-background p-3 shadow-xl"
      onKeyDown={e => {
        if (e.key === 'Escape') { e.stopPropagation(); onDismiss(); }
        if (e.key !== 'Tab') return;
        const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }}>
      <div className="mb-2 flex items-center justify-between"><span className="eyebrow text-primary">Switch persona</span><button type="button" aria-label="Close persona menu" onClick={onDismiss} className="rounded p-1 hover:bg-card"><X size={16} /></button></div>
      <div className="space-y-1">{PERSONAS.map(p => <button key={p.id} type="button" aria-pressed={p.id === currentId} onClick={() => onSelect(p.id)}
        className={`flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-start ${p.id === currentId ? 'border-primary/50 bg-primary/10' : 'border-transparent hover:bg-card'}`}>
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card font-mono text-[10px]">{p.initials}</span>
        <span className="min-w-0 flex-1"><span className="block break-words text-xs text-foreground">{p.name}</span><span className="block break-words text-[11px] text-muted-foreground">{p.role}</span>
          <span className="mt-0.5 block break-words font-mono text-[10px] text-primary">{p.nav.length} screens · {p.clients.length ? `${p.clients.length} accounts` : 'all accounts'} · {p.limit ? `up to SAR ${p.limit.toLocaleString('en-US')}` : p.id === 'noura' ? 'no limit' : 'no spend'}</span></span>
      </button>)}</div>
      <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">Demo personas change the available workflows and approval rules. They are not authenticated user accounts.</p>
    </div>
  </>, document.body);
}
