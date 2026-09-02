import { useEffect } from 'react';

/** Suffix every page carries, so a tab strip reads "Explore knowledge · Ainize", "Live test · Ainize", … */
export const BRAND = 'Ainize';

/**
 * Name the page in the tab, history and bookmarks. Called once per page with a string that already comes from the
 * page dictionary, so the title follows the language toggle like everything else on screen.
 *
 * `undefined` while the page is still loading its subject (a knowledge id, a topic): the previous title stays until
 * the real name arrives instead of flashing a placeholder.
 */
export function useTitle(text: string | undefined): void {
  useEffect(() => {
    if (!text) return;
    document.title = `${text} · ${BRAND}`;
  }, [text]);
}
