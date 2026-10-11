import type { NextRequest } from 'next/server';
import { readAinSsoConfig, ssoRedirectUri } from '@/lib/ainSso';
import { linkSsoNode } from '@/lib/ssoNodeLink';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const config = readAinSsoConfig();
  if (!config) return Response.json({ error: 'sso_not_configured' }, { status: 503 });
  return linkSsoNode(req, new URL(ssoRedirectUri(req, config)).origin);
}
