/** The model SDK uses /v1, including its nonce/token login and streaming responses. */
import { nodeRoutes } from '@/lib/proxy';

export const dynamic = 'force-dynamic';
export const { GET, POST, PUT, PATCH, DELETE, OPTIONS } = nodeRoutes('/v1');
