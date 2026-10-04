import { linkedAgentDraftFromView, type LinkedAgentFormDraft, type LinkedAgentView } from '../api/linkedAgents';

export const EMPTY_LINKED_AGENT_DRAFT: LinkedAgentFormDraft = {
  id: '', name: '', description: '', upstream: '', visibility: 'public', orgId: null,
};

/** Initialize once per form mount. null means an edit is still waiting for its own record. */
export function initializeLinkedAgentDraft(
  current: LinkedAgentFormDraft | null,
  editId: string | undefined,
  view: LinkedAgentView | null,
  presetOrg: string | null,
): LinkedAgentFormDraft | null {
  if (current) return current;
  if (editId) return view?.id === editId ? linkedAgentDraftFromView(view) : null;
  return presetOrg
    ? { ...EMPTY_LINKED_AGENT_DRAFT, visibility: 'org', orgId: presetOrg }
    : { ...EMPTY_LINKED_AGENT_DRAFT };
}
