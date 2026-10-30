/** Attempt both cookie families; a failed active session must never be reported as signed out. */
export async function signOutSessions(input: {
  nodeActive: boolean;
  googleActive: boolean;
  node: () => Promise<unknown>;
  google: () => Promise<unknown>;
}): Promise<boolean> {
  const [node, google] = await Promise.allSettled([
    Promise.resolve().then(input.node), Promise.resolve().then(input.google),
  ]);
  const ended = (result: PromiseSettledResult<unknown>) => result.status === 'fulfilled' && (result.value as { ok?: unknown } | null)?.ok === true;
  return (!input.nodeActive || ended(node)) && (!input.googleActive || ended(google));
}
