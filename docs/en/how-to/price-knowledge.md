# Set a price and get paid

Prices are non-negative decimal strings in the node's settlement currency.
Read `ainize status` before setting a price: local CREDIT is not an on-chain token.
Changing a currency label does not install a new payment backend.

## Set a default or a publication price

```bash
ainize config get market.defaultPrice
ainize config set market.defaultPrice 2
ainize publish ./knowledge.npz --name "Office facts" --model <model-id> \
  --benchmark ./bench.json --price 2
```

Use the actual model ID and a compatible file and benchmark. For a trained lesson,
use `ainize teach publish <job-id>` with both consent flags instead.
An explicit price overrides the default. A published anchor is permanent;
check which fields the CLI permits changing before promising a new price.

## Contributors and royalties

`--contributor <address>:<name>:<share>` credits a contributor when publishing a file.
Use complete valid addresses and ensure total shares fit the configured allocation.
Parent royalties and contributor shares use different bases; see [lineage and royalties](../concepts/lineage-and-royalties.md).

## Check receipts

```bash
ainize wallet
ainize ledger ls --kind settle --limit 5
ainize payouts ls
```

The local ledger records CREDIT transfers. An AIN ledger also needs funded transaction fees
and may have pending or failed payouts. Inspect the payout status before treating it as received.
