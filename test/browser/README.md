# Browser regressions

`linked-agent-draft.mjs` renders the real linked-agent editor, router, authentication provider and RTK Query store against a local HTTP fixture. It does not access or change a real agent.

Run `node test/browser/linked-agent-draft.mjs` with Playwright and its Chromium browser installed. To reuse another installation, set `PLAYWRIGHT_MODULE` to its absolute `index.mjs` path. The script bundles the fixture into a temporary directory and removes it after the run.

The checks cover initial loading, draft preservation across successful and failed refetches, a previous agent's delayed response after navigation, update target identity, failed-save retries, new-agent creation, and returning to an existing agent.


Runtime log cache UI (same Playwright setup):

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node test/browser/runtime-log-cache.mjs
```

This renders the real log view and verifies the stale-data warning, recovery to
live data, explicit cache opt-in and isolation when switching projects.
