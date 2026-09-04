/**
 * Previous / next at the foot of a page, showing the neighbour's title.
 *
 * The order is the flattened toctree, so the walk crosses group boundaries — on
 * huggingface.co/docs/transformers/en/quicktour, "next" is *Dynamic weight loading*, which lives in a different
 * chapter (`DocFooterNav`'s `chapterNext`). A reader following next to the end therefore reads the whole tree in
 * the order it was written, and the first and last pages simply have one arm.
 */
import { Link } from 'react-router';
import styled from 'styled-components';
import { useDocsT } from './i18n';
import type { DocEntry } from './docsTree';

const Row = styled.nav`
  display: flex; gap: 16px; margin: 56px 0 8px; padding-top: 24px; border-top: 1px solid #ececec;
`;

const Side = styled(Link)<{ $end?: boolean }>`
  flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding: 12px 16px;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 8px; text-decoration: none;
  align-items: ${(p) => (p.$end ? 'flex-end' : 'flex-start')};
  text-align: ${(p) => (p.$end ? 'right' : 'left')};
  &:hover { border-color: ${(p) => p.theme.color.PRIMARY}; background: #fbf8ff; }
  .k { font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
  .t { font-size: 15px; font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; }
`;

export function FooterNav({ prev, next }: { prev?: DocEntry; next?: DocEntry }) {
  const { t } = useDocsT();
  if (!prev && !next) return null;
  return (
    <Row aria-label={t('docs.pager.label')}>
      {prev && <Side to={prev.href}><span className="k">← {t('docs.pager.prev')}</span><span className="t">{prev.title}</span></Side>}
      {next && <Side to={next.href} $end style={{ marginLeft: 'auto' }}><span className="k">{t('docs.pager.next')} →</span><span className="t">{next.title}</span></Side>}
    </Row>
  );
}
