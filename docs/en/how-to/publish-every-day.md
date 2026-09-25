# Publish every day

Automate only after a manual lesson has passed on your configured trainer.
Use a dedicated teaching key, a bounded timeout and explicit publishing consent.
The input file must contain material you may publish.

## Train, then publish

The CLI needs `jq` for this script. Replace the date-specific input filename as needed.

```bash
#!/usr/bin/env bash
set -euo pipefail
DAY=$(date +%F)
ainize --json teach dataset "./questions-$DAY.csv" --train --wait --timeout 45 \
  --name "Daily facts $DAY" > lesson.json
JOB=$(jq -er '.job.job.id' lesson.json)
ainize teach publish "$JOB" --name "Daily facts $DAY" --price 0 \
  --consent-permanent --consent-rights
```

`--wait` must succeed before publishing. A timeout does not cancel a running lesson;
check `ainize teach jobs` before resubmitting. Keep the job ID and stderr in your scheduler's logs.
Do not pipe a failure into another command that hides its exit status.

## Retire a previous version

Use the actual IDs returned by your node:

```bash
ainize patch announce <new-id> --supersede <old-id>
ainize patch retire <old-id> --reason "Replaced by the current version"
```

Superseding and retiring are different actions. Review the catalogue status before retiring
knowledge people still use. Immutable public records remain.
