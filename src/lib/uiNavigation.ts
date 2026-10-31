import { readExploreSelection } from './exploreSelection';
import { isKnowledgeAuthor } from './detailRoutes';
import { looksLikeSlug } from './reservedRoutes';

export function signInHref(location: { pathname: string; search?: string; hash?: string }): string {
  return `/signing?next=${encodeURIComponent(location.pathname + (location.search ?? '') + (location.hash ?? ''))}`;
}

export function safeReturnPath(value: string | null | undefined, fallback = '/me'): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !/[\u0000-\u001f\u007f\\]/.test(value) && value.split(/[?#]/)[0]?.replace(/\/$/, '') !== '/signing' ? value : fallback;
}

export function withQuery(path: string, values: Record<string, string>): string {
  const url = new URL(path, 'https://ainize.invalid');
  for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value);
  return url.pathname + url.search + url.hash;
}

export function navigationSection(pathname: string, search = ''): 'train' | 'agents' | 'apps' | null {
  const parts = pathname.split('/').filter(Boolean);
  const first = parts[0] ?? '';
  const params = new URLSearchParams(search);
  if (first === 'explore') { const selection = readExploreSelection(params); return selection.invalid ? null : selection.kind === 'agent' ? 'agents' : 'train'; }
  if (parts.length === 2 && isKnowledgeAuthor(first) && (params.has('projectId') || params.has('project'))) return 'apps';
  if (['train', 'teach', 'teacher'].includes(first) || isKnowledgeAuthor(first) || (first === 'chat' && new URLSearchParams(search).get('teach') === '1')) return 'train';
  if (['agent', 'agents'].includes(first) || pathname === '/me/agents') return 'agents';
  if (['apps', 'projects'].includes(first) || pathname === '/me/projects' || (parts.length === 2 && looksLikeSlug(first))) return 'apps';
  return null;
}
