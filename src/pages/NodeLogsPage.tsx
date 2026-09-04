import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import styled from 'styled-components';
import { useCatalogQuery, useEventsQuery } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Checkbox } from '@/components/ui/Form';
import { Description, PageWrapper, SelectBox, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { EventLog } from '@/components/operator/EventLog';
import { DevBox, MonoBox, QueryError, Row } from '@/components/operator/common';

/**
 * Finding 133 — the operator console had no node-wide log screen at all. `/api/events` returns the whole node
 * stream and `useEventsQuery` was exported and used by nothing, so the only log view in the product was
 * `/project/:author/:patchId/logs` — one knowledge at a time, reachable only from a knowledge page. Every event
 * that is not about one knowledge (peer pushes, self-registration failures, payout retries, `trainer slot busy`)
 * had nowhere to appear, and an operator who runs this node from the browser could not see that anything was wrong.
 */
const SEEN_KEY = 'ainize.nodelog.seen';
const readSeen = (): number => { try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; } };

const Summary = styled.p<{ $bad: boolean }>`
  margin: 16px 0 0; font-size: 14px; font-weight: ${(p) => (p.$bad ? 600 : 400)};
  color: ${(p) => (p.$bad ? '#8a4b00' : p.theme.color.GREY)};
`;
const Since = styled.span`display: block; font-weight: 400; font-size: 13px; color: ${(p) => p.theme.color.GREY}; margin-top: 4px;`;
const Subject = styled.span`
  a { color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; }
  a:hover { text-decoration: underline; }
`;
const HeaderCheck = styled.span`
  label { font-size: 10px; gap: 6px; }
  input { width: 13px; height: 13px; }
`;

export default function NodeLogsPage() {
  const { t } = useT();
  const { address } = useAuth();
  useTitle(t('op.nodelog.title'));
  const [limit, setLimit] = useState(200);
  const [level, setLevel] = useState('all');
  const [kind, setKind] = useState('all');
  const [follow, setFollow] = useState(true);
  // Frozen once on mount: the marker must not walk forward under the operator's eyes while they read the screen.
  const [seen] = useState(readSeen);
  useEffect(() => { try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* a private window still gets the log */ } }, []);

  const events = useEventsQuery({ limit }, { pollingInterval: follow ? 5000 : 0 });
  // Which knowledge a line is about: the catalogue is the only place the web knows an id's author.
  const catalog = useCatalogQuery({ limit: 500, include_drafts: true });
  const authors = useMemo(() => new Map((catalog.data?.items ?? []).map((e) => [e.anchor.id, e.anchor.author])), [catalog.data]);

  const all = useMemo(() => events.data?.events ?? [], [events.data]);
  const kinds = useMemo(() => [...new Set(all.map((e) => e.kind))].sort(), [all]);
  const rows = useMemo(() => all.filter((e) => {
    if (kind !== 'all' && e.kind !== kind) return false;
    if (level === 'all') return true;
    // "warn" is a floor, the same question `ainize logs --level warn` answers: warnings and worse.
    if (level === 'warn') return e.level === 'warn' || e.level === 'error';
    if (level === 'error') return e.level === 'error';
    return e.level === 'info' || e.level === 'debug';
  }), [all, kind, level]);

  const warn = all.filter((e) => e.level === 'warn').length;
  const err = all.filter((e) => e.level === 'error').length;
  const fresh = all.filter((e) => (e.level === 'warn' || e.level === 'error') && e.ts > seen).length;
  const filtered = kind !== 'all' || level !== 'all';

  const LEVELS = [
    { value: 'all', label: t('op.logs.level.all') }, { value: 'info', label: t('op.logs.level.info') },
    { value: 'warn', label: t('op.logs.level.warn') }, { value: 'error', label: t('op.logs.level.error') },
  ];
  const KINDS = [{ value: 'all', label: t('op.nodelog.kind.all') }, ...kinds.map((k) => ({ value: k, label: k }))];

  const subject = (id: string | null) => {
    if (!id) return <span style={{ color: '#c4c4c6' }}>—</span>;
    const author = authors.get(id);
    if (!author) return <span title={id}>{id}</span>;
    const owned = !!address && author.toLowerCase() === address.toLowerCase();
    return <Subject><Link to={owned ? `/project/${author}/${id}` : `/${author}/${id}`} title={t('op.nodelog.of', { id })}>{id}</Link></Subject>;
  };

  return (
    <PageWrapper $wide>
      <TitleRow>
        <Title>{t('op.nodelog.title')}</Title>
        <SelectBox options={LEVELS} value={level} onChange={setLevel} label={t('common.level_aria')} />
      </TitleRow>
      <Description>{t('op.nodelog.desc')} <StyledLink to="/dashboard">{t('op.nodelog.back')}</StyledLink></Description>

      {events.isError
        ? <QueryError error={events.error} what={t('op.nodelog.title')} retrying={events.isFetching} onRetry={() => void events.refetch()} />
        : (
          <Summary $bad={warn + err > 0} data-testid="nodelog-summary">
            {warn + err === 0 ? t('op.nodelog.summary.clean', { n: all.length }) : t('op.nodelog.summary.bad', { n: all.length, warn, err })}
            {fresh > 0 && <Since>{t('op.nodelog.since', { n: fresh })}</Since>}
          </Summary>
        )}

      <EventLog
        rows={rows}
        loading={events.isLoading}
        fetching={events.isFetching}
        onOlder={() => setLimit((l) => l + 200)}
        empty={filtered ? t('op.nodelog.empty.filtered') : t('op.nodelog.empty')}
        footer={t('op.logs.footer', { n: limit })}
        subject={(e) => subject(e.patch_id)}
        freshAfter={seen || undefined}
        controls={(
          <Row $gap={10}>
            <SelectBox options={KINDS} value={kind} onChange={setKind} label={t('op.nodelog.kind')} prefix={t('op.nodelog.kind')} />
            <HeaderCheck title={t('op.nodelog.follow.help')}>
              <Checkbox label={t('op.nodelog.follow')} checked={follow} onChange={(e) => setFollow(e.target.checked)} />
            </HeaderCheck>
          </Row>
        )}
      />

      <DevBox>
        <span style={{ fontSize: 13, color: '#8d8d8f', display: 'block', marginBottom: 6 }}>{t('op.nodelog.cli')}</span>
        <MonoBox>ainize logs --follow{level !== 'all' ? ` --level ${level}` : ''}{kind !== 'all' ? ` --kind ${kind}` : ''}</MonoBox>
      </DevBox>
    </PageWrapper>
  );
}
