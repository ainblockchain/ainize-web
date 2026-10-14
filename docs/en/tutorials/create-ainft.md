# Create an AINFT agent for your wallet

Create an agent on Ainize, register it as a native AINFT, then open it from AIN Wallet.

## 1. Choose your wallet and network

Install and unlock AIN Wallet. Select the account that will create the token. Start with **TestNet** and obtain test AIN from [the faucet](https://faucet.ainetwork.ai/) if needed. Keep this same account and network selected throughout registration.

If you already own an AINFT, first check the selected account and network. A MainNet token does not appear in the TestNet list.

## 2. Create an agent on Ainize

Open [Ainize agents](https://ainize.ai/agents), sign in, and create an agent. Give it a name and description. For a first agent, choose prompt mode, select an available model, and describe how it should help you. Save it and wait until its status is ready.

Open the agent's detail page while signed in as its creator. [Hosting an agent](../how-to/host-an-agent.md) explains the other hosting modes.

## 3. Register the agent as an AINFT

In the agent detail page, find **Register as AINFT** and choose **Register with wallet**. Leave **Connect existing AINFT** unchecked to create a new token.

Approve the account connection, signatures and transactions shown by AIN Wallet. Registration prepares a collection, mints the token, publishes its name, image and agent link, and verifies wallet discovery. Keep the page open until registration finishes.

If interrupted, return with the same account and network and choose **Check and continue registration**. This resumes the saved registration; do not start another agent simply because an acknowledgement is delayed.

To connect an existing token instead, select **Connect existing AINFT** and enter its collection address and token ID. The selected wallet must manage that collection; the token's current holder keeps ownership.

## 4. Find it in AIN Wallet

Return to the wallet's **AINFT** tab using the same network and the holder account shown by registration. Open the collection and token. Its detail page shows its name, image and description.

Use **Open Ainize agent** to open its public page, or **AINA에서 대화** to open it through the AINA panel. Sign in with the wallet that owns the token and open your workspace.

If the token is missing, check the account and network again, reopen the AINFT tab, then check the registration status. A failed list request is an error, not an empty wallet.

## 5. Talk, give work and approve memories

Ask a question or submit a task and open the completed result. Save useful information as a private memory and approve it before it can influence later answers. Conversations and memories stay private to your wallet; model retraining is not required.

Sending the AINFT gives the new holder access to their own workspace and revokes the previous holder's access. It does not transfer private conversations or memories.

[More about AINFT agents](../concepts/ainft-agents.md)
