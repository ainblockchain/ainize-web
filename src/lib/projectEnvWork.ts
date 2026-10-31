/** Serialize a whole environment edit/bulk sequence. Values live only in the caller's form/request, never here. */
export function createProjectEnvWork() {
  let pending = false, unknown = false;
  const report = (error: unknown) => {
    const e = error as { status?: unknown; data?: { error?: { code?: unknown } } } | null;
    const status = e?.status, code = e?.data?.error?.code;
    if (status === 503 && code === 'secrets_off') return;
    if (typeof status !== 'number' || status < 400 || status >= 500 || typeof code !== 'string'
      || !['not_signed_in', 'not_writer', 'not_found', 'invalid_name', 'reserved_name', 'invalid_value', 'value_too_large',
        'too_many_secrets', 'invalid_request', 'not_member', 'forbidden', 'not_yet_cloned'].includes(code)) unknown = true;
  };
  return {
    blocked: () => pending || unknown,
    uncertain: () => unknown,
    report,
    async run<T>(task: () => Promise<T>): Promise<T | undefined> {
      if (pending || unknown) return undefined;
      pending = true;
      try { return await task(); }
      catch (error) { report(error); throw error; }
      finally { pending = false; }
    },
  };
}

export interface ProjectEnvWork {
  run<T>(task: () => Promise<T>): Promise<T | undefined>;
  report(error: unknown): void;
  active(): boolean;
  blocked(): boolean;
}
