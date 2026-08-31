import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import styled from 'styled-components';
import { useDocsQuery } from '@/api/api';
import type { OpenApiOperation } from '@/api/types';
import { Card, CenterProgress, CopyButton, Description, Empty, ExternalLink, PageWrapper, SubTitle, Tabs, Title, TitleRow } from '@/components/ui/Misc';
import { Alert } from '@/components/ui/Form';
import { useT } from '@/i18n';

/* ------------------------------------------------------------------ styles */
const Lede = styled.p`margin: 0 0 8px; font-size: 15px; line-height: 1.7; color: ${(p) => p.theme.color.GREY}; max-width: 76ch;`;
const OneLineGrid = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 20px;`;
const OneLine = styled(Card)`
  display: flex; flex-direction: column; gap: 10px; padding: 20px 22px;
  h3 { margin: 0; font-size: 16px; color: ${(p) => p.theme.color.BLACK}; }
  p { margin: 0; font-size: 13.5px; line-height: 1.6; color: ${(p) => p.theme.color.GREY}; }
`;
const Cmd = styled.pre`
  margin: 0; padding: 12px 14px; border-radius: 6px; background: #1f1f23; color: #e9e6f5; font-family: ${(p) => p.theme.font.mono}; font-size: 13px; line-height: 1.55; overflow-x: auto; white-space: pre-wrap; word-break: break-all;
`;
const CmdRow = styled.div`display: flex; gap: 8px; align-items: flex-start; ${Cmd} { flex: 1; }`;
const Method = styled.span<{ $m: string }>`
  display: inline-block; min-width: 56px; padding: 2px 8px; border-radius: 4px; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; font-weight: 700; text-align: center; color: #fff;
  background: ${(p) => ({ get: '#1b73e8', post: '#44a45f', patch: '#f6981d', delete: '#e6173e' }[p.$m] ?? '#8d8d8f')};
`;
const Op = styled.details`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff; border-radius: 4px; margin-top: 8px;
  summary { display: flex; gap: 12px; align-items: center; padding: 10px 14px; cursor: pointer; list-style: none; font-size: 14px; }
  summary::-webkit-details-marker { display: none; }
  summary code { font-family: ${(p) => p.theme.font.mono}; font-size: 13px; color: ${(p) => p.theme.color.BLACK}; }
  summary .sum { flex: 1; color: ${(p) => p.theme.color.GREY}; }
  .body { padding: 4px 14px 14px; font-size: 13.5px; color: ${(p) => p.theme.color.DARK_GREY}; border-top: 1px solid #f0f0f0; }
  .body h4 { margin: 12px 0 6px; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; color: ${(p) => p.theme.color.GREY}; }
  .body table { border-collapse: collapse; width: 100%; font-size: 13px; }
  .body td, .body th { text-align: left; padding: 4px 8px; border-bottom: 1px solid #f4f4f4; vertical-align: top; }
  .body th { color: ${(p) => p.theme.color.GREY}; font-weight: 500; }
  .body pre { margin: 0; padding: 10px 12px; background: #f7f7f9; border-radius: 4px; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; overflow-x: auto; }
`;
const AuthTag = styled.span`font-size: 11px; padding: 1px 8px; border-radius: 10px; background: #f5eefc; color: #5b1ca8; white-space: nowrap;`;
const GroupTitle = styled.h3`margin: 28px 0 4px; font-size: 17px; color: ${(p) => p.theme.color.BLACK};`;
const GroupDesc = styled.p`margin: 0 0 6px; font-size: 13px; color: ${(p) => p.theme.color.GREY};`;
const CliTable = styled.table`
  width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13.5px;
  td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  td:first-child { font-family: ${(p) => p.theme.font.mono}; font-size: 12.5px; white-space: pre-wrap; width: 52%; color: ${(p) => p.theme.color.BLACK}; }
  td:last-child { color: ${(p) => p.theme.color.GREY}; }
  th { text-align: left; padding: 6px 10px; font-size: 12px; font-weight: 500; letter-spacing: 0.04em; color: ${(p) => p.theme.color.GREY}; border-bottom: 1px solid rgba(0, 0, 0, 0.1); }
`;
const SchemaBox = styled.details`
  margin-top: 8px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; background: #fff;
  summary { padding: 8px 14px; cursor: pointer; font-family: ${(p) => p.theme.font.mono}; font-size: 13px; }
  pre { margin: 0; padding: 10px 14px; font-size: 12px; overflow-x: auto; background: #f7f7f9; }
`;

const METHODS = ['get', 'post', 'patch', 'delete'] as const;

export default function DocsPage() {
  const { t, locale } = useT();
  const { data, isLoading, isError } = useDocsQuery();
  const [tab, setTab] = useState<'cli' | 'api'>('cli');
  const grouped = useMemo(() => {
    if (!data) return [] as { tag: { name: string; description: string }; ops: { path: string; method: string; op: OpenApiOperation }[] }[];
    const out = data.openapi.tags.map((tag) => ({ tag, ops: [] as { path: string; method: string; op: OpenApiOperation }[] }));
    for (const [path, methods] of Object.entries(data.openapi.paths)) {
      for (const m of METHODS) {
        const op = methods[m];
        if (!op) continue;
        const g = out.find((x) => x.tag.name === op.tags?.[0]) ?? out[out.length - 1];
        g.ops.push({ path, method: m, op });
      }
    }
    return out.filter((g) => g.ops.length);
  }, [data]);

  if (isLoading) return <PageWrapper $wide><CenterProgress /></PageWrapper>;
  if (isError || !data) return <PageWrapper $wide><Alert $tone="error">{t('docs.error')}</Alert></PageWrapper>;
  const { cli, openapi, node } = data;
  const pick = (v: { ko: string; en: string }) => (locale === 'ko' ? v.ko : v.en);

  return (
    <PageWrapper $wide>
      <TitleRow><Title>{t('docs.title')}</Title></TitleRow>
      <Lede>{t('docs.lede')}</Lede>

      <SubTitle $mt={24}>{t('docs.oneline.title')}</SubTitle>
      <OneLineGrid>
        <OneLine>
          <h3>{t('docs.oneline.publish')}</h3>
          <CmdRow><Cmd>{cli.oneLiners.publish.cmd}</Cmd><CopyButton text={cli.oneLiners.publish.cmd} label={t('docs.copy')} /></CmdRow>
          <p>{t('docs.oneline.publish.help')}</p>
        </OneLine>
        <OneLine>
          <h3>{t('docs.oneline.use')}</h3>
          <CmdRow><Cmd>{cli.oneLiners.use.cmd}</Cmd><CopyButton text={cli.oneLiners.use.cmd.split('#')[0].trim()} label={t('docs.copy')} /></CmdRow>
          <p>{t('docs.oneline.use.help')}</p>
        </OneLine>
        <OneLine>
          <h3>{t('docs.oneline.test')}</h3>
          <CmdRow><Cmd>{cli.oneLiners.test.cmd}</Cmd><CopyButton text={cli.oneLiners.test.cmd} label={t('docs.copy')} /></CmdRow>
          <p>{t('docs.oneline.test.help')}</p>
        </OneLine>
        {cli.oneLiners.teach && (
          <OneLine>
            <h3>{t('docs.oneline.teach')}</h3>
            <CmdRow><Cmd>{cli.oneLiners.teach.cmd.split('#')[0].trim()}</Cmd><CopyButton text={cli.oneLiners.teach.cmd.split('#')[0].trim()} label={t('docs.copy')} /></CmdRow>
            <p>{t('docs.oneline.teach.help')} <Link to="/chat?teach=1">{t('docs.oneline.teach.cta')}</Link></p>
          </OneLine>
        )}
      </OneLineGrid>
      <SubTitle $mt={24}>{t('docs.install')}</SubTitle>
      <Cmd style={{ marginTop: 10 }}>{cli.install.join('\n')}</Cmd>

      <div style={{ marginTop: 40 }}>
        <Tabs tabs={[{ id: 'cli', label: t('docs.cli.title') }, { id: 'api', label: t('docs.api.title') }]} value={tab} onChange={(id) => setTab(id as 'cli' | 'api')} />
      </div>

      {tab === 'cli' && (
        <section>
          <Description>{t('docs.cli.lede')}</Description>
          {cli.groups.map((g) => (
            <div key={g.name}>
              <GroupTitle>{g.name}</GroupTitle>
              <CliTable><thead><tr><th>{t('docs.cli.col_cmd')}</th><th>{t('docs.cli.col_desc')}</th></tr></thead><tbody>{g.commands.map((c) => <tr key={c.cmd}><td>{c.cmd}</td><td>{c.desc}</td></tr>)}</tbody></CliTable>
            </div>
          ))}
          <SubTitle $mt={32}>{t('docs.bench.title')}</SubTitle>
          <Description>{t('docs.bench.help')}</Description>
          <Cmd style={{ marginTop: 10 }}>{JSON.stringify(cli.benchmarkExample, null, 2)}</Cmd>
        </section>
      )}

      {tab === 'api' && (
        <section>
          <Description>{t('docs.api.lede', { base: node })}<ExternalLink href="/api/openapi.json" target="_blank" rel="noopener noreferrer">/api/openapi.json</ExternalLink></Description>
          <Alert $tone="info" style={{ marginTop: 12 }}><strong>{t('docs.x402.title')}</strong><br />{t('docs.x402.steps')}</Alert>
          {grouped.length === 0 && <Empty>{t('common.empty')}</Empty>}
          {grouped.map(({ tag, ops }) => (
            <div key={tag.name}>
              <GroupTitle>{tag.name}</GroupTitle>
              <GroupDesc>{tag.description}</GroupDesc>
              {ops.map(({ path, method, op }) => (
                <Op key={method + path}>
                  <summary><Method $m={method}>{method.toUpperCase()}</Method><code>{path}</code><span className="sum">{op.summary}</span>{op.security && <AuthTag>{t('docs.api.auth')}</AuthTag>}</summary>
                  <div className="body">
                    {op.description && <p style={{ whiteSpace: 'pre-wrap' }}>{op.description}</p>}
                    {op.parameters?.length ? (<><h4>{t('docs.api.params')}</h4><table><tbody>{op.parameters.map((p) => <tr key={p.in + p.name}><th>{p.name}<br /><small>{p.in}{p.required ? ' · required' : ''}</small></th><td>{p.schema?.type}{p.schema?.enum ? ` (${p.schema.enum.join(' | ')})` : ''}{p.schema?.default !== undefined ? ` · default ${String(p.schema.default)}` : ''}</td><td>{p.description ?? ''}</td></tr>)}</tbody></table></>) : null}
                    {op.requestBody && (<><h4>{t('docs.api.body')}</h4><pre>{JSON.stringify(op.requestBody.content, null, 1)}</pre></>)}
                    {op.responses && (<><h4>{t('docs.api.responses')}</h4><table><tbody>{Object.entries(op.responses).map(([code, r]) => <tr key={code}><th>{code}</th><td>{r.description}</td></tr>)}</tbody></table></>)}
                  </div>
                </Op>
              ))}
            </div>
          ))}
          <SubTitle $mt={32}>{t('docs.api.schemas')}</SubTitle>
          {Object.entries(openapi.components.schemas).map(([name, schema]) => (
            <SchemaBox key={name}><summary>{name}</summary><pre>{JSON.stringify(schema, null, 1)}</pre></SchemaBox>
          ))}
        </section>
      )}
    </PageWrapper>
  );
}
