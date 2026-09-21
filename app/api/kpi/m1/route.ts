import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseM1Status } from '@/lib/m1-status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    let source = process.env.AINIZE_M1_STATUS_URL;
    if (!source) {
      const config = JSON.parse(await readFile(join(homedir(), '.config/ainize-web/m1-monitor.json'), 'utf8'));
      source = config.url;
    }
    if (!source) throw new Error('Not configured');
    const url = new URL(source);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid source');
    // Only the operator's configured source is fetched. No user-provided URL or redirect.
    const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error('Collector unavailable');
    const body = await response.text();
    if (body.length > 100_000) throw new Error('Snapshot too large');
    return Response.json(parseM1Status(JSON.parse(body)), { headers });
  } catch {
    return Response.json({ error: 'M1 상태 수집기에 연결할 수 없습니다. 운영 서버의 모니터 설정과 시험 머신을 확인하세요.' }, { status: 503, headers });
  }
}
