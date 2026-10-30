import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import styled from 'styled-components';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { searchHref, seeAllHref, type SearchDoc, type SearchKind } from '@/lib/globalSearch';
import { useSearchResults } from '@/lib/useSearchResults';

/** The statuses /explore shows by default — a retired knowledge is not what a search box should offer first. */

/**
 * The header's search — huggingface.co's shape: a pill input beside the logo, a dropdown grouped by what the hit
 * is, "See all" at the end of each group, and Enter on nothing selected goes to the full-page search.
 *
 * Models, agents and the signed-in person's projects are small lists the site already loads; they are searched
 * here. Knowledge is paged and can be large, so the node searches it (`/api/catalog?q=`), debounced.
 */
const Wrap = styled.div`
  position: relative; flex: 0 1 360px; min-width: 0;
  @media (max-width: ${(p) => p.theme.breakpoint.md - 1}px) { flex: 1 0 100%; order: 3; padding: 0 0 10px; }
`;
const Field = styled.div`
  display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 12px; border-radius: 999px;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #f9f9fb; color: ${(p) => p.theme.color.GREY};
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  &:focus-within { border-color: ${(p) => p.theme.color.PRIMARY}; background: #fff; box-shadow: 0 0 0 3px rgba(139, 62, 235, 0.12); }
  svg { flex: 0 0 auto; }
`;
const Input = styled.input`
  flex: 1 1 auto; min-width: 0; border: 0; background: transparent; font: inherit; font-size: 14px; color: ${(p) => p.theme.color.BLACK}; outline: none;
  &::placeholder { color: ${(p) => p.theme.color.GREY}; }
  &::-webkit-search-decoration, &::-webkit-search-cancel-button { appearance: none; }
`;
const Panel = styled.div`
  position: absolute; z-index: 40; top: calc(100% + 6px); left: 0; right: 0; min-width: min(420px, calc(100vw - 32px));
  max-height: min(70vh, 560px); overflow-y: auto; padding: 6px; background: #fff; border-radius: 12px;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; box-shadow: 0 12px 28px rgba(48, 49, 51, 0.16);
`;
const GroupHead = styled.div`
  display: flex; align-items: baseline; justify-content: space-between; padding: 8px 10px 4px; font-size: 11px; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase; color: ${(p) => p.theme.color.GREY};
`;
const Row = styled(Link)<{ $on: boolean }>`
  display: flex; align-items: baseline; gap: 8px; padding: 7px 10px; border-radius: 8px; text-decoration: none;
  background: ${(p) => (p.$on ? p.theme.color.PALE_GREY : 'transparent')};
  &:hover { background: ${(p) => p.theme.color.PALE_GREY}; }
  .t { flex: 0 0 auto; max-width: 70%; font-size: 13.5px; font-weight: 600; color: ${(p) => p.theme.color.BLACK}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .s { flex: 1 1 auto; min-width: 0; font-size: 12px; color: ${(p) => p.theme.color.GREY}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
const More = styled(Link)<{ $on: boolean }>`
  display: block; padding: 6px 10px 8px; font-size: 12px; font-weight: 600; text-decoration: none; border-radius: 8px;
  color: ${(p) => p.theme.color.PRIMARY}; background: ${(p) => (p.$on ? p.theme.color.PALE_GREY : 'transparent')};
  &:hover { background: ${(p) => p.theme.color.PALE_GREY}; }
`;
const Note = styled.div`padding: 10px; font-size: 12.5px; color: ${(p) => p.theme.color.GREY};`;

function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

/** One keyboard-walkable entry: a hit, or a group's "see all" line. */
type Entry = { key: string; href: string; kind: SearchKind; hit?: SearchDoc; more?: { n: number } };

export function GlobalSearch() {
  const { t } = useT();
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  /** Nothing is fetched until the box is first focused: the header is on every page. */
  const [armed, setArmed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const needle = q.trim();
  const debounced = useDebounced(needle, 200);

  const result = useSearchResults(debounced, armed);
  const groups = debounced === needle ? result.groups : [];

  const entries = useMemo<Entry[]>(() => groups.flatMap((g) => [
    ...g.hits.map((h): Entry => ({ key: `${g.kind}:${h.id}`, href: h.href, kind: g.kind, hit: h })),
    ...(g.total > g.hits.length ? [{ key: `${g.kind}:more`, href: seeAllHref(g.kind, needle), kind: g.kind, more: { n: g.total } } satisfies Entry] : []),
  ]), [groups, needle]);

  const entryKeys = entries.map((entry) => entry.key).join('|');
  useEffect(() => { setCursor(-1); }, [needle, entryKeys]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const go = (href: string) => { setOpen(false); setQ(''); navigate(href); };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!needle) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setCursor((c) => Math.min(c + 1, entries.length)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, -1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(cursor >= 0 && entries[cursor] ? entries[cursor].href : searchHref(needle)); }
  };

  const loading = !!needle && (result.loading || debounced !== needle);
  const showPanel = open && !!needle;
  let i = -1;
  return (
    <Wrap ref={box} data-testid="global-search">
      <Field>
        <SearchIcon />
        <Input
          type="search" value={q} placeholder={t('search.placeholder')} aria-label={t('search.label')}
          role="combobox" aria-expanded={showPanel} aria-controls={listId} aria-activedescendant={showPanel && cursor >= 0 ? `${listId}-${cursor}` : undefined} aria-autocomplete="list" autoComplete="off"
          onFocus={() => { setArmed(true); setOpen(true); }} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onKeyDown={onKey}
          data-testid="global-search-input"
        />
      </Field>
      {showPanel && (
        <Panel id={listId} role="listbox" aria-label={t('search.label')}>
          {groups.map((g) => (
            <div key={g.kind} role="group" aria-label={t(`search.kind.${g.kind}`)}>
              <GroupHead><span>{t(`search.kind.${g.kind}`)}</span><span>{g.total}</span></GroupHead>
              {g.hits.map((h) => { i += 1; const on = i === cursor; return (
                <Row id={`${listId}-${i}`} key={h.id} to={h.href} $on={on} role="option" aria-selected={on} onClick={(e) => { e.preventDefault(); go(h.href); }} onMouseEnter={() => setCursor(entries.findIndex((en) => en.hit?.id === h.id && en.kind === g.kind))}>
                  <span className="t">{h.title}</span>
                  {h.subtitle && <span className="s">{h.subtitle}</span>}
                </Row>
              ); })}
              {g.total > g.hits.length && (() => { i += 1; const on = i === cursor; const href = seeAllHref(g.kind, needle); return (
                <More id={`${listId}-${i}`} to={href} $on={on} role="option" aria-selected={on} onClick={(e) => { e.preventDefault(); go(href); }}>
                  {t('search.see_all', { n: g.total, kind: t(`search.kind.${g.kind}`) })} →
                </More>
              ); })()}
            </div>
          ))}
          {!groups.length && !loading && !result.failures.length && <Note>{t('search.empty', { q: needle })}</Note>}
          {!groups.length && loading && <Note>{t('search.loading')}</Note>}
          {!!result.failures.length && <Note role="status">{t('search.partial', { kinds: result.failures.map((kind) => t(`search.kind.${kind}`)).join(', ') })}</Note>}
          {!isSignedIn && <Note>{t('search.apps_signin')}</Note>}
          <More id={`${listId}-${entries.length}`} to={searchHref(needle)} $on={cursor === entries.length} role="option" aria-selected={cursor === entries.length} onMouseEnter={() => setCursor(entries.length)} onClick={(e) => { e.preventDefault(); go(searchHref(needle)); }} data-testid="global-search-all">
            {t('search.all', { q: needle })} →
          </More>
        </Panel>
      )}
    </Wrap>
  );
}
