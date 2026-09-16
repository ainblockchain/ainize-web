/**
 * Draws an A2UI surface. The reading half is `surface.ts`, which is pure and tested; this file is the
 * React half and holds only what a browser needs.
 *
 * It draws the subset of the basic catalog the agent actually emits — Column, Row, Card, Text, Divider,
 * List — and says so plainly when it meets a component it does not know, rather than dropping it. A silent
 * omission in a score card is worse than a visible gap: the reader cannot tell that something is missing.
 *
 * It never renders raw HTML. The surface arrives from an agent, which may be operated by anyone; every
 * value goes through React as text.
 */
import styled from 'styled-components';
import { resolve, type A2UIComponent, type A2UISurfaceData } from './surface';

export { A2UI_MIME, readSurface } from './surface';
export type { A2UIComponent, A2UISurfaceData } from './surface';

const Col = styled.div`display: flex; flex-direction: column; gap: 8px;`;
const RowBox = styled.div`display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap;`;
const CardBox = styled.div`
  background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; padding: 16px 20px;
`;
const Rule = styled.hr`border: none; border-top: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; margin: 8px 0; width: 100%;`;
const Unknown = styled.div`
  font-size: 12px; color: ${(p) => p.theme.color.GREY}; font-family: ${(p) => p.theme.font.mono};
  border: 1px dashed ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; padding: 6px 10px;
`;
const H1 = styled.div`font-size: 28px; font-weight: 800;`;
const H2 = styled.div`font-size: 18px; font-weight: 700;`;
const H3 = styled.div`font-size: 14px; font-weight: 700;`;
const Body = styled.div`font-size: 14px; line-height: 1.6;`;

function Node({ id, surface, item, seen }: { id: string; surface: A2UISurfaceData; item?: unknown; seen: Set<string> }) {
  const c = surface.components.get(id);
  if (!c) return <Unknown>missing component “{id}”</Unknown>;
  // A cycle in an agent-authored tree must not take the page down with it.
  if (seen.has(id)) return <Unknown>cycle at “{id}”</Unknown>;
  const next = new Set(seen).add(id);

  const kids = Array.isArray(c.children) ? c.children : [];
  const renderKids = () => kids.map((k) => <Node key={k} id={k} surface={surface} item={item} seen={next} />);

  switch (c.component) {
    case 'Column':
      return <Col>{renderKids()}</Col>;
    case 'Row':
      return <RowBox>{renderKids()}</RowBox>;
    case 'Card':
      return (
        <CardBox>
          {c.child ? <Node id={c.child} surface={surface} item={item} seen={next} /> : renderKids()}
        </CardBox>
      );
    case 'Divider':
      return <Rule />;
    case 'Text': {
      const value = resolve(c.text, surface.data, item);
      if (c.variant === 'h1') return <H1>{value}</H1>;
      if (c.variant === 'h2') return <H2>{value}</H2>;
      if (c.variant === 'h3') return <H3>{value}</H3>;
      return <Body>{value}</Body>;
    }
    case 'List': {
      // A template child draws one copy per item of the bound array; that is what keeps the tree
      // fixed-size regardless of how many references a score compared against.
      const tpl = (c.children as { template?: { dataPath?: string; componentId?: string } })?.template;
      if (!tpl?.componentId) return <Col>{renderKids()}</Col>;
      const raw = resolve({ path: tpl.dataPath ?? '/' }, surface.data, item);
      const arr = (() => {
        const segments = (tpl.dataPath ?? '').replace(/^\//, '').split('/').filter(Boolean);
        let cur: unknown = surface.data;
        for (const s of segments) cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[s] : undefined;
        return Array.isArray(cur) ? cur : [];
      })();
      void raw;
      return (
        <Col>
          {arr.map((it, i) => (
            <Node key={i} id={tpl.componentId!} surface={surface} item={it} seen={next} />
          ))}
        </Col>
      );
    }
    default:
      return <Unknown>{c.component} — this renderer does not draw that component yet</Unknown>;
  }
}

/** Draw a surface. `root` is the id convention v0.9 uses. */
export function A2UISurface({ surface }: { surface: A2UISurfaceData }) {
  const rootId = surface.components.has('root') ? 'root' : [...surface.components.keys()][0];
  return <Node id={rootId} surface={surface} seen={new Set()} />;
}

export default A2UISurface;
