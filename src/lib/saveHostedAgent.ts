import { createWithFreeAgentId } from '../api/agentIds';
import { hostedAgentApiErrorOf, type HostedAgentSpecInput } from '../api/hostedAgents';

/** Remember a successful spec write before uploading secrets, so retry never creates another agent. */
export async function saveHostedAgent(options: {
  body: HostedAgentSpecInput;
  savedId: string | null;
  suggestedId: boolean;
  secrets: { name: string; value: string }[];
  active: () => boolean;
  create: (body: HostedAgentSpecInput) => Promise<unknown>;
  update: (body: HostedAgentSpecInput) => Promise<unknown>;
  setSecret: (secret: { id: string; name: string; value: string }) => Promise<unknown>;
  onSaved: (id: string) => void;
}): Promise<{ id: string; failed: string[] } | null> {
  const { active } = options;
  if (!active()) return null;
  let body = options.savedId ? { ...options.body, id: options.savedId } : options.body;
  if (options.savedId) await options.update(body);
  else if (options.suggestedId) {
    body = await createWithFreeAgentId(body, (attempt) => {
      if (!active()) throw new Error('Agent editor closed');
      return options.create(attempt);
    }, (error) => active() && hostedAgentApiErrorOf(error).code === 'id_taken');
  } else await options.create(body);
  if (!active()) return null;
  options.onSaved(body.id);
  const failed: string[] = [];
  for (const secret of options.secrets) {
    if (!active()) return null;
    try { await options.setSecret({ ...secret, id: body.id }); }
    catch { failed.push(secret.name); }
  }
  return active() ? { id: body.id, failed } : null;
}
