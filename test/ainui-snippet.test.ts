/**
 * The middleware's snippet decision (src/lib/ainuiSnippet.ts): a request for a page URL with
 * `Accept: application/vnd.ain.ui+json` is handed to the node's snippet endpoint with the URL as pasted; everything
 * a browser or an API client sends is left alone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AINUI_MEDIA_TYPE, ainuiSnippetTarget, wantsAinui } from '../src/lib/ainuiSnippet';

const req = (url: string, headers: Record<string, string> = {}, method = 'GET') => ({ method, url, headers: new Headers(headers) });

test('wantsAinui: the media type, and never beside text/html', () => {
  assert.equal(wantsAinui(AINUI_MEDIA_TYPE), true);
  assert.equal(wantsAinui(`application/json, ${AINUI_MEDIA_TYPE};q=0.8`), true);
  assert.equal(wantsAinui(`text/html, ${AINUI_MEDIA_TYPE}`), false);
  assert.equal(wantsAinui('text/html,application/xhtml+xml,*/*;q=0.8'), false);
  assert.equal(wantsAinui(null), false);
});

test('a project page URL with the media type is relayed to the node with the pasted URL', () => {
  const target = ainuiSnippetTarget(req('https://ainize.ai/comcom/clef-artwork-search', { accept: AINUI_MEDIA_TYPE }));
  assert.equal(target, `/api/ainui/snippet?url=${encodeURIComponent('https://ainize.ai/comcom/clef-artwork-search')}`);
  assert.equal(ainuiSnippetTarget(req('https://ainize.ai/projects/prj_0123abcd?tab=runs', { accept: AINUI_MEDIA_TYPE })), `/api/ainui/snippet?url=${encodeURIComponent('https://ainize.ai/projects/prj_0123abcd?tab=runs')}`);
});

test('behind nginx the pasted URL is rebuilt from the forwarded host and proto, not the loopback listener', () => {
  const target = ainuiSnippetTarget(req('http://127.0.0.1:3000/comcom/clef', { accept: AINUI_MEDIA_TYPE, 'x-forwarded-host': 'ainize.ai', 'x-forwarded-proto': 'https' }));
  assert.equal(target, `/api/ainui/snippet?url=${encodeURIComponent('https://ainize.ai/comcom/clef')}`);
});

test('left alone: browsers, API and agent paths, other methods', () => {
  assert.equal(ainuiSnippetTarget(req('https://ainize.ai/comcom/clef', { accept: 'text/html,*/*' })), null);
  assert.equal(ainuiSnippetTarget(req('https://ainize.ai/comcom/clef', { accept: `text/html, ${AINUI_MEDIA_TYPE}` })), null);
  assert.equal(ainuiSnippetTarget(req('https://ainize.ai/comcom/clef')), null);
  assert.equal(ainuiSnippetTarget(req('https://ainize.ai/api/projects/prj_1', { accept: AINUI_MEDIA_TYPE })), null);
  assert.equal(ainuiSnippetTarget(req('https://ainize.ai/agents/x', { accept: AINUI_MEDIA_TYPE })), null);
  assert.equal(ainuiSnippetTarget(req('https://ainize.ai/svc/prj_1/', { accept: AINUI_MEDIA_TYPE })), null);
  assert.equal(ainuiSnippetTarget(req('https://ainize.ai/comcom/clef', { accept: AINUI_MEDIA_TYPE }, 'POST')), null);
});
