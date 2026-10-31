import { useEffect, useRef } from 'react';

/** Ignore asynchronous UI outcomes after leaving a resource/account-keyed view. */
export function useActiveView() {
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  return () => active.current;
}
