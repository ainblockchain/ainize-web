import { useEffect, useMemo, useRef, useState } from 'react';
import { useLazyRouteQuery } from '@/api/api';
import { createNetworkRouteTask, routeInput, type RouteState } from '@/lib/networkRoute';
import { useActiveView } from './useActiveView';

export function useNetworkRoute(key: string, value: string) {
  const [query] = useLazyRouteQuery();
  const active = useActiveView();
  const task = useMemo(() => createNetworkRouteTask(), [key, value]);
  const current = useRef(task); current.current = task;
  const [result, setResult] = useState<{ task: typeof task; state: RouteState } | null>(null);
  useEffect(() => () => task.cancel(), [task]);
  const state: RouteState = result?.task === task ? result.state : { phase: 'idle' };
  const input = routeInput(key, value);
  return { input, state, run: () => input && task.run(input, query, () => active() && current.current === task, state => setResult({ task, state })) };
}
