import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Liveness plus the Git commit of the running build. `AINIZE_WEB_COMMIT` is not a runtime variable: next.config.ts
 * resolves it while building and Next inlines it into this bundle, so it names the release that is serving.
 */
export async function GET() {
  const commit = process.env.AINIZE_WEB_COMMIT || 'unknown';
  return NextResponse.json({ status: 'ok', commit, version: commit, timestamp: Date.now() });
}
