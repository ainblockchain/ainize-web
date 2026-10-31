type DraftStorage = Pick<Storage, 'setItem' | 'removeItem'>;

/** Completion closes the journal before removal so unmount/pagehide cannot resurrect an accepted draft. */
export function createDraftJournal(storage: () => DraftStorage, key: string) {
  let completed = false;
  const write = (text: string | null): boolean => {
    try {
      if (text === null) storage().removeItem(key);
      else storage().setItem(key, text);
      return true;
    } catch { return false; }
  };
  return {
    save(text: string | null) { return completed || write(text); },
    complete() { completed = true; return write(null); },
  };
}
