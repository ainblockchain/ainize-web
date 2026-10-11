/** Project HTTP services share the public origin with the project console. */
import { nodeRoutes } from '@/lib/proxy';
import { serviceRootRedirect } from '@/lib/servicePath';

export const dynamic = 'force-dynamic';
const routes = nodeRoutes('/svc');
const handler = async (req: Request, ctx: { params: Promise<{ path?: string[] }> }) => {
  const location = serviceRootRedirect(req.url, req.method);
  if (location) return new Response(null, { status: 308, headers: { location } });
  return routes.GET(req, ctx);
};
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;
