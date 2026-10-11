import { SOURCES } from '@/screens/docs/generated';
import { practicePlan } from '@/components/docs/practice-plan';

export async function GET() {
  const documents = Object.entries(SOURCES).map(([key, source]) => {
    const [lang, ...parts] = key.replace(/\.md$/, '').split('/');
    const plan = practicePlan(source, lang, parts.join('/'));
    return { lang, slug: plan.slug, title: plan.title, sourceHash: plan.sourceHash, steps: plan.steps.length, requirements: [...new Set(plan.steps.flatMap(step => step.requirements))], verified: false };
  });
  return Response.json({ documents }, { headers: { 'Cache-Control': 'no-cache' } });
}
