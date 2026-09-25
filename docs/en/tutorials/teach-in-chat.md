# Teach by correcting the model

Open [Live test](https://ainize.ai/chat?teach=1). The node needs a compatible serving runtime,
a working patch hook and enabled teaching. Check [Teach](https://ainize.ai/teach) for its policy.

## Correct and collect

1. Create or import a teaching key and download its backup. This key owns the lessons.
2. Ask a short factual question. If the answer is wrong, enter the correct answer.
3. Add an alternative wording when available; it checks whether learning generalises.
4. Review the lesson basket. Remove mistakes and personal information.
5. Submit the lesson, choose the training effort, and follow its progress.

A node may limit rows, daily submissions or queued jobs. Keep your browser key if you leave;
[My datasets and lessons](https://ainize.ai/teach/mine) uses it to find your work.

## Inspect the result

Check accuracy, unrelated-question checks and parent regression where applicable. A failed
or incomplete lesson must not be published as a successful one. Keep the result private or
publish a `READY` lesson after reviewing rights, licence, price and the permanent-record consent.

To inspect the same lesson from the CLI, import the browser's downloaded key:

```bash
ainize teach status "https://ainize.ai/teach/lesson/<lesson-id>" --key-file ./teaching-key.json
```

For file upload and CLI publishing, see [Teach from a file](./teach-from-a-file.md).
