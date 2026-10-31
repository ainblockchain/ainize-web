import type { AgentSummary } from './types';
import { agentListKey } from './sharedAgents';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
const nullableText = (v: unknown) => v === null || typeof v === 'string';
const nullableNumber = (v: unknown) => v === null || typeof v === 'number' && Number.isFinite(v) && v >= 0;
const endpoint = (v: unknown): v is string => {
  if (!text(v) || /[\s\\]/.test(v) || !/^(https?:\/\/|\/(?!\/))/.test(v)) return false;
  try { const url = new URL(v, 'https://catalogue.invalid'); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
};

/** Validate the complete public list before rendering/searching it; never turn partial corruption into no results. */
export function parseAgentCatalogue(raw: unknown): AgentSummary[] | null {
  if (!object(raw) || !Array.isArray(raw.agents)) return null;
  const result: AgentSummary[] = [], seen = new Set<string>();
  for (const row of raw.agents) {
    if (!object(row) || !text(row.id) || !text(row.name) || !nullableText(row.description)
      || !Array.isArray(row.skills) || !strings(row.protocols) || !strings(row.extensions)
      || !nullableText(row.provider) || !nullableText(row.documentation_url) || !nullableText(row.error)
      || !endpoint(row.a2a_url) || !endpoint(row.card_url) || row.call_url !== undefined && !endpoint(row.call_url)
      || ![true, false, null].includes(row.reachable as boolean | null)
      || !nullableNumber(row.calls) || !nullableNumber(row.last_call_at) || !nullableNumber(row.last_checked)
      || ['model', 'owner', 'alias', 'org_id'].some(k => row[k] !== undefined && !nullableText(row[k]))
      || row.node !== null && (!object(row.node) || !text(row.node.address) || !text(row.node.name))) return null;
    const skills: AgentSummary['skills'] = [], skillIds = new Set<string>();
    for (const skill of row.skills) {
      if (!object(skill) || !text(skill.id) || !text(skill.name) || skillIds.has(skill.id)
        || skill.description !== undefined && typeof skill.description !== 'string'
        || skill.tags !== undefined && !strings(skill.tags) || skill.examples !== undefined && !strings(skill.examples)) return null;
      skillIds.add(skill.id);
      skills.push({ id: skill.id, name: skill.name, description: skill.description as string | undefined, tags: skill.tags as string[] ?? [], examples: skill.examples as string[] ?? [] });
    }
    const agent = { ...row, skills } as unknown as AgentSummary;
    const key = agentListKey(agent);
    if (seen.has(key)) return null;
    seen.add(key); result.push(agent);
  }
  return result;
}
