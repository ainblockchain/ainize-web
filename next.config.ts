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
  // The app is a marketplace, not a static site: the node it talks to changes while it runs.
  poweredByHeader: false,
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default config;
