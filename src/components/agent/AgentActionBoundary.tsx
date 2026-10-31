import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createAgentActionScope, type AgentActionScope } from '@/lib/agentActionScope';
import { Alert } from '@/components/ui/Form';
import { useT } from '@/i18n';
const Context = createContext<AgentActionScope | null>(null);
/** Nested owner panels share the page's scope; standalone panels still share one with their child controls. */
export function AgentActionBoundary({ children, scope: supplied }: { children: ReactNode; scope?: AgentActionScope }) {
  const parent = useContext(Context), [local] = useState(createAgentActionScope);
  return <Context.Provider value={parent ?? supplied ?? local}>{!parent && <AgentActionStatus />}{children}</Context.Provider>;
}
export function useAgentActions() {
  const shared = useContext(Context), [local] = useState(createAgentActionScope), scope = shared ?? local;
  const state = useSyncExternalStore(scope.subscribe, scope.snapshot, scope.snapshot);
  return { scope, state, shared: !!shared, blocked: !!state && state.phase !== 'complete' };
}
export function AgentActionStatus() {
  const { state } = useAgentActions(), { t } = useT();
  if (!state) return null;
  return <Alert $tone={state.phase === 'complete' ? 'success' : state.phase === 'pending' ? 'info' : 'error'} role="status" style={{ overflowWrap: 'anywhere' }} data-testid="agent-action-status">
    {t(`agentAction.${state.phase}`, { id: state.id, action: t(`agentAction.${state.action}`) })}
  </Alert>;
}
