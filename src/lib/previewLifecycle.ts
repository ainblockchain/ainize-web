/** A preview belongs to the account and view that requested it, including a late create response. */
export function previewLifecycle<T extends { id: string }>(options: {
  create: () => Promise<T>;
  remove: (id: string) => Promise<unknown>;
  currentAccount: () => boolean;
  onCreated: (preview: T) => void;
  onStopped: () => void;
}) {
  let disposed = false;
  let pending = false;
  let id = '';
  const cleanup = async (target: string) => {
    // After an account switch, the server's TTL reclaims it; never issue a write as the next account.
    if (target && options.currentAccount()) await options.remove(target);
  };
  return {
    async start() {
      if (disposed || pending || id || !options.currentAccount()) return;
      pending = true;
      try {
        const preview = await options.create();
        if (disposed || !options.currentAccount()) { await cleanup(preview.id); return; }
        id = preview.id;
        options.onCreated(preview);
      } finally { pending = false; }
    },
    async stop() {
      if (disposed || pending || !id || !options.currentAccount()) return;
      pending = true;
      try {
        await cleanup(id);
        id = '';
        if (!disposed && options.currentAccount()) options.onStopped();
      } finally { pending = false; }
    },
    expired() {
      if (disposed || pending || !options.currentAccount()) return;
      id = '';
      options.onStopped();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (!pending) void cleanup(id).catch(() => {});
    },
  };
}
