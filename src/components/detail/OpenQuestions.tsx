import { useState } from 'react';
import styled from 'styled-components';
import { errorMessage, useCreateIssueMutation, usePatchIssuesQuery } from '@/api/api';
import type { IssueItem, IssueKind } from '@/api/types';
import { Alert, Input, Checkbox } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { num } from '@/utils/format';

/**
 * SC-12 — "What to add on top of this".
 *
 * Counts by default, wording only with consent (design §10). A row whose text the node never kept says so in place
 * of the question instead of showing an empty cell: "counted, not kept — nobody shared the wording" is the truth,
 * and a creator can still act on it, because the count and the source are the actionable part.
 *
 * The whole panel is this NODE's view, and the caption says so — another node's visitors asked other things.
 */
const Group = styled.div`margin-top: 16px; &:first-of-type { margin-top: 8px; }`;
const GroupTitle = styled.h4`margin: 0 0 6px; font-size: 13px; font-weight: 700; color: ${(p) => p.theme.color.BLACK};`;
const Items = styled.ul`
  margin: 0; padding: 0; list-style: none; display: grid; gap: 6px;
  li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; font-size: 13px; color: ${(p) => p.theme.color.DARK_GREY};
    padding: 8px 10px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; background: #fff; }
  li .q { flex: 1 1 240px; min-width: 0; word-break: break-word; }
  li .q.dim { color: ${(p) => p.theme.color.GREY}; font-style: italic; }
  li .n { font-variant-numeric: tabular-nums; color: ${(p) => p.theme.color.GREY}; font-size: 12px; }
  li .covered { font-size: 12px; color: #1e6b36; }
`;
const TeachLink = styled.a`font-size: 12px; font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; &:hover { text-decoration: underline; }`;
const Caption = styled.div`font-size: 12px; color: ${(p) => p.theme.color.GREY}; margin-top: 10px;`;
const AskRow = styled.form`display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 12px; input { flex: 1 1 260px; }`;

const ORDER: IssueKind[] = ['own_miss', 'preflight', 'free_wrong', 'request', 'gap'];

export function OpenQuestions({ id, totalQuestions, canBuildOn }: { id: string; totalQuestions: number; canBuildOn: boolean }) {
  const { t } = useT();
  const { data } = usePatchIssuesQuery({ id, limit: 100 });
  const [ask, { isLoading: asking, error: askError, data: asked, reset }] = useCreateIssueMutation();
  const [text, setText] = useState('');
  const [share, setShare] = useState(false);
  if (!data) return null;
  const byKind = new Map<IssueKind, IssueItem[]>();
  for (const i of data.items) byKind.set(i.kind, [...(byKind.get(i.kind) ?? []), i]);

  const title = (k: IssueKind, list: IssueItem[]) => {
    const kSum = list.reduce((n, x) => n + x.count, 0);
    const people = Math.max(0, ...list.map((x) => x.people));
    switch (k) {
      case 'own_miss': return t('detail.missing.own', { k: num(list.length), total: num(totalQuestions) });
      case 'preflight': return t('detail.missing.preflight', { k: num(list.length), u: num(people), clusters: '' }).replace(/:\s*$/, '');
      case 'free_wrong': return t('detail.missing.free', { k: num(list.length), shared: num(list.filter((x) => x.text).length) });
      case 'request': return t('detail.missing.requests', { k: num(list.length) });
      default: return t('detail.missing.gap', { topic: list[0]?.topic ?? '—', k: num(kSum) });
    }
  };

  return (
    <div data-testid="open-questions">
      {data.items.length === 0 && <Empty data-testid="missing-empty">{t('detail.missing.empty')}</Empty>}
      {ORDER.filter((k) => byKind.has(k)).map((k) => (
        <Group key={k} data-testid={`missing-${k}`}>
          <GroupTitle>{title(k, byKind.get(k)!)}</GroupTitle>
          <Items>
            {byKind.get(k)!.map((i) => (
              <li key={i.id} data-testid={`issue-${i.id}`}>
                <span className={i.text ? 'q' : 'q dim'}>{i.text ?? t('detail.missing.hidden')}</span>
                <span className="n">{t('detail.missing.count', { c: num(i.count) })}</span>
                {i.covered_by && <span className="covered">{t('detail.missing.covered', { child: i.covered_by })}</span>}
                {/* AZ-260: the base is preselected and the question travels with it, so the creator lands ready to teach it */}
                {canBuildOn && !i.covered_by && (
                  <TeachLink href={`/chat/${encodeURIComponent(id)}?teach=1${i.text ? `&q=${encodeURIComponent(i.text)}` : ''}`} data-testid="teach-on-top">{t('detail.missing.teach')} →</TeachLink>
                )}
              </li>
            ))}
          </Items>
        </Group>
      ))}
      <Caption>{t('detail.missing.scope')}</Caption>
      <AskRow onSubmit={(e) => { e.preventDefault(); if (text.trim()) void ask({ id, text: text.trim(), share }).unwrap().then(() => setText('')).catch(() => undefined); }}>
        <Input value={text} onChange={(e) => { setText(e.target.value); reset(); }} placeholder={t('detail.missing.ask_placeholder')} aria-label={t('detail.missing.request')} data-testid="ask-input" maxLength={400} />
        <Checkbox checked={share} onChange={(e) => setShare(e.target.checked)} label={t('detail.missing.ask_share')} />
        <Button type="submit" disabled={asking || !text.trim()} data-testid="ask-send">{t('detail.missing.ask_send')}</Button>
      </AskRow>
      {asked && <Alert $tone="success" style={{ marginTop: 8 }} data-testid="ask-done">{t('detail.missing.ask_done', { c: num(asked.count) })}</Alert>}
      {!!askError && <Alert $tone="error" style={{ marginTop: 8 }}>{errorMessage(askError)}</Alert>}
    </div>
  );
}
