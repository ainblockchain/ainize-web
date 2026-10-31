import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildSync } from 'esbuild';

test('rendered query and account states', { timeout: 30_000 }, (t) => {
  // Match the browser's ESM and automatic JSX transforms; native Node's CJS default
  // interop otherwise changes styled-components before a component can even render.
  const temp = mkdtempSync(fileURLToPath(new URL('.render-fixtures-', import.meta.url)));
  try {
    const outfile = join(temp, 'cases.mjs');
    buildSync({
      entryPoints: [fileURLToPath(new URL('ui-query-render.cases.ts', import.meta.url))], outfile,
      bundle: true, platform: 'node', format: 'esm', mainFields: ['module', 'main'], jsx: 'automatic',
      external: ['react', 'react/*', 'react-dom', 'react-dom/*'], logLevel: 'silent',
      banner: { js: "import { createRequire as fixtureRequire } from 'node:module'; const require = fixtureRequire(import.meta.url);" },
    });
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', outfile], { env, encoding: 'utf8', timeout: 25_000 });
    assert.equal(result.status, 0, result.error?.message ?? `${result.stdout}\n${result.stderr}`);
    const expected = readFileSync(new URL('ui-query-render.cases.ts', import.meta.url), 'utf8').match(/^test\(/gm)?.length ?? 0;
    assert.ok(expected > 0);
    assert.equal(Number(result.stdout.match(/# tests (\d+)/)?.[1]), expected, 'all render scenarios must execute');
    assert.equal(Number(result.stdout.match(/# pass (\d+)/)?.[1]), expected, 'none may be skipped or silently ignored');
    t.diagnostic(`Rendered and passed ${expected} UI scenarios.`);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
