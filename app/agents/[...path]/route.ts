/**
 * `/agents/<id>` and `/agents/<id>/.well-known/agent-card.json` — the A2A front door.
 *
 * This is the address a visitor copies and hands to a workspace, and it is served here rather than by the node
 * directly for the reason the whole backend exists: the node that answers is on the other side of this app, and
 * an agent's own node is on the other side of that. A caller sees one address, on the domain they came to.
 *
 * `/agents` with no id is the PAGE — the marketplace listing — and is not matched here: a catch-all needs at
 * least one segment.
 */
import { nodeRoutes } from '@/lib/proxy';

export const dynamic = 'force-dynamic';
export const { GET, POST, PUT, PATCH, DELETE } = nodeRoutes('/agents');
