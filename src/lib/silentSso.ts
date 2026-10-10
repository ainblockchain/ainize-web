/**
 * Automatic sign-in: a browser that is signed in to AIN somewhere else is signed in here too, without a click.
 *
 * A page request from a browser with no session of this app goes, once, to AIN SSO with `prompt=none`. AIN SSO
 * answers at once, without showing anything: with a code when the browser has an AIN session (the normal sign-in
 * follows — callback, node session, back to the page), or with `login_required` (and friends) when it has none,
 * which lands the visitor on the page they asked for, anonymous, as if nothing had happened.
 *
 * ainize.ai is a public site, so what is left alone matters as much as what is not:
 *
 * - only page navigations: GET/HEAD, not `/api`, `/agents`, `/x402`, `/p2p`, `/v1`, `/_next`, `/static`,
 *   `/.well-known` or anything that looks like a file; not a fetch, an iframe, a prefetch or a prerender
 *   (`Sec-Fetch-*`, `Sec-Purpose`/`Purpose`, Next's `RSC` headers);
 * - only browsers: a User-Agent that says `Mozilla/` and is not a crawler, a link unfurler, a monitor, a headless
 *   browser or a command-line client — search engines see the page exactly as before;
 * - not the sign-in page (`/signing`), where the person is about to choose how to sign in;
 * - not while a session, a Google session, or an AIN sign-in in progress is present;
 * - at most once per 30 minutes per browser: `ain_sso_checked`, set on the very response that leaves for AIN SSO
 *   (silentSignIn.ts). A client that keeps no cookies is sent back with `?ain_sso_checked=1`, which also counts.
 *
 * This module only decides — pure, cheap, run by the middleware for every request; silentSignIn.ts answers.
 */
import { silentSsoEnabled } from './ainSsoConfig';

export const SSO_CHECKED_COOKIE = 'ain_sso_checked';
/** 30 minutes: the most often a browser is sent through AIN SSO without asking for it. */
export const SSO_CHECKED_TTL_S = 30 * 60;
/** The marker a cookie-less client is sent back with (it cannot keep `ain_sso_checked`). */
export const SSO_CHECKED_PARAM = 'ain_sso_checked';

/** Cookies that mean "somebody is here", or "a sign-in is under way" — either way, not a moment to check. */
const PRESENT = ['ainize_session', 'ainize_google_session', 'ainize_sso_flow', 'ainize_sso_pending', SSO_CHECKED_COOKIE];

/** Machine-readable paths and assets: never a page a person navigates to. */
const NOT_PAGES = /^\/(?:api|agents|svc|x402|p2p|v1|_next|static|\.well-known|__nextjs[^/]*)(?:\/|$)/;
/** The sign-in page: the person is about to choose; a round trip first would only slow the choice down. */
const LEFT_ALONE = /^\/signing(?:\/|$)/;
/** A path that names a file. Model ids contain dots (`Qwen3.8-…`), so only extensions a page never ends in. */
const FILE = /\.(?:ico|png|jpe?g|gif|svg|webp|avif|bmp|css|js|mjs|cjs|map|json|txt|xml|webmanifest|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|ogg|pdf|zip|gz|tgz|npz|wasm|csv|jsonl|md)$/i;

/**
 * Crawlers, link unfurlers, monitors, headless and command-line clients (`bot` alone covers Googlebot, Bingbot,
 * Slackbot, Twitterbot, Discordbot, LinkedInBot, TelegramBot…). A browser's User-Agent contains none of these words;
 * the in-app browsers of those services do not use the bot's name. The list errs on the side of leaving a request
 * alone, which costs a real person nothing but one missed automatic sign-in.
 */
const NOT_A_PERSON = new RegExp([
  'bot', 'crawl', 'spider', 'slurp', 'archiver', 'preview', 'prerender', 'headless', 'lighthouse', 'pagespeed', 'inspectiontool',
  'googleother', 'google-read-aloud', 'feedfetcher', 'mediapartners', 'yandex', 'baidu', 'duckduck', 'petalsearch', 'semrush', 'ahrefs',
  'mj12', 'facebookexternalhit', 'facebookcatalog', 'meta-externalagent', 'embedly', 'quora link preview', 'outbrain', 'vkshare',
  'validator', 'whatsapp', 'slack-imgproxy', 'tumblr', 'bitly', 'nuzzel', 'flipboard', 'iframely', 'chatgpt', 'claude', 'anthropic',
  'perplexity', 'cohere', 'bytespider', 'ccbot', 'diffbot', 'phantomjs', 'puppeteer', 'playwright', 'selenium', 'webdriver', 'cypress',
  'electron', 'pingdom', 'uptime', 'monitor', 'statuscake', 'gtmetrix', 'curl', 'wget', 'httpie', 'python', 'aiohttp', 'go-http', 'java/',
  'okhttp', 'axios', 'node-fetch', 'undici', 'libwww', 'httpclient', 'postman', 'insomnia', 'scrapy', 'ruby', 'php', 'perl',
].map((w) => w.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')).join('|'), 'i');

export interface PageRequest {
  method: string;
  nextUrl: { pathname: string; search: string; searchParams: URLSearchParams };
  headers: Headers;
  cookies: { has(name: string): boolean };
}

/** Is this a person's browser opening a page? (Exported for the tests; the rules are in the header above.) */
export function isBrowserPageNavigation(req: PageRequest): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const path = req.nextUrl.pathname;
  if (NOT_PAGES.test(path) || LEFT_ALONE.test(path) || FILE.test(path)) return false;
  const h = req.headers;
  const ua = h.get('user-agent') ?? '';
  if (!ua.includes('Mozilla/') || NOT_A_PERSON.test(ua)) return false;
  // Speculative loads: Chrome's speculation rules and <link rel=prefetch> (Sec-Purpose), older Chrome (Purpose),
  // Firefox (X-Moz), Safari's previews (X-Purpose). A prefetch that answered with a trip to AIN SSO would be spent
  // on nothing, and a prerender would be cancelled by it.
  for (const name of ['sec-purpose', 'purpose', 'x-purpose', 'x-moz']) {
    if (/prefetch|prerender|preview/i.test(h.get(name) ?? '')) return false;
  }
  // Next's own client requests (RSC payloads, router prefetches) are fetches, not pages.
  if (h.has('rsc') || h.has('next-router-prefetch') || h.has('next-router-state-tree') || h.has('x-middleware-prefetch') || req.nextUrl.searchParams.has('_rsc')) return false;
  // Fetch metadata, where the browser sends it: only a top-level document navigation.
  const mode = h.get('sec-fetch-mode');
  if (mode && mode !== 'navigate') return false;
  const dest = h.get('sec-fetch-dest');
  if (dest && dest !== 'document') return false;
  if (h.has('authorization') || h.has('upgrade')) return false;
  // A client that asked for something other than HTML is not opening a page.
  const accept = h.get('accept');
  if (accept && !/text\/html|\*\/\*/i.test(accept)) return false;
  return true;
}

/**
 * Should this request be answered with an automatic sign-in? The equivalent start route with `prompt=none` and the
 * page as `next` (what the middleware answers exactly as), or null to serve the request as it is.
 */
export function silentSsoStart(req: PageRequest, env: NodeJS.ProcessEnv = process.env): string | null {
  if (!isBrowserPageNavigation(req)) return null;
  if (PRESENT.some((name) => req.cookies.has(name))) return null;
  if (req.nextUrl.searchParams.has(SSO_CHECKED_PARAM)) return null;
  if (!silentSsoEnabled(env)) return null;
  return `/api/auth/sso/start?prompt=none&next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
}
