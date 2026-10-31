import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { useEventsQuery, useInfoQuery } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Alert, Checkbox } from '@/components/ui/Form';
import { Description, PageWrapper, SelectBox, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { EventLog } from '@/components/operator/EventLog';
import { filterLogEvents, logCommand, logEvents, logSeenKey, readLogSeen, logSeenThrough, readLogSelection, logSelectionHref } from '@/lib/logView';
import { knowledgeLookupPath } from '@/lib/detailRoutes';
import { DevBox, MonoBox, QueryError, Row } from '@/components/operator/common';

/**
 * Finding 133 — the operator console had no node-wide log screen at all. `/api/events` returns the whole node
 * stream and `useEventsQuery` was exported and used by nothing, so the only log view in the product was
 * `/project/:author/:patchId/logs` — one knowledge at a time, reachable only from a knowledge page. Every event
 * that is not about one knowledge (peer pushes, self-registration failures, payout retries, `trainer slot busy`)
 * had nowhere to appear, and an operator who runs this node from the browser could not see that anything was wrong.
 */
const readSeen = (key: string | null): number => { try { return key ? readLogSeen(localStorage.getItem(key)) : 0; } catch { return 0; } };

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
  const { cacheIdentity, loading } = useAuth();
  const info = useInfoQuery();
  const nodeIdentity = !info.isError && typeof info.currentData?.node?.address === 'string' ? info.currentData.node.address : undefined;
  return <NodeLogs key={JSON.stringify([cacheIdentity, nodeIdentity])} identity={cacheIdentity} nodeIdentity={nodeIdentity} authLoading={loading} />;
}

export function NodeLogs({ identity, nodeIdentity, authLoading = false }: { identity: string; nodeIdentity?: string; authLoading?: boolean }) {
  const { t } = useT();
  useTitle(t('op.nodelog.title'));
  const [params] = useSearchParams();
  const location = useLocation(), navigate = useNavigate();
  const { limit, level, kind, follow, valid } = readLogSelection(params, 'node');
  const change = (values: Parameters<typeof logSelectionHref>[1]) => navigate(logSelectionHref(location, values));
  const seenKey = logSeenKey(identity, nodeIdentity);
  // Frozen once on mount: the marker must not walk forward under the operator's eyes while they read the screen.
  const [seen] = useState(() => readSeen(seenKey));

  const events = useEventsQuery({ limit, identity, ...(level !== 'all' ? { level } : {}), ...(kind !== 'all' ? { kind } : {}) }, { pollingInterval: follow ? 5000 : 0, skip: authLoading || !valid });
  const eventRows = !authLoading && valid && !events.isError ? logEvents(events.currentData) : null;
  useEffect(() => {
    const through = eventRows && logSeenThrough(eventRows);
    if (!seenKey || through == null) return;
    try {
      const previous = readSeen(seenKey), next = Math.max(seen, previous, through);
      if (next > previous) localStorage.setItem(seenKey, String(next));
    } catch { /* private windows can still read */ }
  }, [eventRows, seenKey, seen]);
  const all = eventRows ?? [];
  const kinds = [...new Set([...all.map(e => e.kind), ...(kind === 'all' ? [] : [kind])])].sort();
  const rows = filterLogEvents(all, level, kind);
  const failed = !authLoading && (events.isError || !eventRows && !events.isFetching);

  const warn = all.filter((e) => e.level === 'warn').length;
  const err = all.filter((e) => e.level === 'error').length;
  // On a first visit there is no "last visit", so nothing is marked as new and the sentence about it is not shown.
  const fresh = seen ? all.filter((e) => (e.level === 'warn' || e.level === 'error') && e.ts > seen).length : 0;
  const filtered = kind !== 'all' || level !== 'all';

  const LEVELS = [
    { value: 'all', label: t('op.logs.level.all') }, { value: 'debug', label: 'DEBUG' }, { value: 'info', label: t('op.logs.level.info') },
    { value: 'warn', label: t('op.logs.level.warn') }, { value: 'error', label: t('op.logs.level.error') },
  ];
  const KINDS = [{ value: 'all', label: t('op.nodelog.kind.all') }, ...kinds.map((k) => ({ value: k, label: k }))];

  const subject = (id: string | null) => {
    if (!id) return <span style={{ color: '#c4c4c6' }}>—</span>;
    return <Subject><Link to={knowledgeLookupPath(id)} title={t('op.nodelog.of', { id })}>{id}</Link></Subject>;
  };

  if (!valid) return <PageWrapper><Alert $tone="error" role="alert" data-testid="log-selection-invalid">{t('op.logs.selection_invalid')} <StyledLink to={logSelectionHref(location, { limit: null, level: null, kind: null, follow: null })}>{t('op.logs.selection_reset')}</StyledLink></Alert></PageWrapper>;

  return (
    <PageWrapper $wide>
      <TitleRow>
        <Title>{t('op.nodelog.title')}</Title>
        <SelectBox options={LEVELS} value={level} onChange={(value) => change({ level: value === 'all' ? null : value })} label={t('common.level_aria')} />
      </TitleRow>
      <Description>{t('op.nodelog.desc')} <StyledLink to="/dashboard">{t('op.nodelog.back')}</StyledLink></Description>

      <Row $gap={10}>
        <SelectBox options={KINDS} value={kind} onChange={(value) => change({ kind: value === 'all' ? null : value })} label={t('op.nodelog.kind')} prefix={t('op.nodelog.kind')} />
        <HeaderCheck title={t('op.nodelog.follow.help')}>
          <Checkbox label={t('op.nodelog.follow')} checked={follow} onChange={(e) => change({ follow: e.target.checked ? null : '0' })} />
        </HeaderCheck>
      </Row>

      {failed
        ? <QueryError error={events.error} what={t('op.nodelog.title')} retrying={events.isFetching} onRetry={() => void events.refetch()} />
        : eventRows && (
          <Summary $bad={warn + err > 0} data-testid="nodelog-summary">
            {warn + err === 0 ? t('op.nodelog.summary.clean', { n: all.length }) : t('op.nodelog.summary.bad', { n: all.length, warn, err })}
            {fresh > 0 && <Since>{t('op.nodelog.since', { n: fresh })}</Since>}
          </Summary>
        )}

      {!failed && <EventLog
        rows={rows}
        loading={authLoading || !eventRows && events.isFetching}
        fetching={events.isFetching}
        onOlder={() => change({ limit: String(limit + 200) })}
        onRefresh={() => void events.refetch()}
        empty={filtered ? t('op.nodelog.empty.filtered') : t('op.nodelog.empty')}
        footer={t('op.logs.footer_filtered', { n: limit })}
        subject={(e) => subject(e.patch_id)}
        freshAfter={seen || undefined}
      />}

      <DevBox>
        <span style={{ fontSize: 13, color: '#8d8d8f', display: 'block', marginBottom: 6 }}>{t('op.nodelog.cli')}</span>
        <MonoBox>{logCommand(level, kind, follow, limit)}</MonoBox>
      </DevBox>
    </PageWrapper>
  );
}
