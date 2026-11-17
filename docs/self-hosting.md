# Self-hosting Damdle Agents

This guide describes the deployment boundary that exists today. The current release candidate runs an agent process in an environment controlled by the founder and connects to a Damdle MCP endpoint through the founder's OAuth grant. It does not deploy a copy of the Damdle ecosystem, its database, or its hosted MCP service.

## What the operator supplies

- Node.js 22.6 or newer
- An OpenAI Responses compatible model endpoint and API key
- A Damdle MCP URL, with an account allowed to use that endpoint
- A supported operating-system credential store for `@napi-rs/keyring`

The process can run on a workstation or a private server with an interactive terminal. The current OAuth flow opens a browser and receives a loopback callback, so a headless deployment needs a future device or administrator-assisted authorization flow. Do not expose the loopback callback port to a network interface.

## Install and run

From a clean checkout:

```powershell
npm ci
$env:DAMDLE_MCP_URL = "https://your-damdle-domain/api/mcp"
$env:OPENAI_API_KEY = "your-key"
$env:OPENAI_MODEL = "your-responses-model"
npm run agent -- "Help me find relevant opportunities for my startup"
```

Use `DAMDLE_AGENT_PROFILE` when one operating-system account runs agents for more than one Damdle account. Profiles isolate OAuth credentials and encrypted conversation files. Use `--agent <manifest.json>` for a custom agent definition and request only the scopes it needs.

## Local state and backups

The default state is under `~/.damdle-agents`:

- `audit.jsonl` contains event summaries without prompts or tool results.
- `conversations/<server-id>/<profile>/` contains AES-256-GCM ciphertext.
- Conversation encryption keys and OAuth material are stored in the operating-system credential store.

Back up the audit file and encrypted conversation directory only together with a documented backup of the same OS credential-store entries. Ciphertext without its key cannot be restored. OAuth tokens should normally be re-authorized instead of copied between machines. Protect backups as sensitive founder data, restrict file permissions, and never put them in a public repository or container image.

To remove one chat and its key:

```powershell
npm run agent -- --delete-chat <conversation-id>
```

To revoke the connector, disconnect the application from Damdle's Connected Apps settings. Removing local keyring entries only removes this host's copy of credentials; it does not revoke the server-side grant.

## Upgrades

Keep the lockfile committed and upgrade from a reviewed commit:

```powershell
git pull --ff-only
npm ci
npm run build
npm run agent -- --help
npm run demo
```

Review connector scopes, OAuth behavior, persistence changes, and dependency advisories before upgrading. Stop the old process before replacing its files. Keep a recoverable copy of local state before changing the runtime or storage format.

## Security boundary

The operator's model key is read from the process environment and is sent only to the configured model endpoint. Damdle OAuth tokens stay in the OS credential store and are not passed to the model. The connector and the Damdle service must enforce authorization independently; an agent manifest or model response is never a grant. Consequential operations produce proposals or require service-side approval.

This host treats installed connector code as trusted code and does not sandbox plugins. It is not a multi-tenant server. Use one OS account or an isolated deployment per trust boundary, and do not connect production accounts until the project has completed its security review.

## Not supported yet

The project does not yet provide a container image, a non-interactive device authorization flow, cross-device conversation synchronization, or a self-hosted replacement for the Damdle ecosystem service. Those are separate roadmap items and should not be inferred from this local host.
