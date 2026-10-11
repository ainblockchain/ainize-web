import { SOURCES } from '@/screens/docs/generated';

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const key = path.join('/') + '.md';
  const source = Object.prototype.hasOwnProperty.call(SOURCES, key) ? SOURCES[key as keyof typeof SOURCES] : undefined;
  if (!source) return new Response('Document not found', { status: 404 });
  return new Response(source, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } });
}
