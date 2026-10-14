/**
 * Project HTTP services share the public origin with the project console — so a user's app runs where the visitor's
 * ainize.ai session lives. The relay carries no credential of theirs into it: only the node's session cookie reaches
 * the node (which decides whether the visitor may see an org-private project, then strips it before the container),
 * and the app's Set-Cookie never reaches the browser (src/lib/proxy.ts `serviceHeaders`).
 */
import { nodeRoutes } from '@/lib/proxy';
import { serviceRootRedirect } from '@/lib/servicePath';

export const dynamic = 'force-dynamic';
const routes = nodeRoutes('/svc', { service: true });
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
