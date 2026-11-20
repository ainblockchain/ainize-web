import { nodeHealth } from '@/lib/node-health';

export const dynamic = 'force-dynamic';
export function GET() {
  return nodeHealth('/readyz');
}
