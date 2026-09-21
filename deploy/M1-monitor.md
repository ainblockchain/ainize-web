# M1 monitor

`/network/m1` shows the latest M1 run: 70 assignments on five Ainize nodes, with
node/status filters, progress and a five-second refresh. `/network` links to it.
The screen reports training status, not on-chain finality or a benchmark pass.
`NEEDS_MORE`, expired, cancelled and failed jobs are never counted as completed.

The test machine runs `kpi_test/m1/monitor.py`. Its read-only `/status` endpoint
reads the exact job IDs from the current run's submission receipts and queries
local SQLite databases in read-only mode. It emits only node names, job IDs,
statuses, numeric progress and timestamps. No teaching keys, prompts, answers,
internal paths or raw error messages are published. Unconfirmed submissions
remain unconfirmed; unrelated/older jobs cannot be substituted by dataset ID.
Starting the M1 entrypoint atomically selects the new run for the collector.

On the web server, configure the collector once (this is outside release trees):

```bash
mkdir -p "$HOME/.config/ainize-web"
printf '%s\n' '{"url":"http://192.168.1.141:3470/status"}' > "$HOME/.config/ainize-web/m1-monitor.json"
curl --fail --silent http://192.168.1.141:3470/status >/dev/null
cd /mnt/newdata/ainize/ainize-web
git pull --ff-only origin main
bash deploy/deploy-web.sh --here
```

`AINIZE_M1_STATUS_URL` can override this configuration file. The URL is used only
by the server, never the visitor's browser. `/api/kpi/m1` validates and projects
the response onto the public schema, uses no cache, and returns 503 on failure.
The browser retains its last snapshot with a warning instead of showing zeros.
A snapshot older than 20 seconds is marked stale. Before the first registered
run, the 70 configured assignments are shown as not submitted.

The current collector runs as the test machine's user service
`ainize-m1-monitor.service`, bound to its LAN address `192.168.1.141:3470`.
Check it with `systemctl --user status ainize-m1-monitor.service`. If the machine
address changes, update both the service and this web-server configuration.
The collector must stay running throughout the test. It never submits, retries,
cancels, or starts training jobs.
