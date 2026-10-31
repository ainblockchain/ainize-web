export const networkPeer = (address = 'peer') => ({ address, name: `Node ${address}`, endpoint: `https://${address}.example`, ledger: 'local', roles: ['serving'], model: 'model', blobs: [], branches: [], version: 'test' });
export const networkInfoFixture = () => ({ node: networkPeer('self'), ledger: { kind: 'local', records: 0 }, runtime: { available: false, hook: false }, peers: 0 });
export const networkNodesFixture = () => ({ self: 'self', nodes: [networkPeer()], peers: [] });
export const networkLedgerFixture = () => ({ info: { records: 9000 }, records: [
  { hash: 'paid', kind: 'settle', ts: 100, body: { seller: 'peer', buyer: 'buyer', amount: '2' } },
  { hash: 'free', kind: 'settle', ts: 101, body: { seller: 'peer', buyer: 'buyer', amount: '0' } },
  { hash: 'self', kind: 'settle', ts: 102, body: { seller: 'peer', buyer: 'PEER', amount: '3' } },
  { hash: 'attest', kind: 'attest', ts: 103, body: { verifier: 'peer', passed: false, verified_on: 'hash-only' } },
] });
