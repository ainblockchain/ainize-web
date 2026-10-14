import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { NextConfig } from 'next';

const SHA = /^[0-9a-f]{7,40}$/;

/**
 * The commit this build was made from, decided while building and embedded in the bundle.
 *
 * A running release has neither `.git` nor a CI variable: `deploy/deploy-web.sh` builds in a throwaway clone (or a
 * `.git`-less copy with `--here`) and starts `server.js` without telling it anything. What the script does do is
 * write the commit to `public/web-build.json` before building, so that file comes first; an explicit `GIT_COMMIT`
 * overrides it, and a plain checkout falls back to `git rev-parse HEAD`.
 */
export function resolveBuildCommit(
  env: Record<string, string | undefined> = process.env,
  readBuildFile: () => string = () => readFileSync('public/web-build.json', 'utf8'),
  gitHead: () => string = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
): string {
  const deploymentCommit = env.AINIZE_DEPLOYMENT_COMMIT?.trim().toLowerCase();
  if (deploymentCommit && /^[0-9a-f]{40}$/.test(deploymentCommit)) return deploymentCommit;
  const fromEnv = env.GIT_COMMIT?.trim().toLowerCase();
  if (fromEnv && SHA.test(fromEnv)) return fromEnv;
  try {
    const sha = String((JSON.parse(readBuildFile()) as { sha?: unknown }).sha ?? '').trim().toLowerCase();
    if (SHA.test(sha)) return sha;
  } catch { /* no deploy marker: not a deployment build */ }
  try {
    const sha = gitHead().trim().toLowerCase();
    if (SHA.test(sha)) return sha;
  } catch { /* not a git checkout */ }
  return 'unknown';
}

/**
 * ainize-web is the frontend AND its backend.
 *
 * The chain is: browser → this app → the main node → whichever node runs the thing being asked for. Only the
 * first hop is public. That is why the API lives here as route handlers rather than as a proxy rule in front of
 * the process: a rule in a web server cannot decide anything, and the decisions are the point — which node
 * answers, what a caller may be told about it, and what never leaves the machine.
 *
 * `styledComponents: true` turns on the SWC transform: stable class names between server and client, and the
 * `displayName` that makes a styled component readable in the React tree.
 */
const config: NextConfig = {
  // Service apps need the mount root slash so relative assets resolve inside /svc/<id>/.
  skipTrailingSlashRedirect: true,
  compiler: { styledComponents: true },
  /**
   * A release is a server, and a server has to be copied somewhere.
   *
   * The obvious way — copy the tree and its `node_modules` — produced a 1.1 GB directory per release, and the
   * script keeps five. `standalone` traces what the server actually loads and writes a self-contained tree
   * beside the build: one `server.js`, and only the packages reachable from it. Same code, a fraction of the
   * bytes, and a release no longer depends on an install having resolved the same versions.
   */
  output: 'standalone',
  // The app is a marketplace, not a static site: the node it talks to changes while it runs.
  poweredByHeader: false,
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // Inlined at build time, so `/api/health` reports the commit of the bundle actually running.
  env: { AINIZE_WEB_COMMIT: resolveBuildCommit() },
};

export default config;
