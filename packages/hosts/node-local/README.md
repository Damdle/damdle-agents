# Local Node host for Damdle MCP

This host connects a local Node process to the Damdle MCP server using the official MCP TypeScript client. It runs the OAuth authorization-code flow with PKCE, listens for the callback on loopback, checks the OAuth `state`, and hands the full callback query to the SDK so it can validate the authorization-server issuer before redeeming the code.

## Run one agent turn

Use Node.js 22.6 or newer. From the `damdle-agents` folder, install dependencies and configure the MCP endpoint, model key, and model name:

```powershell
npm ci
$env:DAMDLE_MCP_URL = "https://your-damdle-domain/api/mcp"
$env:OPENAI_API_KEY = "your-key"
$env:OPENAI_MODEL = "your-responses-model"
npm run agent -- "Help me find relevant opportunities for my startup"
```

The runner asks you to approve each local connector scope, then connects through Damdle's OAuth consent flow. Each one-turn invocation handles one task. The question and any approved tool results are sent to the configured OpenAI Responses endpoint (`store: false`); pending Damdle write proposals are printed for review. A JSONL audit log is written to `~/.damdle-agents/audit.jsonl`, or to `DAMDLE_AGENT_AUDIT` if set.

To use a custom JSON agent definition, pass `--agent <file>` or set `DAMDLE_AGENT_FILE`. See [local agent definitions](../../../agents/README.md) and the starter [Founder Guide](../../../agents/founder-guide.json). The runner checks requested scopes against the connector manifest and asks the founder before enabling them.

For a resumable interactive chat:

```powershell
npm run agent -- --chat
npm run agent -- --resume 00000000-0000-4000-8000-000000000000
npm run agent -- --delete-chat 00000000-0000-4000-8000-000000000000
npm run agent -- --forget-credentials
```

Chats are encrypted with AES-256-GCM. Each chat key is stored in the OS credential store; encrypted files live in `~/.damdle-agents/conversations/<server-id>/<profile>/`. `DAMDLE_AGENT_PROFILE` separates histories when multiple founders share one OS login. The model receives the last 12 previous turns plus the current turn. Each stored chat is limited to 5 MiB of plaintext. Type `/exit` to finish; the CLI prints the conversation id and resume command. Deleting a chat removes its encrypted file and key. Audit events remain in a separate, unencrypted JSONL file and do not include prompts or tool results.

OAuth client registration, tokens, PKCE verifier, and discovery state are stored in the operating-system credential store through `@napi-rs/keyring`. The credential entry is keyed by the normalized MCP URL and `DAMDLE_AGENT_PROFILE`, so a later run of the same local profile can reuse its registration and refresh token without sharing OAuth credentials with another profile. Tokens never enter agent messages, tool input, or connector connection metadata. Linux hosts need an available supported credential store; this host fails closed if keyring access fails.

Example wiring:

```ts
import { LocalDamdleMcpHost, requestLocalConnection } from "./src/index.js";
import { DamdleMcpConnector } from "../../../connectors/damdle-mcp/src/index.js";

const host = new LocalDamdleMcpHost({
  serverUrl: process.env.DAMDLE_MCP_URL!,
  profile: process.env.DAMDLE_AGENT_PROFILE ?? "default",
  onAuthorizationUrl: (url) => console.log(`Open this URL to connect Damdle:\n${url}`),
});

await host.connect();
const connector = new DamdleMcpConnector(host);
const connection = await requestLocalConnection(connector.manifest, {
  connectionId: host.connectionId,
  subjectId: `local:${host.connectionId}`,
});
// Pass { connector, connection } into runAgentTurn. Only the accepted local scopes
// are available to the model for this process session.
// The MCP server separately checks the founder's Damdle-side agent permissions.
```

The callback port defaults to `43173` and binds only to `127.0.0.1`. If it is occupied, configure `callbackPort` and register the resulting callback URL with the OAuth authorization server. The default provider uses dynamic client registration, so the Damdle Supabase OAuth server must allow it. For local development, an HTTP loopback MCP endpoint and callback are supported; remote endpoints and authorization servers require HTTPS.

`disconnect()` closes the MCP session while preserving local OAuth credentials. `forgetLocalCredentials()` and `--forget-credentials` remove the selected profile's credentials from the OS keyring without starting a browser login. To revoke Damdle access, the founder should additionally disconnect the app from Damdle's Connected Apps settings; deleting local credentials alone does not revoke the server-side OAuth grant.

The local scope prompt requires a real terminal and defaults every permission to deny. It does not persist those local grants, so the founder reviews them again in a new process session. The local chat store and OAuth keyring entry are per OS user and profile; choose a distinct `DAMDLE_AGENT_PROFILE` for each Damdle account sharing one OS login. This host does not yet provide cross-device sessions or a container/server credential backend. A production self-hosting setup must preserve Damdle's server-side authorization checks.
