/**
 * Reads an A2UI surface out of an A2A reply (A2UI v0.9, carried over the A2A extension).
 *
 * An agent that answers with prose makes every client parse it back; one that answers with A2UI describes
 * the surface once and each client draws it natively. This is the drawing half for the explorer.
 *
 * ## The three messages
 *
 * `createSurface` says which catalog and which surface. `updateComponents` is a FLAT list of components
 * addressed by id — children are id references, never inline — so the tree is assembled here rather than
 * arriving nested. `updateDataModel` supplies the values; components point at them by JSON Pointer, which
 * is why the same tree re-renders when only data changes.
 *
 * ## What this renderer will not do
 *
 * It draws the subset of the basic catalog the agent actually emits — Column, Row, Card, Text, Divider,
 * List — and says so plainly when it meets a component it does not know, rather than dropping it. A silent
 * omission in a score card is worse than a visible gap: the reader cannot tell that something is missing.
 *
 * This module is PURE — no React, no styled-components — because the half that can silently produce an
 * empty frame is the parsing, and that half has to be testable without a browser. `A2UISurface.tsx` draws
 * what this returns.
 */

export const A2UI_MIME = 'application/json+a2ui';

/** One component as `updateComponents` sends it: a flat record addressed by `id`. */
export interface A2UIComponent {
  id: string;
  component: string;
  text?: unknown;
  variant?: string;
  children?: string[] | { template?: { dataPath?: string; componentId?: string } };
  child?: string;
  [k: string]: unknown;
}

export interface A2UISurfaceData {
  surfaceId: string;
  catalogId?: string;
  components: Map<string, A2UIComponent>;
  data: unknown;
}

/** An A2A part that carries an A2UI message, in either protocol spelling. */
type Part = {
  kind?: string;
  data?: Record<string, unknown>;
  metadata?: { mimeType?: string };
  content?: { $case?: string; value?: unknown };
  mediaType?: string;
};

const isA2UIPart = (p: Part) =>
  p?.metadata?.mimeType === A2UI_MIME || p?.mediaType === A2UI_MIME;

const payloadOf = (p: Part): Record<string, unknown> | null => {
  if (p.content?.$case === 'data' && p.content.value && typeof p.content.value === 'object') {
    return p.content.value as Record<string, unknown>;
  }
  return p.kind === 'data' && p.data ? p.data : null;
};

/**
 * Collect the A2UI messages out of a reply's parts into one surface.
 *
 * Returns null when there are none, which is the ordinary case for an agent that does not speak A2UI — the
 * caller falls back to the text part rather than showing an empty frame.
 */
export function readSurface(parts: Part[] | undefined): A2UISurfaceData | null {
  const messages = (parts ?? []).filter(isA2UIPart).map(payloadOf).filter(Boolean) as Record<string, unknown>[];
  if (!messages.length) return null;

  const components = new Map<string, A2UIComponent>();
  let surfaceId = 'main';
  let catalogId: string | undefined;
  let data: unknown = {};

  for (const m of messages) {
    const create = m.createSurface as { surfaceId?: string; catalogId?: string } | undefined
      ?? m.beginRendering as { surfaceId?: string; catalogId?: string } | undefined;
    if (create) {
      surfaceId = create.surfaceId ?? surfaceId;
      catalogId = create.catalogId;
    }
    const update = (m.updateComponents ?? m.surfaceUpdate) as { components?: A2UIComponent[] } | undefined;
    for (const c of update?.components ?? []) if (c?.id) components.set(c.id, c);

    const model = (m.updateDataModel ?? m.dataModelUpdate) as { path?: string; value?: unknown } | undefined;
    if (model && 'value' in model) {
      // A root write replaces the model; anything else is ignored for now rather than merged wrongly.
      if (!model.path || model.path === '/' || model.path === '') data = model.value;
    }
  }
  return components.size ? { surfaceId, catalogId, components, data } : null;
}

/** Resolve `{ path }` against the data model. Absolute paths are JSON Pointers; relative ones are item keys. */
export function resolve(value: unknown, model: unknown, item: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  const path = (value as { path?: string }).path;
  if (typeof path !== 'string') return '';
  const from = path.startsWith('/') ? model : item;
  const segments = path.replace(/^\//, '').split('/').filter(Boolean);
  let cur: unknown = from;
  for (const s of segments) {
    if (cur === null || typeof cur !== 'object') return '';
    cur = (cur as Record<string, unknown>)[s];
  }
  return cur === null || cur === undefined ? '' : String(cur);
}

