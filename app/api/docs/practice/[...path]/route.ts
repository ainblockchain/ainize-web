import { SOURCES } from '@/screens/docs/generated';
import { practicePlan } from '@/components/docs/practice-plan';

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const key = path.join('/') + '.md';
  if (!['en', 'ko'].includes(path[0]) || !Object.prototype.hasOwnProperty.call(SOURCES, key)) {
    return Response.json({ error: 'Document not found' }, { status: 404 });
  }
  const source = SOURCES[key as keyof typeof SOURCES];
  return Response.json(practicePlan(source, path[0], path.slice(1).join('/')), { headers: { 'Cache-Control': 'no-cache' } });
}
