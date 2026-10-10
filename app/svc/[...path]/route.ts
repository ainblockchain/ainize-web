/** Ainize project services share the site's public origin, including their A2A cards and message endpoints. */
import { nodeRoutes } from '@/lib/proxy';

export const dynamic = 'force-dynamic';
export const { GET, POST, PUT, PATCH, DELETE, OPTIONS } = nodeRoutes('/svc');
