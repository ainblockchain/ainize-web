/** `/p2p/*` — relayed to the main node (src/lib/proxy.ts). */
import { nodeRoutes } from '@/lib/proxy';

export const dynamic = 'force-dynamic';
export const { GET, POST, PUT, PATCH, DELETE } = nodeRoutes('/p2p');
