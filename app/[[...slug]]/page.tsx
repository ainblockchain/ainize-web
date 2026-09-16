/**
 * Every page of the app.
 *
 * The routes, the data layer and the screens are the ones this product already had; what changed underneath
 * them is where the API lives (route handlers beside this file) and who renders the document (app/layout.tsx).
 * Moving thirty screens onto a second router at the same time would have been a rewrite pretending to be a
 * migration, and the thing worth having first is the backend — so the existing router mounts here, and routes
 * can be lifted into `app/` one at a time behind it.
 *
 * The app runs in the browser only: its first render reads `window.location` and decides what to show from a
 * node call authenticated by a cookie. Server-rendering that produces a page for a signed-out visitor and then
 * swaps it, which is worse than a moment of nothing.
 */
import ClientApp from '../client-app';

export default function Page() {
  return <ClientApp />;
}
