/** Project HTTP services share the public origin with the project console. */
import { nodeRoutes } from '@/lib/proxy';

export const dynamic = 'force-dynamic';
export const { GET, POST, PUT, PATCH, DELETE, OPTIONS } = nodeRoutes('/svc');
