import { createHostedAgentDeletion } from './hostedAgentDeletion';
/** Page-local ownership of management work, independent of catalogue-driven panel mounts. */
export type AgentAction = 'alias' | 'sharing' | 'unlink' | 'delete';
export type AgentActionPhase = 'pending' | 'unconfirmed' | 'cleanup' | 'complete';
export type AgentActionState = Readonly<{ action: AgentAction; id: string; phase: AgentActionPhase }>;
export function createAgentActionScope() {
  let state: AgentActionState | null = null, sequence = 0;
  const listeners = new Set<() => void>();
  const publish = (next: AgentActionState | null) => { state = next; for (const listener of listeners) listener(); };
  const blocked = () => !!state && state.phase !== 'complete';
  const canStart = (action: AgentAction, id: string) => !blocked() || state?.phase === 'cleanup' && action === 'delete' && state.action === 'delete' && state.id === id;
  return {
    hostedDeletion: createHostedAgentDeletion(),
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    blocked, canStart,
    begin(action: AgentAction, id: string) {
      if (!id || !canStart(action, id)) return null;
      const token = ++sequence;
      publish({ action, id, phase: 'pending' });
      let finished = false;
      return {
        finish(phase: Exclude<AgentActionPhase, 'pending'> | null) {
          if (finished || token !== sequence) return;
          finished = true;
          publish(phase ? { action, id, phase } : null);
        },
      };
    },
  };
}
export type AgentActionScope = ReturnType<typeof createAgentActionScope>;
