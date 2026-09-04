/**
 * The left navigation and the search box above it.
 *
 * Shape follows huggingface.co/docs/transformers/en/quicktour, whose `SideMenu` is a list of chapters
 * (`{title, isExpanded, sections:[{title, url}]}`) with a "Search documentation" control pinned above it: groups
 * collapse, the current page is marked, and nothing else competes for the column.
 *
 * Everything here is a real `<button>` or `<a>`, so Tab reaches it, Enter and Space work, and the app's global
 * `:focus-visible` ring shows where you are. Search adds Up/Down/Enter/Escape on top of that.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import styled from 'styled-components';
import { useDocsT } from './i18n';
import { searchDocs, type DocSite } from './docsTree';

const Nav = styled.nav`
  display: flex; flex-direction: column; gap: 4px; padding: 24px 20px 40px 0; font-size: 14px;
  @media (max-width: 1023px) { padding: 16px 20px 32px; }
`;

const GroupBtn = styled.button`
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 8px 8px 10px; margin-top: 10px;
  border: 0; background: none; cursor: pointer; text-align: left;
  font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
  color: ${(p) => p.theme.color.GREY};
  &:hover { color: ${(p) => p.theme.color.BLACK}; }
  svg { flex: none; transition: transform 0.15s ease; }
`;

const PageList = styled.ul`
  list-style: none; margin: 0; padding: 0 0 0 10px; display: flex; flex-direction: column;
`;

const PageLink = styled(Link)<{ $on: boolean }>`
  display: block; padding: 6px 10px; border-radius: 6px; text-decoration: none; line-height: 1.45;
  border-left: 2px solid ${(p) => (p.$on ? p.theme.color.PRIMARY : 'transparent')};
  color: ${(p) => (p.$on ? p.theme.color.PRIMARY : p.theme.color.DARK_GREY)};
  font-weight: ${(p) => (p.$on ? 600 : 400)};
  background: ${(p) => (p.$on ? p.theme.color.PALE_GREY : 'transparent')};
  &:hover { background: ${(p) => (p.$on ? p.theme.color.PALE_GREY : '#f6f6f7')}; color: ${(p) => p.theme.color.BLACK}; }
`;

const Untranslated = styled.span`
  margin-left: 6px; padding: 0 5px; border-radius: 3px; background: #f2f2f2; color: ${(p) => p.theme.color.GREY};
  font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; vertical-align: 1px;
`;

/* ------------------------------------------------------------------ search */

const SearchWrap = styled.div`position: relative;`;
const SearchInput = styled.input`
  width: 100%; padding: 8px 12px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 6px;
  background: #fff; color: ${(p) => p.theme.color.BLACK}; font-size: 13px;
  &::placeholder { color: ${(p) => p.theme.color.GREY}; }
  &:focus { border-color: ${(p) => p.theme.color.PRIMARY}; outline: none; box-shadow: 0 0 0 3px rgba(139, 62, 235, 0.12); }
`;
const Results = styled.ul`
  position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; right: 0; max-height: 60vh; overflow-y: auto;
  list-style: none; margin: 0; padding: 4px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 8px;
  background: #fff; box-shadow: 0 12px 28px rgba(48, 49, 51, 0.16);
`;
const Hit = styled.li<{ $on: boolean }>`
  padding: 8px 10px; border-radius: 6px; cursor: pointer; background: ${(p) => (p.$on ? p.theme.color.PALE_GREY : 'transparent')};
  .t { font-size: 13px; font-weight: 600; color: ${(p) => p.theme.color.BLACK}; }
  .g { font-size: 11px; color: ${(p) => p.theme.color.GREY}; margin-left: 6px; }
  .s { display: block; margin-top: 2px; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY}; }
  mark { background: #f5eefc; color: ${(p) => p.theme.color.HOVER}; padding: 0 1px; border-radius: 2px; }
`;
const NoHit = styled.li`padding: 10px; font-size: 12.5px; color: ${(p) => p.theme.color.GREY};`;

function Search({ site, onGo }: { site: DocSite; onGo: () => void }) {
  const { t } = useDocsT();
  const listId = useId();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const hits = useMemo(() => searchDocs(site, q), [site, q]);
  const open = q.trim().length >= 2;

  useEffect(() => { setCursor(0); }, [q]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setQ(''); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const go = (i: number) => {
    const hit = hits[i];
    if (!hit) return;
    navigate(hit.heading ? `${hit.entry.href}#${hit.heading.id}` : hit.entry.href);
    setQ('');
    onGo();
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setQ(''); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(cursor); }
  };

  return (
    <SearchWrap ref={box}>
      <SearchInput
        type="search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
        placeholder={t('docs.search.placeholder')} aria-label={t('docs.search.placeholder')}
        role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
      />
      {open && (
        <Results id={listId} role="listbox" aria-label={t('docs.search.results')}>
          {hits.length === 0 && <NoHit>{t('docs.search.none', { q: q.trim() })}</NoHit>}
          {hits.map((hit, i) => (
            <Hit key={hit.entry.slug} role="option" aria-selected={i === cursor} $on={i === cursor}
              onMouseEnter={() => setCursor(i)} onMouseDown={(e) => { e.preventDefault(); go(i); }}>
              <span className="t">{hit.entry.title}</span><span className="g">{hit.entry.group}</span>
              {hit.where === 'heading' && hit.heading && <span className="s">#{hit.heading.text}</span>}
              {hit.where === 'body' && hit.snippet && (
                <span className="s">{hit.snippet.before}<mark>{hit.snippet.match}</mark>{hit.snippet.after}</span>
              )}
            </Hit>
          ))}
        </Results>
      )}
    </SearchWrap>
  );
}

/* ------------------------------------------------------------------ sidebar */

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" style={{ transform: open ? 'rotate(90deg)' : 'none' }}>
      <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Sidebar({ site, current, onNavigate }: { site: DocSite; current: string; onNavigate: () => void }) {
  const { t } = useDocsT();
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  return (
    <Nav aria-label={t('docs.nav.label')}>
      <Search site={site} onGo={onNavigate} />
      {site.groups.map((g) => {
        const holdsCurrent = g.pages.some((p) => p.slug === current);
        const open = holdsCurrent || !closed[g.group];
        return (
          <div key={g.group}>
            <GroupBtn type="button" aria-expanded={open} onClick={() => setClosed((c) => ({ ...c, [g.group]: open }))}>
              <Chevron open={open} />{g.group}
            </GroupBtn>
            {open && (
              <PageList>
                {g.pages.map((p) => (
                  <li key={p.slug}>
                    <PageLink to={p.href} $on={p.slug === current} aria-current={p.slug === current ? 'page' : undefined} onClick={onNavigate}>
                      {p.title}
                      {p.untranslated && <Untranslated title={t('docs.untranslated.short')}>EN</Untranslated>}
                    </PageLink>
                  </li>
                ))}
              </PageList>
            )}
          </div>
        );
      })}
    </Nav>
  );
}
