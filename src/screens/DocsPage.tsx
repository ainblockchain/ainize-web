/**
 * `/docs` — the frame every documentation page renders into.
 *
 * One source, two surfaces: the pages are the markdown files in `docs/en/**` and `docs/ko/**`, which read correctly
 * on disk and on GitHub, and this route renders those same files. Nothing here is a second copy of the prose, so
 * there is nothing to drift.
 *
 * URLs: `/docs` redirects to the first page in the tree, `/docs/<page>` is English, `/docs/ko/<page>` is Korean, and
 * `#anchor` reaches a section. A bare `/docs/<page>` follows the reader's own language when they have one, so the
 * URL a Korean reader pastes to an English colleague still opens.
 *
 * Layout follows huggingface.co/docs: sidebar, prose near 65 characters wide, on-this-page rail, previous/next at
 * the foot. Below 1280px the rail folds into a summary above the prose rather than squeezing it; below 1024px the
 * sidebar becomes a drawer that is usable at 360px.
 */
import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import styled from 'styled-components';
import { Blocks, Prose, useHashScroll } from '@/components/docs/Markdown';
import { FooterNav } from '@/components/docs/FooterNav';
import { Sidebar } from '@/components/docs/Sidebar';
import { Toc } from '@/components/docs/Toc';
import { docHref, neighbours, parseDocsPath, type Lang } from '@/components/docs/docsTree';
import { DocsLangProvider, useDocsT } from '@/components/docs/i18n';
import { SITES } from './docs/pages';
import { StyledLink } from '@/components/ui/Misc';
import { useLocale } from '@/i18n';
import { useTitle } from '@/utils/useTitle';

/* ------------------------------------------------------------------ layout */

const Shell = styled.div`
  /* 264 + 40 + 736 + 40 + 224 — the three columns and their gaps, so the rail sits beside the prose instead of
     across a field of white space */
  width: 100%; max-width: 1304px; margin: 0 auto; padding: 0 24px 72px;
  display: grid; gap: 40px; align-items: start;
  grid-template-columns: 264px minmax(0, 1fr) 224px;
  @media (max-width: 1279px) { grid-template-columns: 264px minmax(0, 1fr); gap: 32px; max-width: 1040px; }
  @media (max-width: 1023px) { grid-template-columns: minmax(0, 1fr); gap: 0; padding: 0 16px 56px; }
`;

const Left = styled.div`
  position: sticky; top: 0; max-height: 100vh; overflow-y: auto; border-right: 1px solid #ececec;
  @media (max-width: 1023px) { display: none; }
`;

/* the CLI reference has 81 entries in its rail: it scrolls on its own rather than running off the bottom of a
   sticky column the reader cannot reach */
const Right = styled.div`
  position: sticky; top: 32px; padding-top: 40px; max-height: calc(100vh - 48px); overflow-y: auto;
  @media (max-width: 1279px) { display: none; }
`;

const Main = styled.main`padding: 32px 0 0; min-width: 0;`;
const Article = styled.div`max-width: 46rem;`;

/* the mobile bar and drawer — one button, full-width panel, usable at 360px */
const Bar = styled.div`
  display: none; position: sticky; top: 0; z-index: 20; align-items: center; gap: 10px;
  margin: 0 -16px; padding: 10px 16px; background: rgba(255, 255, 255, 0.96); backdrop-filter: blur(6px);
  border-bottom: 1px solid #ececec;
  @media (max-width: 1023px) { display: flex; }
`;
const BarBtn = styled.button`
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 6px; cursor: pointer;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff; color: ${(p) => p.theme.color.BLACK}; font-size: 13px;
`;
const BarHere = styled.span`
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 13px; color: ${(p) => p.theme.color.GREY};
`;
const Scrim = styled.div`
  position: fixed; inset: 0; z-index: 40; background: rgba(48, 49, 51, 0.4);
`;
const Drawer = styled.div`
  position: fixed; z-index: 41; top: 0; bottom: 0; left: 0; width: min(320px, 92vw); overflow-y: auto;
  background: #fff; box-shadow: 0 0 40px rgba(0, 0, 0, 0.2);
`;
const DrawerHead = styled.div`
  display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid #ececec;
  font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${(p) => p.theme.color.GREY};
  button { border: 0; background: none; font-size: 18px; line-height: 1; cursor: pointer; color: ${(p) => p.theme.color.GREY}; padding: 4px 6px; }
`;

/* the rail, folded into a disclosure on narrow screens */
const TocFold = styled.details`
  display: none; margin: 24px 0 0; padding: 10px 14px; border: 1px solid #ececec; border-radius: 8px;
  summary { cursor: pointer; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${(p) => p.theme.color.GREY}; }
  nav { margin-top: 10px; }
  nav h2 { display: none; }
  @media (max-width: 1279px) { display: block; }
`;

const Banner = styled.div`
  margin: 0 0 24px; padding: 12px 16px; border-radius: 8px; border: 1px solid #ffe0b2; background: #fff8ef;
  font-size: 13.5px; line-height: 1.6; color: ${(p) => p.theme.color.DARK_GREY};
  strong { display: block; color: ${(p) => p.theme.color.BLACK}; }
`;

const Source = styled.p`
  margin: 32px 0 0; font-size: 12px; color: ${(p) => p.theme.color.GREY};
  code { font-family: ${(p) => p.theme.font.mono}; font-size: 12px; }
`;

const Missing = styled.div`padding: 48px 0;`;

/** Which shape the on-this-page rail takes. Rendering both and hiding one with CSS would put two identical
 *  navigation landmarks in the accessibility tree and run two scroll listeners for one rail. */
function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const [on, setOn] = useState(() => (typeof window === 'undefined' ? true : window.matchMedia(query).matches));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setOn(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [query]);
  return on;
}

/* ------------------------------------------------------------------ page */

export default function DocsPage() {
  const { pathname } = useLocation();
  const { locale } = useLocale();
  const { lang, slug, explicit } = parseDocsPath(pathname, locale as Lang);
  return (
    <DocsLangProvider lang={lang}>
      <DocsShell lang={lang} slug={slug} explicit={explicit} />
    </DocsLangProvider>
  );
}

function DocsShell({ lang, slug, explicit }: { lang: Lang; slug: string; explicit: boolean }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { locale } = useLocale();
  const { t } = useDocsT();
  const [drawer, setDrawer] = useState(false);
  const railBeside = useMinWidth(1280);
  const site = SITES[lang];
  const entry = slug ? site.bySlug.get(slug) : undefined;

  useTitle(entry ? entry.title : t('docs.title'));
  useHashScroll(entry?.slug);

  // The header's language toggle stays meaningful on a URL that pins the language: switch to English while reading
  // /docs/ko/<page> and you land on /docs/<page>. It fires on a *change* of locale only — on first load the URL
  // wins, so a Korean link opens the Korean page however the reader's own locale is set.
  const seen = useRef(locale);
  useEffect(() => {
    const changed = seen.current !== locale;
    seen.current = locale;
    if (changed && explicit && slug && locale !== lang) navigate(docHref(locale as Lang, slug), { replace: true });
  }, [locale, explicit, lang, slug, navigate]);

  useEffect(() => { setDrawer(false); }, [pathname]);
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  // /docs → the first page of the tree
  if (!slug) {
    const first = site.flat[0] ?? SITES.en.flat[0];
    if (first) return <Navigate to={first.href} replace />;
  }
  // a page this language does not list but English does — send the reader to the page rather than to a 404
  if (slug && !entry && SITES.en.bySlug.has(slug)) return <Navigate to={docHref('en', slug)} replace />;

  const { prev, next } = entry ? neighbours(site, entry.slug) : {};
  const nav = <Sidebar site={site} current={entry?.slug ?? ''} onNavigate={() => setDrawer(false)} />;

  return (
    <Shell lang={lang}>
      <Left>{nav}</Left>
      <Main>
        <Bar>
          <BarBtn type="button" onClick={() => setDrawer(true)} aria-expanded={drawer} aria-haspopup="dialog">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            {t('docs.nav.label')}
          </BarBtn>
          <BarHere>{entry ? `${entry.group} · ${entry.title}` : t('docs.title')}</BarHere>
        </Bar>

        {drawer && (
          <>
            <Scrim onClick={() => setDrawer(false)} />
            <Drawer role="dialog" aria-label={t('docs.nav.label')}>
              <DrawerHead>
                {t('docs.nav.label')}
                <button type="button" onClick={() => setDrawer(false)} aria-label={t('docs.nav.close')}>✕</button>
              </DrawerHead>
              {nav}
            </Drawer>
          </>
        )}

        {!entry ? (
          <Missing>
            <Prose>
              <h1>{t('docs.notfound.title')}</h1>
              <p>{t('docs.notfound.body', { slug: `/docs/${slug}` })}</p>
              <p><StyledLink to={site.flat[0]?.href ?? '/docs'}>{t('docs.notfound.home')}</StyledLink></p>
            </Prose>
          </Missing>
        ) : (
          <Article>
            {entry.untranslated && (
              <Banner>
                <strong>{t('docs.untranslated.title')}</strong>
                {t('docs.untranslated.body')}{' '}
                <StyledLink to={docHref('en', entry.slug)}>{t('docs.untranslated.link')}</StyledLink>
              </Banner>
            )}
            {!railBeside && (
              <TocFold>
                <summary>{t('docs.toc.label')}</summary>
                <Toc headings={entry.doc.headings} title={entry.title} slug={entry.slug} />
              </TocFold>
            )}
            <Prose>
              <Blocks blocks={entry.doc.blocks} ctx={{ lang: entry.lang, slug: entry.slug }} />
            </Prose>
            <Source>{t('docs.source')} <code>docs/{entry.untranslated ? 'en' : entry.lang}/{entry.slug}.md</code></Source>
            <FooterNav prev={prev} next={next} />
          </Article>
        )}
      </Main>
      <Right>{entry && railBeside && <Toc headings={entry.doc.headings} title={entry.title} slug={entry.slug} />}</Right>
    </Shell>
  );
}
