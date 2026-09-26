/**
 * Hosted agents — an agent the node runs for somebody, built from a model page — read and written defensively.
 *
 * The node grew `/api/hosted-agents` (spec: ainize-node `docs/superpowers/specs/2026-09-26-hosted-agents-design.md`)
 * and this app is released on its own schedule, so everything here is written for the node on the OTHER end being
 * older or newer than this build:
 *
 *   • An agent row from an older node has no `model`, `kind`, `owner` or `status`. Those are read one at a time and
 *     become `null` when absent or malformed — never a guessed default. A row whose kind nobody sent is not an
 *     "upstream" agent; it is one this page knows nothing more about, and the badges simply do not appear.
 *   • `?model=` is a filter an older node ignores and answers with every agent it has. The model page would then
 *     say every agent was built on this model, so the rows are filtered again here by the field itself.
 *   • Errors arrive as `{ error: { code, message } }` from the new routes, as `{ error: "text" }` from older ones,
 *     and as no JSON at all from a proxy or an Express 404 page. `hostedAgentApiErrorOf` folds all three into one
 *     shape so the form can say *which* refusal it got (id taken, limit reached, Docker off) instead of "400".
 *
 * Everything in this file is pure: no React, no fetch. The pages call it and `test/hosted-agents-api.test.ts` pins it.
 */
import type { AgentSummary } from './types';
import type { PublicModelCard } from './models';

// ─────────────────────────────────────────────────────────────── the agent row's new fields

/** How an agent is run. `upstream` is one an operator pointed at in config; the other three are hosted specs. */
export type HostedAgentKind = 'upstream' | 'prompt' | 'tools' | 'handler';
/** A code agent's image: `building` until the node has built it, then `ready` or `failed`. Prompt agents are `ready`. */
export type HostedAgentBuildStatus = 'building' | 'ready' | 'failed';

export const HOSTED_AGENT_KINDS: readonly HostedAgentKind[] = ['upstream', 'prompt', 'tools', 'handler'];
export const HOSTED_AGENT_BUILD_STATUSES: readonly HostedAgentBuildStatus[] = ['building', 'ready', 'failed'];

/** The four fields a newer node adds to an `/api/agents` row, each `null` when this node did not send it. */
export interface AgentSummaryHostedFields {
  model: string | null;
  kind: HostedAgentKind | null;
  /** Lower-cased, so it compares against a signed-in address without anybody remembering to lower-case it. */
  owner: string | null;
  status: HostedAgentBuildStatus | null;
}

const oneOf = <T extends string>(list: readonly T[], value: unknown): T | null =>
  typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : null;

/** Read the optional hosted-agent fields off a row, whatever node sent it. */
export function agentSummaryHostedFieldsOf(agent: AgentSummary | Record<string, unknown> | null | undefined): AgentSummaryHostedFields {
  const row = (agent ?? {}) as Record<string, unknown>;
  return {
    model: typeof row.model === 'string' && row.model ? row.model : null,
    kind: oneOf(HOSTED_AGENT_KINDS, row.kind),
    owner: typeof row.owner === 'string' && row.owner ? row.owner.toLowerCase() : null,
    status: oneOf(HOSTED_AGENT_BUILD_STATUSES, row.status),
  };
}

/**
 * Is the signed-in address the one that created this agent?
 *
 * Case-insensitive on both sides: an EVM address is the same address in any case, and a checksum-cased one from a
 * wallet must not lock its own owner out of the edit button. A missing side is never a match — no owner on the row
 * means an older node or a config agent, and nobody signed in owns nothing.
 */
export function isHostedAgentOwnedBy(owner: string | null | undefined, subject: string | null | undefined): boolean {
  if (!owner || !subject) return false;
  return owner.toLowerCase() === subject.toLowerCase();
}

/**
 * The agents built on one model — filtered here, not only by the node.
 *
 * An older node ignores `?model=` and returns everything, and a row without a `model` field cannot be said to be
 * built on anything. Both would otherwise land on the model page as "built on this model".
 */
export function agentsBuiltOnModel(agents: AgentSummary[] | null | undefined, modelId: string): AgentSummary[] {
  if (!Array.isArray(agents)) return [];
  return agents.filter((a) => agentSummaryHostedFieldsOf(a).model === modelId);
}

// ─────────────────────────────────────────────────────────────── the spec, as the form sends it

export type HostedAgentMode = 'prompt' | 'tools' | 'handler';
export const HOSTED_AGENT_MODES: readonly HostedAgentMode[] = ['prompt', 'tools', 'handler'];
/** Modes that ship code and therefore need Docker on the node. */
export const isHostedAgentCodeMode = (mode: HostedAgentMode): boolean => mode !== 'prompt';

/** The node's `agentIdOk`. The same rule on both ends, so the form refuses what the node would refuse. */
export const HOSTED_AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** Secret names are environment variables inside the container — hence upper-case with underscores. */
export const HOSTED_AGENT_SECRET_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
/** The node's caps (spec §Concepts). Mirrored for the form, which is not the authority — the node still checks. */
export const HOSTED_AGENT_LIMITS = { name: 80, description: 500, systemPrompt: 8000, filesBytes: 1024 * 1024 } as const;
/** The entry file of a code agent. */
export const HOSTED_AGENT_ENTRY_FILE = 'index.mjs';

/** What POST / PUT `/api/hosted-agents` take. `skills` is left to the node's default unless a caller sets it. */
export interface HostedAgentSpecInput {
  id: string;
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  mode: HostedAgentMode;
  files: Record<string, string>;
  a2ui: boolean;
  allowedHosts: string[];
  secretNames: string[];
  skills?: { id: string; name: string; description?: string; examples?: string[] }[];
  /** The node's speech and image models, per agent. A node older than this ignores the field. */
  media?: HostedAgentMedia;
}

/** Speech in (voice notes are transcribed) and pictures out (a `generate_image` tool) — each off unless turned on. */
export interface HostedAgentMedia { transcription: boolean; image: boolean }

/** Which media this node can offer at all: a medium needs a model of that modality in `/api/models`. */
export function hostedAgentMediaServed(cards: PublicModelCard[]): HostedAgentMedia {
  return { transcription: cards.some((c) => c.modality === 'transcription'), image: cards.some((c) => c.modality === 'image') };
}

/**
 * An id from a name: "My Score Bot!" → `my-score-bot`.
 *
 * Accents fold to their base letter first (`Café` → `cafe`) because dropping them outright turns a name into
 * nonsense. Anything else outside `[a-z0-9]` becomes one hyphen, and the result is cut to 40 characters without
 * leaving a hyphen at either end. A name with no Latin letters or digits at all (a Korean name, say) yields `''`:
 * transliterating it would be a guess, and an empty id field asks the person instead of inventing one for them.
 */
export function hostedAgentIdFromName(name: string): string {
  return name
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

/**
 * Ids the node would accept but this site cannot show: `/agent/new` is the create form, so an agent called `new`
 * would have no page. Refused by the form only — the node is not this site's router.
 */
export const HOSTED_AGENT_RESERVED_IDS: readonly string[] = ['new'];

export const isHostedAgentIdValid = (id: string): boolean => HOSTED_AGENT_ID_PATTERN.test(id) && !HOSTED_AGENT_RESERVED_IDS.includes(id);
export const isHostedAgentSecretNameValid = (name: string): boolean => HOSTED_AGENT_SECRET_NAME_PATTERN.test(name);

/**
 * The allowed-hosts box, as a list: commas, spaces and new lines all separate, case folds, duplicates go.
 *
 * People paste lists in every shape; the node wants one. Validation of each entry (a bare host, `*.example.com`,
 * or `*`) stays on the node, which is the one enforcing it at egress time.
 */
export function hostedAgentAllowedHostsFromText(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\s,]+/)) {
    const host = raw.trim().toLowerCase();
    if (host && !out.includes(host)) out.push(host);
  }
  return out;
}

/**
 * Which models an agent can be built on: chat models only, since the runtime talks to its model as a chat.
 *
 * The prefilled one (`?model=`) is kept even when the list does not carry it — an older node that has no
 * `/api/models`, or one whose list failed — so a person arriving from a model page is never shown a form that
 * silently switched their model to another one.
 */
export function chatModelsForHostedAgent(cards: PublicModelCard[], prefilled?: string | null): PublicModelCard[] {
  const chat = cards.filter((c) => c.modality === 'chat');
  if (prefilled && !chat.some((c) => c.id === prefilled) && !cards.some((c) => c.id === prefilled)) {
    return [{ id: prefilled, modality: 'chat', available: false }, ...chat];
  }
  return chat;
}

/** One secret row in the form: a name, a value to send (empty = leave as is), and whether the node holds one. */
export interface HostedAgentSecretDraft { name: string; value: string; set: boolean }

/** Everything the create / edit form holds. Kept flat so one reducer-free `useState` can carry it. */
export interface HostedAgentFormDraft {
  id: string;
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  mode: HostedAgentMode;
  code: string;
  packageJson: string;
  a2ui: boolean;
  mediaTranscription: boolean;
  mediaImage: boolean;
  allowedHostsText: string;
  secrets: HostedAgentSecretDraft[];
}

/** A field the form marks, with the dictionary key of the sentence it shows. */
export interface HostedAgentFormProblem { field: keyof HostedAgentFormDraft | 'files'; key: string }

const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length;

/**
 * What the form refuses before it sends anything — the same rules the node applies, in the words of the field.
 *
 * Returns dictionary keys rather than sentences so this stays pure and testable; the page translates them.
 */
export function hostedAgentFormProblems(draft: HostedAgentFormDraft): HostedAgentFormProblem[] {
  const problems: HostedAgentFormProblem[] = [];
  if (!draft.name.trim()) problems.push({ field: 'name', key: 'agentCreate.err.name_required' });
  else if (draft.name.trim().length > HOSTED_AGENT_LIMITS.name) problems.push({ field: 'name', key: 'agentCreate.err.name_long' });
  if (!isHostedAgentIdValid(draft.id)) problems.push({ field: 'id', key: 'agentCreate.err.id_format' });
  if (draft.description.length > HOSTED_AGENT_LIMITS.description) problems.push({ field: 'description', key: 'agentCreate.err.description_long' });
  if (!draft.model) problems.push({ field: 'model', key: 'agentCreate.err.model_required' });
  if (draft.systemPrompt.length > HOSTED_AGENT_LIMITS.systemPrompt) problems.push({ field: 'systemPrompt', key: 'agentCreate.err.prompt_long' });
  if (draft.mode === 'prompt' && !draft.systemPrompt.trim()) problems.push({ field: 'systemPrompt', key: 'agentCreate.err.prompt_required' });
  if (isHostedAgentCodeMode(draft.mode)) {
    if (!draft.code.trim()) problems.push({ field: 'code', key: 'agentCreate.err.code_required' });
    if (draft.packageJson.trim()) {
      try { JSON.parse(draft.packageJson); } catch { problems.push({ field: 'packageJson', key: 'agentCreate.err.package_json' }); }
    }
    if (utf8Bytes(draft.code) + utf8Bytes(draft.packageJson) > HOSTED_AGENT_LIMITS.filesBytes) problems.push({ field: 'files', key: 'agentCreate.err.files_large' });
  }
  const names = draft.secrets.map((s) => s.name.trim()).filter(Boolean);
  if (names.some((n) => !isHostedAgentSecretNameValid(n))) problems.push({ field: 'secrets', key: 'agentCreate.err.secret_name' });
  if (new Set(names).size !== names.length) problems.push({ field: 'secrets', key: 'agentCreate.err.secret_duplicate' });
  return problems;
}

/**
 * The request body, from the form.
 *
 * `files` is empty for a prompt agent — sending the template a person never meant to ship would make the node
 * store code for an agent that has none. `package.json` is only sent when there is one.
 */
export function hostedAgentSpecInputFromDraft(draft: HostedAgentFormDraft): HostedAgentSpecInput {
  const files: Record<string, string> = {};
  if (isHostedAgentCodeMode(draft.mode)) {
    files[HOSTED_AGENT_ENTRY_FILE] = draft.code;
    if (draft.packageJson.trim()) files['package.json'] = draft.packageJson;
  }
  return {
    id: draft.id,
    name: draft.name.trim(),
    description: draft.description.trim(),
    model: draft.model,
    systemPrompt: draft.systemPrompt,
    mode: draft.mode,
    files,
    a2ui: draft.a2ui,
    allowedHosts: hostedAgentAllowedHostsFromText(draft.allowedHostsText),
    secretNames: draft.secrets.map((s) => s.name.trim()).filter(Boolean),
    // Always sent: the node replaces the whole spec on PUT, so leaving it out would turn both off on every save.
    media: { transcription: draft.mediaTranscription, image: draft.mediaImage },
  };
}

/** The secrets to PUT after a save: only rows with a value typed in. An empty value means "keep what is stored". */
export function hostedAgentSecretsToSend(draft: HostedAgentFormDraft): { name: string; value: string }[] {
  return draft.secrets
    .map((s) => ({ name: s.name.trim(), value: s.value }))
    .filter((s) => s.name && s.value);
}

// ─────────────────────────────────────────────────────────────── what the node sends back

/** `GET /api/hosted-agents/:id` for the owner: the stored spec plus which secrets have a value. */
export interface HostedAgentSpecView extends HostedAgentSpecInput {
  owner: string | null;
  version: number | null;
  status: HostedAgentBuildStatus | null;
  secrets: { name: string; set: boolean }[];
}

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/**
 * Read a stored spec. Accepts the spec bare or wrapped as `{ agent: … }` / `{ spec: … }`, because a create answers
 * `{ agent, a2a_url, card_url }` and a route that later grows fields should not break the edit page. `null` when
 * there is nothing recognisable — no id, or an unknown mode — so the page says "could not read" rather than
 * rendering a form that would overwrite the stored agent with blanks.
 */
export function parseHostedAgentSpecResponse(raw: unknown): HostedAgentSpecView | null {
  if (!raw || typeof raw !== 'object') return null;
  const outer = raw as Record<string, unknown>;
  const inner = (outer.agent && typeof outer.agent === 'object' ? outer.agent : outer.spec && typeof outer.spec === 'object' ? outer.spec : outer) as Record<string, unknown>;
  const id = str(inner.id);
  const mode = oneOf(HOSTED_AGENT_MODES, inner.mode);
  if (!id || !mode) return null;
  const files: Record<string, string> = {};
  if (inner.files && typeof inner.files === 'object') {
    for (const [k, v] of Object.entries(inner.files as Record<string, unknown>)) if (typeof v === 'string') files[k] = v;
  }
  const secretSource = Array.isArray(inner.secrets) ? inner.secrets : Array.isArray(outer.secrets) ? outer.secrets : [];
  const secrets: { name: string; set: boolean }[] = [];
  for (const s of secretSource as unknown[]) {
    if (s && typeof s === 'object' && typeof (s as { name?: unknown }).name === 'string') {
      secrets.push({ name: (s as { name: string }).name, set: (s as { set?: unknown }).set === true });
    }
  }
  // A name listed in `secretNames` but absent from `secrets` is a secret with no value yet, not one that vanished.
  for (const name of strList(inner.secretNames)) if (!secrets.some((s) => s.name === name)) secrets.push({ name, set: false });
  return {
    id,
    name: str(inner.name, id),
    description: str(inner.description),
    model: str(inner.model),
    systemPrompt: str(inner.systemPrompt),
    mode,
    files,
    a2ui: inner.a2ui === true,
    media: {
      transcription: (inner.media as { transcription?: unknown } | undefined)?.transcription === true,
      image: (inner.media as { image?: unknown } | undefined)?.image === true,
    },
    allowedHosts: strList(inner.allowedHosts),
    secretNames: strList(inner.secretNames),
    owner: typeof inner.owner === 'string' ? inner.owner.toLowerCase() : null,
    version: typeof inner.version === 'number' ? inner.version : null,
    status: oneOf(HOSTED_AGENT_BUILD_STATUSES, inner.status),
    secrets,
  };
}

/** The form, filled from a stored spec — the inverse of `hostedAgentSpecInputFromDraft`. */
export function hostedAgentDraftFromSpec(spec: HostedAgentSpecView): HostedAgentFormDraft {
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    model: spec.model,
    systemPrompt: spec.systemPrompt,
    mode: spec.mode,
    code: spec.files[HOSTED_AGENT_ENTRY_FILE] ?? '',
    packageJson: spec.files['package.json'] ?? '',
    a2ui: spec.a2ui,
    mediaTranscription: spec.media?.transcription === true,
    mediaImage: spec.media?.image === true,
    allowedHostsText: spec.allowedHosts.join('\n'),
    secrets: spec.secrets.map((s) => ({ name: s.name, value: '', set: s.set })),
  };
}

/** `GET /api/hosted-agents/:id/logs` → the lines, oldest first. Anything else is no lines. */
export function parseHostedAgentLogsResponse(raw: unknown): string[] {
  return strList((raw as { lines?: unknown } | null | undefined)?.lines);
}

// ─────────────────────────────────────────────────────────────── refusals

/** The refusals the hosted-agent routes name, plus `unknown` for anything this build has not heard of. */
export type HostedAgentApiErrorCode =
  | 'invalid_request' | 'not_signed_in' | 'forbidden' | 'not_found' | 'id_taken' | 'limit_reached'
  | 'docker_unavailable' | 'model_not_served' | 'offline' | 'unknown';

const KNOWN_ERROR_CODES: readonly HostedAgentApiErrorCode[] = [
  'invalid_request', 'not_signed_in', 'forbidden', 'not_found', 'id_taken', 'limit_reached', 'docker_unavailable', 'model_not_served',
];

export interface HostedAgentApiError {
  /** HTTP status, or `null` when the request never got an answer. */
  status: number | null;
  code: HostedAgentApiErrorCode;
  /** The node's own sentence when it sent one — shown verbatim, because it names the field that failed. */
  message: string | null;
}

/**
 * One shape for every way a hosted-agent call can fail.
 *
 * The code comes from the body when the node names one, and otherwise from the status — an older node or a proxy
 * that only says "409" still means the id is taken. `offline` is a request that got no answer at all.
 */
export function hostedAgentApiErrorOf(err: unknown): HostedAgentApiError {
  const e = (err ?? {}) as { status?: unknown; originalStatus?: unknown; data?: unknown; error?: unknown };
  const status = typeof e.status === 'number' ? e.status : typeof e.originalStatus === 'number' ? e.originalStatus : null;
  const body = e.data as { error?: unknown; message?: unknown } | null | undefined;
  let named: string | null = null;
  let message: string | null = null;
  if (body && typeof body === 'object') {
    if (body.error && typeof body.error === 'object') {
      const inner = body.error as { code?: unknown; message?: unknown };
      named = typeof inner.code === 'string' ? inner.code : null;
      message = typeof inner.message === 'string' ? inner.message : null;
    } else if (typeof body.error === 'string') {
      message = body.error;
    }
    if (!message && typeof body.message === 'string') message = body.message;
  }
  if (!message && typeof e.error === 'string') message = e.error;
  const known = oneOf(KNOWN_ERROR_CODES, named);
  if (known) return { status, code: known, message };
  const byStatus: Record<number, HostedAgentApiErrorCode> = {
    400: 'invalid_request', 401: 'not_signed_in', 403: 'forbidden', 404: 'not_found', 409: 'id_taken', 429: 'limit_reached', 501: 'docker_unavailable',
  };
  if (status === null) return { status, code: e.status === 'FETCH_ERROR' ? 'offline' : 'unknown', message };
  return { status, code: byStatus[status] ?? 'unknown', message };
}
