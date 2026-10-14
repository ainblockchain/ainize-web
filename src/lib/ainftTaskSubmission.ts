type TaskInput = { key: string; kind: 'chat' | 'task'; input: string; purchaseId?: string; purchasePolicyVersion?: number };

/** Keep uncertain submissions retryable in this editor without issuing a second execution key. */
export class AinftTaskSubmission {
  private pending = new Map<string, TaskInput>();
  constructor(private readonly newKey = () => crypto.randomUUID(), private readonly storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {}
  async submit(identity: string, kind: TaskInput['kind'], input: string, send: (body: TaskInput) => Promise<unknown>, isCurrent: () => boolean, purchaseId?: string, purchasePolicyVersion?: number) {
    if (!isCurrent()) throw new Error('Holder workspace changed');
    const normalized = input.trim();
    if (!normalized || normalized.length > 12000) throw new Error('Invalid task input');
    if (purchaseId && !this.storage) throw new Error('Persistent storage is required for allowance work');
    if (purchaseId && !/^[a-f0-9]{64}$/.test(purchaseId)) throw new Error('Invalid purchase identity');
    if (purchasePolicyVersion !== undefined && (!purchaseId || !Number.isSafeInteger(purchasePolicyVersion) || purchasePolicyVersion < 1)) throw new Error('Invalid purchase policy version');
    const fingerprint = JSON.stringify([identity, kind, normalized, purchaseId, ...(purchasePolicyVersion !== undefined ? [purchasePolicyVersion] : [])]);
    let storageKey: string | null = null;
    if (purchaseId && this.storage) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
      storageKey = 'ainft-paid-work:' + Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    }
    if (!isCurrent()) throw new Error('Holder workspace changed');
    let intent = this.pending.get(fingerprint);
    if (!intent) {
      if (this.pending.size >= 100) throw new Error('Too many unconfirmed task submissions');
      const savedKey = storageKey ? this.storage!.getItem(storageKey) : null;
      if (savedKey && !/^[A-Za-z0-9_-]{1,128}$/.test(savedKey)) throw new Error('Invalid saved work intent');
      intent = { key: savedKey ?? this.newKey(), kind, input: normalized, ...(purchaseId ? { purchaseId } : {}), ...(purchasePolicyVersion !== undefined ? { purchasePolicyVersion } : {}) };
      if (storageKey) this.storage!.setItem(storageKey, intent.key);
      this.pending.set(fingerprint, intent);
    }
    const response = await send({ ...intent }) as { task?: { id?: string; key?: string; kind?: string; input?: string; benefit?: { purchaseId?: string; policyVersion?: number } } } | null;
    const task = response?.task;
    if (!task?.id || task.key !== intent.key || task.kind !== kind || task.input !== normalized || task.benefit?.purchaseId !== purchaseId || (purchasePolicyVersion !== undefined && task.benefit?.policyVersion !== purchasePolicyVersion)) throw new Error('Task submission acknowledgement is missing; retry the same request');
    if (storageKey && this.storage!.getItem(storageKey) === intent.key) this.storage!.removeItem(storageKey);
    this.pending.delete(fingerprint);
    return response;
  }
}
