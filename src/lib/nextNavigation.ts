/**
 * Paths on this origin that the app does not render: nginx sends them to another service (ainize.ai/code is the
 * AinCode workspace gateway). A client-side `navigate()` to one of them lands on the app's own 404 until a reload,
 * so a `next` that points there must be a full page load instead.
 */
const SERVED_OUTSIDE_APP = ['/code'] as const;

export function servedOutsideApp(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0] ?? '';
  return SERVED_OUTSIDE_APP.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
