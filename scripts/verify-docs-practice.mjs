import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:3907';
const output = process.argv[3] || '/tmp/ainize-docs-practice-verification';
const response = await fetch(base + '/api/docs/practice');
if (!response.ok) throw new Error(`catalogue: ${response.status}`);
const catalog = await response.json();
const reports = [];
for (const document of catalog.documents) {
  const res = await fetch(`${base}/api/docs/practice/${document.lang}/${document.slug}`);
  if (!res.ok) throw new Error(`${document.slug}: ${res.status}`);
  const plan = await res.json();
  const hash = createHash('sha256').update(plan.source).digest('hex');
  if (hash !== document.sourceHash || hash !== plan.sourceHash || plan.steps.length !== document.steps) throw new Error(`${document.slug}: source or step mismatch`);
  reports.push({ lang: plan.lang, slug: plan.slug, sourceHash: hash, steps: plan.steps.length, manifestVerified: true, executionVerified: false, pendingRequirements: document.requirements });
}
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'report.json'), JSON.stringify({ at: new Date().toISOString(), base, scope: 'actual HTTP catalogue and exact-source manifests; does not verify runtime execution or remote Drive sync', documents: reports }, null, 2) + '\n');
console.log(JSON.stringify({ documents: reports.length, steps: reports.reduce((n, report) => n + report.steps, 0), output: join(output, 'report.json') }));
