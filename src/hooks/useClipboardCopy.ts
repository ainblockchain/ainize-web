import { useEffect, useMemo, useRef, useState } from 'react';
import { createClipboardTask, type CopyPhase } from '@/lib/clipboard';
import { useActiveView } from './useActiveView';

export function useClipboardCopy(text: string) {
  const active = useActiveView();
  const task = useMemo(() => createClipboardTask(), [text]);
  const current = useRef(task); current.current = task;
  const [result, setResult] = useState<{ task: typeof task; phase: CopyPhase } | null>(null);
  useEffect(() => () => task.cancel(), [task]);
  const phase = result?.task === task ? result.phase : 'idle';
  return {
    phase, disabled: !text.trim() || phase === 'copying',
    copy: () => task.copy(text, () => active() && current.current === task, phase => setResult({ task, phase })),
  };
}
