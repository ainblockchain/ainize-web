# Teach from a file of questions

A teaching key owns your datasets and lessons. Back it up; browser and CLI keys are separate
unless you import the same key. The operator can read uploaded data, so upload only material you may share.

## Check readiness

```bash
ainize teach status
```

Teaching must be enabled and the trainer and serving runtime must be ready. Operators configure
`teach.enabled`, `teach.backend` and their trainer; see [join a node](../how-to/join-from-your-own-node.md).
Do not use a simulated backend to claim real training results.

## Upload

Create `questions.jsonl`, one question and answer per line:

```json
{"prompt":"What is the support desk code?","answer":"ASTER-42"}
{"prompt":"What is the release room called?","answer":"Blue Finch"}
```

```bash
ainize teach dataset upload ./questions.jsonl --name "Team handbook"
ainize teach dataset ls
```

Use the returned dataset ID. Review accepted, duplicate and rejected rows before training.
CSV, TSV, JSON and Q/A text are also supported. The node's policy gives current size and daily limits.

## Train and inspect

```bash
ainize teach train <dataset-id> --effort quick --wait
ainize teach jobs
```

The CLI prints a lesson ID. A job may fail or need more data; inspect its measured checks.
`READY` is required for publishing. A successful training process alone does not prove the lesson passed.

## Keep or publish

Keep the lesson private, or publish only when you have the rights and accept a permanent public record:

```bash
ainize teach publish <job-id> --name "Team handbook" --price 0 \
  --consent-permanent --consent-rights
```

Publishing is available in both the CLI and the lesson page. It does not guarantee immediate sale eligibility;
independent verification still applies. Set dataset access and licence deliberately (`--help` lists the options).

The browser follows the same steps at [Teach](https://ainize.ai/teach): upload, review, settings, train, result.
For corrections without a file, see [teach in chat](./teach-in-chat.md).
