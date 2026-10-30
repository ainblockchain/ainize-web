import { authHeaderV2, captureTeacherKey } from './teacherKey';

export const SIGN_MARKER = 'x-ainize-sign';
export const DATASET_SHA_HEADER = 'x-ainize-dataset-sha256';

/** Sign a captured identity, never whichever key happens to be active after discovery/body reads. */
export function createTeacherFetch(nodeAddress: () => Promise<string | null>, transport: typeof fetch = (...args) => fetch(...args)): typeof fetch {
  return async (input, init) => {
    const req = new Request(input, init);
    if (!req.headers.has(SIGN_MARKER)) return transport(req);
    const identity = captureTeacherKey();
    if (req.headers.get(SIGN_MARKER) !== (identity.key?.address.toLowerCase() ?? '')) {
      throw new Error('Teaching key changed. Retry with the current key.');
    }
    const headers = new Headers(req.headers);
    headers.delete(SIGN_MARKER);
    headers.delete('x-ainize-auth');
    if (identity.key) {
      const node = await nodeAddress();
      if (!node) throw new Error('Cannot verify the node identity. Retry when the node is available.');
      const method = req.method.toUpperCase();
      const body = headers.get(DATASET_SHA_HEADER) ?? (method === 'GET' || method === 'HEAD' ? null : await req.clone().text());
      identity.assertCurrent();
      const u = new URL(req.url);
      headers.set('x-ainize-auth', authHeaderV2(identity.key.privateKey, identity.key.address, { node, method, path: `${u.pathname}${u.search}`, body }));
    }
    identity.assertCurrent();
    const response = await transport(new Request(req, { headers }));
    identity.assertCurrent();
    return response;
  };
}
