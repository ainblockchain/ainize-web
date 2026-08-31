import { Link } from 'react-router';
import styled from 'styled-components';
import type { CatalogEntry } from '@/api/types';
import { Certified, StatusChip } from '@/components/ui/Misc';
import { bytes, num, price, scoreText, shortAddr } from '@/utils/format';

/** Ported from ainize-web components/ui/item/DeploymentItem.js */
const Wrapper = styled(Link)`
  padding: 16px 32px;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 16px;
  background-color: ${(p) => p.theme.color.WHITE};
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  text-decoration: none;
  transition: box-shadow 0.4s ease;
  box-shadow: 0 0 0 rgba(0, 0, 0, 0.3);
  &:not(:last-child) { margin-bottom: 16px; }
  &:hover {
    box-shadow: 0 2px 6px 0 #e0e4e7, inset -1px 0 0 0 rgba(224, 227, 231, 0.3), inset 0 -1px 0 0 #e0e4e7, inset 1px 0 0 0 rgba(224, 227, 231, 0.2);
  }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 16px; }
`;

const Icon = styled.img`
  width: 56px; height: 56px; flex: none; object-fit: contain;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { width: 40px; height: 40px; }
`;

const Info = styled.div`
  display: flex; flex-direction: column; align-items: flex-start; min-width: 0; flex: 1;
`;

const NameRow = styled.div`
  display: flex; flex-direction: row; align-items: center; flex-wrap: wrap; gap: 8px;
`;

const Name = styled.div`
  font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; word-break: break-all;
  span { color: ${(p) => p.theme.color.GREY}; font-weight: 500; }
`;

const Meta = styled.div<{ $mt?: number }>`
  margin-top: ${(p) => p.$mt ?? 8}px; font-size: 12px; color: ${(p) => p.theme.color.BLACK};
  b { font-weight: 500; color: ${(p) => p.theme.color.GREY}; }
`;

const Desc = styled.div`
  margin-top: 24px; font-size: 14px; line-height: 1.5; color: ${(p) => p.theme.color.BLACK};
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
`;

const Price = styled.div`
  flex: none; font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.PRIMARY}; white-space: nowrap;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { display: none; }
`;

export function PatchListItem({ entry, currency }: { entry: CatalogEntry; currency?: string }) {
  const a = entry.anchor;
  const passing = entry.attestations.filter((x) => x.passed);
  const score = passing.length ? scoreText(passing[passing.length - 1].score) : '—';
  return (
    <Wrapper to={`/${encodeURIComponent(a.author)}/${encodeURIComponent(a.id)}`}>
      <Icon src="/static/images/ic-certified.svg" alt="" />
      <Info>
        <NameRow>
          <Name><span>{a.author_name ?? shortAddr(a.author)}/</span>{a.id}</Name>
          {entry.quorum_ok && <Certified />}
          <StatusChip status={entry.status} />
        </NameRow>
        <Meta $mt={16}><b>Model:</b> {a.model.id_M}</Meta>
        <Meta><b>Benchmark:</b> {a.benchmark.schema} ({num(a.benchmark.queries)} queries) · score {score} · {entry.passed}/{entry.quorum} attestations</Meta>
        <Meta><b>Rows:</b> {num(a.rows)} · <b>Size:</b> {bytes(a.size_bytes)} · <b>Price:</b> {price(a.price, a.currency ?? currency)} · <b>Downloads:</b> {num(entry.downloads)}</Meta>
        {a.description && <Desc>{a.description}</Desc>}
      </Info>
      <Price>{price(a.price, a.currency ?? currency)}</Price>
    </Wrapper>
  );
}
