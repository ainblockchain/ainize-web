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
  version?: string;
  mimeType?: string;
  catalogId?: string;
  components: Map<string, A2UIComponent>;
  data: unknown;
}

/** An A2A part that carries an A2UI message, in either protocol spelling. */
type Part = {
  kind?: string;
  data?: Record<string, unknown> | Record<string, unknown>[];
  metadata?: { mimeType?: string };
  content?: { $case?: string; value?: unknown };
  mediaType?: string;
};

const isA2UIPart = (p: Part) =>
  [A2UI_MIME, 'application/a2ui+json'].includes(p?.metadata?.mimeType ?? p?.mediaType ?? '');

const payloadsOf = (part: Part): Record<string, unknown>[] => {
  const value = part.content?.$case === 'data' ? part.content.value : part.kind === 'data' ? part.data : null;
  return (Array.isArray(value) ? value : [value]).filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item));
};

/** Each surface owns its component ids and data model; messages for another surface never mix into it. */
export function readSurfaces(parts: Part[] | undefined): A2UISurfaceData[] {
  const surfaces = new Map<string, A2UISurfaceData>();
  let currentId = 'main';
  for (const part of Array.isArray(parts) ? parts : []) {
    if (!isA2UIPart(part)) continue;
    for (const message of payloadsOf(part)) {
      const create = (message.createSurface ?? message.beginRendering) as { surfaceId?: string; catalogId?: string } | undefined;
      const update = (message.updateComponents ?? message.surfaceUpdate) as { surfaceId?: string; components?: A2UIComponent[] } | undefined;
      const model = (message.updateDataModel ?? message.dataModelUpdate) as { surfaceId?: string; path?: string; value?: unknown } | undefined;
      const removed = message.deleteSurface as { surfaceId?: string } | undefined;
      if (removed?.surfaceId) { surfaces.delete(removed.surfaceId); continue; }
      const id = create?.surfaceId ?? update?.surfaceId ?? model?.surfaceId ?? currentId;
      if (typeof id !== 'string' || !id) continue;
      currentId = id;
      let surface = surfaces.get(id);
      if (!surface || create) {
        surface = { surfaceId: id, version: typeof message.version === 'string' ? message.version : message.beginRendering ? 'v0.8' : 'v0.9', mimeType: part.metadata?.mimeType ?? part.mediaType, catalogId: create?.catalogId, components: new Map(), data: {} };
        surfaces.set(id, surface);
      }
      for (const component of Array.isArray(update?.components) ? update.components : []) {
        if (component && typeof component.id === 'string' && typeof component.component === 'string') surface.components.set(component.id, component);
      }
      if (model && typeof model === 'object' && 'value' in model) surface.data = writePath(surface.data, typeof model.path === 'string' ? model.path : '/', model.value);
    }
  }
  return [...surfaces.values()].filter((surface) => surface.components.size);
}

/** Convenience for a caller that explicitly expects one surface. Multi-surface UIs use readSurfaces. */
export function readSurface(parts: Part[] | undefined): A2UISurfaceData | null {
  return readSurfaces(parts).at(-1) ?? null;
}

/** Resolve `{ path }` against the data model. Absolute paths are JSON Pointers; relative ones are item keys. */
export function resolve(value: unknown, model: unknown, item: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  const path = (value as { path?: string }).path;
  if (typeof path !== 'string') return '';
  const result = readPath(path.startsWith('/') || item === undefined ? model : item, path);
  return result === null || result === undefined ? '' : typeof result === 'object' ? JSON.stringify(result) : String(result);
}


/* ------------------------------------------------------------------ the input half */

/**
 * A surface can ask for something back.
 *
 * The basic catalog has `TextField` and `Button`, and an agent that uses them is describing its own input —
 * which is the half this renderer was missing. The marketplace used to supply the form out of its own head,
 * so every agent got the same one and the first agent's job ended up written into a page shared by all of
 * them. These three functions are what an interactive surface needs beyond drawing: read a value, write a
 * value, and work out what a pressed button carries back.
 */

/** True when the tree asks the reader for something, so a caller can tell a form from a result. */
export const isInteractive = (surface: A2UISurfaceData): boolean =>
  [...surface.components.values()].some((c) => (c.component === 'TextField' || c.component === 'ChoicePicker') || c.component === 'Button');

/** Read one JSON Pointer out of the model. Returns undefined rather than throwing on a path that is not there. */
const pointerSegments = (path: string) => path === '' || path === '/' ? [] : path.replace(/^\//, '').split('/').map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
export function bindingPath(path: string, scope: string): string {
  return path.startsWith('/') ? path : `${scope}/${path}`;
}
export function readPath(model: unknown, path: string): unknown {
  let current: unknown = model;
  for (const key of pointerSegments(path)) {
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, key)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Copy the path, preserving arrays and escaped JSON Pointer keys, without changing the original model. */
export function writePath<T>(model: T, path: string, value: unknown): T {
  const segments = pointerSegments(path);
  const write = (current: unknown, index: number): unknown => {
    if (index === segments.length) return value;
    const key = segments[index];
    const previous = current && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, key) ? (current as Record<string, unknown>)[key] : undefined;
    const next = write(previous, index + 1);
    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/.test(key)) return current;
      const copy = [...current]; copy[Number(key)] = next; return copy;
    }
    return { ...(current && typeof current === 'object' ? current : {}), [key]: next };
  };
  return write(model, 0) as T;
}

/** What a pressed Button sends back: the action's name and its context with every `{path}` read from the model. */
export function actionPayload(
  action: unknown,
  model: unknown,
  item?: unknown,
): { name: string; context: Record<string, unknown> } | null {
  const event = (action as { event?: { name?: unknown; context?: unknown } } | null)?.event;
  if (!event || typeof event.name !== 'string' || !event.name.trim()) return null;
  const context: Record<string, unknown> = {};
  for (const [k, v] of Object.entries((event.context ?? {}) as Record<string, unknown>)) {
    // "Values can be literals or paths" — a literal is carried as it is, a binding is read at press time
    const path = (v as { path?: unknown })?.path;
    context[k] = typeof path === 'string' ? readPath(path.startsWith('/') || item === undefined ? model : item, path) : v;
  }
  return { name: event.name, context };
}

/**
 * An agent wrote this address, and an agent may be operated by anyone.
 *
 * `javascript:` and `data:` in an href run as the page, which is the whole site's session; a link is the one
 * place a surface can reach out of its own box. Two schemes are allowed, and anything else draws as text —
 * visible, unclickable, and honest about why.
 */
export function safeHref(url: unknown): string | null {
  const raw = String(url ?? '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/** A form needs an actual server event button; fields alone must not hide the ordinary send control. */
export const hasSurfaceAction = (surface: A2UISurfaceData): boolean =>
  [...surface.components.values()].some((component) => component.component === 'Button' && !!actionPayload(component.action, surface.data));
