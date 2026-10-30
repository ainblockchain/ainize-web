import { useSearchParams } from 'react-router';
import styled from 'styled-components';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, PageWrapper, StyledLink, Title } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { seeAllHref, searchHref } from '@/lib/globalSearch';
import { useSearchResults } from '@/lib/useSearchResults';
import { useTitle } from '@/utils/useTitle';

const Group = styled.section`
  margin-top: 28px;
  h2 { font-size: 18px; margin: 0 0 12px; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 14px 0; border-top: 1px solid #ececf0; overflow-wrap: anywhere; }
  p { margin: 5px 0 0; color: #666; font-size: 13px; }
`;

export default function SearchPage() {
  const [params] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const { t } = useT();
  const { isSignedIn } = useAuth();
  const { groups, failures, loading, retry } = useSearchResults(query, true, 8);
  useTitle(t('search.title'));
  return <PageWrapper>
    <Title>{t('search.title')}</Title>
    <Description>{t(query ? 'search.query' : 'search.prompt', { q: query })}</Description>
    {query && !isSignedIn && <Description>{t('search.apps_signin')}{' '}<StyledLink to={`/signing?next=${encodeURIComponent(searchHref(query))}`}>{t('nav.signin')}</StyledLink></Description>}
    {failures.length > 0 && <Alert $tone="warning" role="alert">
      {t('search.partial', { kinds: failures.map((kind) => t(`search.kind.${kind}`)).join(', ') })}{' '}
      <Button onClick={retry} loading={loading}>{t('apps.retry')}</Button>
    </Alert>}
    {loading && !groups.length && <CenterProgress />}
    {query && !loading && !failures.length && !groups.length && <Empty>{t('search.empty', { q: query })}</Empty>}
    {groups.map((group) => <Group key={group.kind} aria-label={t(`search.kind.${group.kind}`)}>
      <h2>{t(`search.kind.${group.kind}`)} · {group.total}</h2>
      <ul>{group.hits.map((hit) => <li key={hit.id}>
        <StyledLink to={hit.href}>{hit.title}</StyledLink>
        {hit.subtitle && <p>{hit.subtitle}</p>}
      </li>)}</ul>
      {group.total > group.hits.length && <StyledLink to={seeAllHref(group.kind, query)}>{t('search.see_all', { n: group.total, kind: t(`search.kind.${group.kind}`) })} →</StyledLink>}
    </Group>)}
  </PageWrapper>;
}
