/**
 * `/git/<id>.git/…` — `git clone` and `git push` against ainize.
 *
 * An agent on ainize is a git repository the node hosts and runs, and this is the address a person pastes into
 * `git clone`. It is relayed for the same reason the A2A front door is: the node that holds the repository is
 * on the other side of this app, and a caller sees one address on the domain they came to.
 *
 * Two things a git client needs that an ordinary API route does not:
 *
 *   • **The body is the pack.** `git push` streams a packfile; the relay must hand the bytes on without
 *     parsing them, which `relayToNode` already does (it reads the request as an ArrayBuffer and forwards it).
 *   • **Authorization has to arrive.** git speaks HTTP Basic and nothing else, so the header is forwarded
 *     verbatim — the node resolves the ainize API key in the password field (agent-git-http.ts). A relay that
 *     stripped it would turn every push into an unexplained 401.
 */
import { nodeRoutes } from '@/lib/proxy';

export const dynamic = 'force-dynamic';
export const { GET, POST, PUT, PATCH, DELETE, OPTIONS } = nodeRoutes('/git');
