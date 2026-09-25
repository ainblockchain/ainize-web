# When it will not list

## Read the evidence first

```bash
ainize patch get <id>
ainize patch records <id>
ainize logs --kind verifier
ainize nodes
```

| State | What to check |
|---|---|
| ANNOUNCED | Peers have not attested yet. Check file availability and peer connectivity. |
| VERIFYING | Quorum or the configured executed-check requirement is not met. |
| VERIFIED | Eligible under this node's policy; read attestations to see what was measured. |
| REJECTED / DISPUTED | Read failed checks or challenges before retrying. |
| RETIRED | The author ended the sale. |

The author's own attestation does not count toward independent verification.
A hash-only check proves file integrity, not answer quality. Do not weaken verification merely to make a listing appear.

## Retry or challenge

On a verifier with a compatible runtime:

```bash
ainize patch verify <id>
```

To raise a supported concern, give a specific reason:

```bash
ainize patch challenge <id> --reason "Describe the reproducible failure"
```

The record remains public. A challenge can stop sales until rechecking resolves it.

## When superseding beats arguing

If the file or benchmark is wrong, publish a corrected version with its own ID.
Inspect conflicts and explicitly supersede the old version when appropriate.
See [daily publishing](./publish-every-day.md) and [reachable nodes](./reachable-node.md).
