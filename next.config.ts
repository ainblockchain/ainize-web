import type { NextConfig } from 'next';

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
};

export default config;
