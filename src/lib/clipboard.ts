export type CopyPhase = 'idle' | 'copying' | 'copied' | 'failed';

export function clipboardUrl(value: string, origin?: string): string {
  if (!value.trim()) return '';
  try { return new URL(value, origin).href; } catch { return ''; }
}

/** Support LAN HTTP nodes as well as secure clipboard access, without leaving a hidden control or lost focus. */
export async function writeClipboard(text: string, isCurrent: () => boolean, environment?: {
  clipboard?: Pick<Clipboard, 'writeText'>; document?: Document;
}): Promise<boolean> {
  if (!text.trim() || !isCurrent()) return false;
  const clipboard = environment ? environment.clipboard : typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  try {
    if (clipboard) { await clipboard.writeText(text); return true; }
  } catch { /* An HTTP node or denied modern API may still permit the user-initiated fallback. */ }
  if (!isCurrent()) return false;
  const doc = environment ? environment.document : typeof document !== 'undefined' ? document : undefined;
  if (!doc?.body || typeof doc.execCommand !== 'function') return false;
  const previous = doc.activeElement as HTMLElement | null;
  const input = previous as HTMLInputElement | HTMLTextAreaElement | null;
  const caret = input && ['INPUT', 'TEXTAREA'].includes(input.tagName) ? { start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection } : null;
  const selection = doc.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const area = doc.createElement('textarea');
  area.value = text;
  area.readOnly = true;
  area.tabIndex = -1;
  area.setAttribute('aria-hidden', 'true');
  area.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  try {
    doc.body.appendChild(area);
    area.focus({ preventScroll: true });
    area.select();
    return doc.execCommand('copy') === true;
  } catch { return false; }
  finally {
    const restoreFocus = doc.activeElement === area;
    area.remove();
    try {
      if (restoreFocus && previous?.isConnected) {
        previous.focus({ preventScroll: true });
        if (caret?.start != null && caret.end != null) input!.setSelectionRange(caret.start, caret.end, caret.direction ?? undefined);
      }
      if (selection && ranges.length) { selection.removeAllRanges(); ranges.forEach(range => selection.addRange(range)); }
    } catch { /* A removed focus/selection target must not turn a successful copy into a failure. */ }
  }
}

/** One copy at a time; old completions and reset timers cannot label a different target as copied. */
export function createClipboardTask(
  write = writeClipboard,
  schedule: (callback: () => void, ms: number) => () => void = (callback, ms) => {
    const timer = setTimeout(callback, ms); return () => clearTimeout(timer);
  },
) {
  let generation = 0, busy = false;
  let clearTimer: (() => void) | undefined;
  return {
    cancel() { generation++; busy = false; clearTimer?.(); clearTimer = undefined; },
    async copy(text: string, isCurrent: () => boolean, update: (phase: CopyPhase) => void) {
      if (busy || !text.trim() || !isCurrent()) return;
      clearTimer?.(); clearTimer = undefined;
      const own = ++generation;
      const current = () => own === generation && isCurrent();
      busy = true; update('copying');
      let ok = false;
      try { ok = await write(text, current); } catch { /* Show a retryable failure. */ }
      if (own === generation) busy = false;
      if (!current()) return;
      update(ok ? 'copied' : 'failed');
      if (ok) clearTimer = schedule(() => { if (current()) update('idle'); }, 1500);
    },
  };
}
