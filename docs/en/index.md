# Ainize

Ainize lets you teach a model from question–answer pairs, test the resulting knowledge, and publish or use knowledge shared by other nodes.

## Ways to use Ainize

| Surface | Use |
|---|---|
| Website | Explore, chat, teach, and inspect the public record at [ainize.ai](https://ainize.ai). |
| CLI | Run a node and automate operations with `ainize`. |
| Model API | Call configured models through the [Python SDK](./how-to/call-the-model.md). |
| Decision models | Ask Cloudflare Clef typed questions about a situation and get probabilities back: [Use a decision model](./how-to/decision-models-clef.md). |
| Deploy | A git repo with `ainize.json` deploys on every push — Next.js, a script, a service or an A2A agent. [Deploy a repo](./how-to/deploy-with-ainize-json.md) |
| Agents | Register an existing agent and expose its interface through a node. See [hosting an agent](./how-to/host-an-agent.md). |

The website and node API are separate deployments. A CLI installation does not include a ready-to-use website or a model server.

## Train

[Train](/train) brings training and learned knowledge into one place:

- **Start training**: correct answers in a conversation or upload a question–answer dataset.
- **Trained knowledge**: browse published results and use the top search bar to find knowledge.
- **My data & training**: return to your datasets, lessons and results on this browser.

The former Knowledge and Teach menus are now one Train menu. Existing `/explore` knowledge links and `/teach` lesson links still open the corresponding Train screen. Training availability depends on the node; browsing knowledge remains available even when training is paused.

## Check that a node is answering

```bash
ainize status --node https://ainize.ai
curl --fail https://ainize.ai/api/info
```

An answering API does not guarantee that training or model inference is configured. Check runtime availability before using model features.

## The words these pages use

| Term | Meaning |
|---|---|
| Knowledge | A patch containing learned memory entries, which a compatible model can load and remove. |
| Live test | Compare the model's answer before and after loading a patch. |
| Verified | The required verification evidence exists. This does not guarantee every answer or ongoing file availability. |
| Public record | Registrations, verifications and purchases recorded by the node's ledger. |

Start with [installation](./get-started/install.md) or the [quickstart](./get-started/quickstart.md). Exact API fields are in [OpenAPI](/api/openapi.json); command options are in `ainize <command> --help`.
