/**
 * The person's AinCode sessions across their workspaces (AinCode gateway `GET /code/_aincode/sessions`), grouped the
 * way the AinCode page shows them: workspace (organization first, then personal) → repository → sessions.
 * Pure — `test/aincode-sessions.test.ts` pins it.
 */
export type AinCodeWorkspace = {
  kind: 'personal' | 'organization';
  org?: { id: string; name: string; role: string };
  base: string;
  running: boolean;
  newSessionUrl: string;
};
export type AinCodeSession = {
  workspace: string; // 'personal' or an organization id
  id: string;
  title: string;
  directory: string;
  workingDirectory: string;
  repo?: { org: string; name: string; aindriveUrl: string; projectPageUrl?: string };
  branch?: string;
  updatedAt: number;
  status: 'working' | 'idle' | 'unknown';
  openUrl: string;
};
export type AinCodeOverview = { workspaces: AinCodeWorkspace[]; sessions: AinCodeSession[] };

const text = (value: unknown): value is string => typeof value === 'string';
const codePath = (value: unknown): value is string => text(value) && /^\/code(?:\/|\?|$)/.test(value) && !value.includes('\\');
const webLink = (value: unknown): value is string => {
  if (!text(value)) return false;
  try { const url = new URL(value, 'https://ainize.ai'); return ['https:', 'http:'].includes(url.protocol); } catch { return false; }
};

export function parseOverview(raw: unknown): AinCodeOverview | null {
  const body = raw as Partial<AinCodeOverview> | null;
  if (!body || !Array.isArray(body.workspaces) || !Array.isArray(body.sessions)) return null;
  const keys = new Set<string>();
  for (const w of body.workspaces) {
    if (!w || !['personal', 'organization'].includes(w.kind) || !codePath(w.base) || !codePath(w.newSessionUrl) || typeof w.running !== 'boolean') return null;
    if (w.kind === 'organization' && (!w.org || !text(w.org.id) || !w.org.id || !text(w.org.name))) return null;
    const key = w.kind === 'personal' ? 'personal' : w.org!.id;
    if (keys.has(key)) return null;
    keys.add(key);
  }
  const sessions = new Set<string>();
  for (const s of body.sessions) {
    if (!s || !text(s.id) || !s.id || !keys.has(s.workspace) || !codePath(s.openUrl) || !text(s.title) || !text(s.directory) || !text(s.workingDirectory) || !Number.isFinite(s.updatedAt) || !['working', 'idle', 'unknown'].includes(s.status)) return null;
    if (s.branch !== undefined && !text(s.branch)) return null;
    if (s.repo && (!text(s.repo.org) || !text(s.repo.name) || !webLink(s.repo.aindriveUrl) || (s.repo.projectPageUrl !== undefined && !webLink(s.repo.projectPageUrl)))) return null;
    const key = `${s.workspace}\0${s.id}`;
    if (sessions.has(key)) return null;
    sessions.add(key);
  }
  // A malformed row must not disappear into a seemingly authoritative empty list.
  return { workspaces: body.workspaces, sessions: body.sessions };
}

export type RepoGroup = { key: string; label: string; href?: string; sessions: AinCodeSession[] };
export type WorkspaceGroup = { workspace: AinCodeWorkspace; key: string; repos: RepoGroup[]; working: number };

/** A session with no repository is grouped under its folder's name. */
export function repoKey(s: AinCodeSession): { key: string; label: string; href?: string } {
  if (s.repo) return { key: `${s.repo.org}/${s.repo.name}`, label: s.repo.name, href: s.repo.projectPageUrl ?? s.repo.aindriveUrl };
  const folder = s.workingDirectory.split('/').filter(Boolean).pop() ?? s.workingDirectory;
  return { key: `dir:${s.workingDirectory}`, label: folder };
}

export function groupOverview(o: AinCodeOverview): WorkspaceGroup[] {
  const ordered = [...o.workspaces].sort((a, b) => Number(a.kind === 'personal') - Number(b.kind === 'personal'));
  return ordered.map((w) => {
    const key = w.kind === 'personal' ? 'personal' : w.org!.id;
    const mine = o.sessions.filter((s) => s.workspace === key).sort((a, b) => b.updatedAt - a.updatedAt);
    const repos = new Map<string, RepoGroup>();
    for (const s of mine) {
      const r = repoKey(s);
      const g = repos.get(r.key) ?? { ...r, sessions: [] };
      g.sessions.push(s);
      repos.set(r.key, g);
    }
    return { workspace: w, key, repos: [...repos.values()], working: mine.filter((s) => s.status === 'working').length };
  });
}

/** Sessions in a personal workspace that work on an organization's repository — shown with a warning. */
export const misplaced = (s: AinCodeSession) => s.workspace === 'personal' && !!s.repo;
