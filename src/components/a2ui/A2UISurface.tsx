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
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { actionPayload, resolve, safeHref, writePath, type A2UIComponent, type A2UISurfaceData } from './surface';

export { A2UI_MIME, readSurface, isInteractive } from './surface';
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
const Field = styled.label`
  display: flex; flex-direction: column; gap: 6px; width: 100%;
  span { font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
  textarea, input {
    width: 100%; padding: 10px 12px; font: inherit; font-size: 13px; line-height: 1.6;
    border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; background: #fff;
    &:focus-visible { outline: 2px solid ${(p) => p.theme.color.PRIMARY}; outline-offset: 1px; }
  }
  textarea { min-height: 180px; resize: vertical; }
`;
const Press = styled.button<{ $primary?: boolean }>`
  align-self: flex-start; padding: 8px 18px; border-radius: 4px; font: inherit; font-size: 13px; font-weight: 600;
  cursor: pointer; border: 1px solid ${(p) => p.theme.color.PRIMARY};
  background: ${(p) => (p.$primary ? p.theme.color.PRIMARY : '#fff')};
  color: ${(p) => (p.$primary ? '#fff' : p.theme.color.PRIMARY)};
  &:disabled { opacity: 0.5; cursor: default; }
  &:hover:not(:disabled) { filter: brightness(1.05); }
`;
const H1 = styled.div`font-size: 28px; font-weight: 800;`;
const H2 = styled.div`font-size: 18px; font-weight: 700;`;
const H3 = styled.div`font-size: 14px; font-weight: 700;`;
const Body = styled.div`font-size: 14px; line-height: 1.6;`;
const Anchor = styled.a`
  font-size: 14px; line-height: 1.6; color: ${(p) => p.theme.color.PRIMARY};
  text-decoration: underline; text-underline-offset: 2px;
  &:hover { filter: brightness(1.2); }
`;


interface Ctx {
  model: unknown;
  /** Write one bound value back, so a TextField shows what was typed. */
  set: (path: string, value: unknown) => void;
  /** What a pressed Button hands to the caller; absent means the surface is read-only. */
  act?: (name: string, context: Record<string, unknown>) => void;
  busy?: boolean;
}

function Node({ id, surface, item, seen, ctx }: { id: string; surface: A2UISurfaceData; item?: unknown; seen: Set<string>; ctx: Ctx }) {
  const c = surface.components.get(id);
  if (!c) return <Unknown>missing component “{id}”</Unknown>;
  // A cycle in an agent-authored tree must not take the page down with it.
  if (seen.has(id)) return <Unknown>cycle at “{id}”</Unknown>;
  const next = new Set(seen).add(id);

  const kids = Array.isArray(c.children) ? c.children : [];
  const renderKids = () => kids.map((k) => <Node key={k} id={k} surface={surface} item={item} seen={next} ctx={ctx} />);

  switch (c.component) {
    case 'Column':
      return <Col>{renderKids()}</Col>;
    case 'Row':
      return <RowBox>{renderKids()}</RowBox>;
    case 'Card':
      return (
        <CardBox>
          {c.child ? <Node id={c.child} surface={surface} item={item} seen={next} ctx={ctx} /> : renderKids()}
        </CardBox>
      );
    case 'Divider':
      return <Rule />;
    /**
     * The input half. An agent that sends these is describing what it wants from the reader, which is the
     * thing the marketplace used to guess: one form, written into a page shared by every agent.
     */
    case 'TextField': {
      const path = (c.value as { path?: string } | undefined)?.path;
      const value = resolve(c.value, ctx.model, item);
      const label = resolve(c.label, ctx.model, item);
      const long = c.variant === 'longText';
      const onChange = (v: string) => path && ctx.set(path, v);
      return (
        <Field>
          {label && <span>{label}</span>}
          {long
            ? <textarea value={value} disabled={ctx.busy} onChange={(e) => onChange(e.target.value)} />
            : <input type={c.variant === 'obscured' ? 'password' : c.variant === 'number' ? 'number' : 'text'}
                value={value} disabled={ctx.busy} onChange={(e) => onChange(e.target.value)} />}
        </Field>
      );
    }
    case 'Button': {
      // The action's context is read from the model AT PRESS TIME, so it carries what is in the box now.
      const payload = () => actionPayload(c.action, ctx.model);
      const p = payload();
      const empty = p ? Object.values(p.context).every((v) => v === undefined || v === null || v === '') : false;
      return (
        <Press
          type="button"
          $primary={c.variant === 'primary'}
          disabled={!ctx.act || !p || empty || ctx.busy}
          onClick={() => { const a = payload(); if (a && ctx.act) ctx.act(a.name, a.context); }}
        >
          {c.child ? <Node id={c.child} surface={surface} item={item} seen={next} ctx={ctx} /> : (c.component as string)}
        </Press>
      );
    }
    case 'Text': {
      const value = resolve(c.text, surface.data, item);
      if (c.variant === 'h1') return <H1>{value}</H1>;
      if (c.variant === 'h2') return <H2>{value}</H2>;
      if (c.variant === 'h3') return <H3>{value}</H3>;
      return <Body>{value}</Body>;
    }
    /**
     * A reference a reader can open.
     *
     * Not in the basic catalog, and it should be: a score that says it compared an article against four
     * others is asking to be checked, and "DongA Science — <headline>" as dead text is the one thing a reader
     * cannot check. `text` is what is drawn, `url` where it goes; a URL that is not http(s) draws as text.
     */
    case 'Link': {
      const label = resolve(c.text, surface.data, item);
      const href = safeHref(resolve((c as { url?: unknown }).url, surface.data, item));
      if (!href) return <Body>{label}</Body>;
      return <Anchor href={href} target="_blank" rel="noopener noreferrer">{label}</Anchor>;
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
            <Node key={i} id={tpl.componentId!} surface={surface} item={it} seen={next} ctx={ctx} />
          ))}
        </Col>
      );
    }
    default:
      return <Unknown>{c.component} — this renderer does not draw that component yet</Unknown>;
  }
}

/**
 * Draw a surface. `root` is the id convention v0.9 uses.
 *
 * The data model is held here rather than in the surface, because a form is edited: what the agent sent is
 * the starting value, and what the reader typed is what a pressed button has to carry back. `onAction` is
 * the way out — without it the buttons render disabled, which is the honest state for a surface nobody is
 * listening to.
 */
export function A2UISurface({
  surface,
  onAction,
  busy,
}: {
  surface: A2UISurfaceData;
  onAction?: (name: string, context: Record<string, unknown>) => void;
  busy?: boolean;
}) {
  const [model, setModel] = useState<unknown>(surface.data);
  // a new surface replaces the model; the same surface re-rendered must not discard what was typed into it
  useEffect(() => { setModel(surface.data); }, [surface]);
  const rootId = surface.components.has('root') ? 'root' : [...surface.components.keys()][0];
  const ctx: Ctx = {
    model,
    set: (path, value) => setModel((m: unknown) => writePath(m, path, value)),
    act: onAction,
    busy,
  };
  return <Node id={rootId} surface={surface} seen={new Set()} ctx={ctx} />;
}

export default A2UISurface;
