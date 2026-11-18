# Integration strategy

Damdle Agents should meet founders where work already happens while keeping the agent's authority in one host. Integrations are connectors, not copies of an application's database or UI. Every connector presents a small, reviewable capability surface to the runtime.

## Connector contract

Each connector must provide:

1. A stable id and version.
2. Named scopes with plain-language descriptions and a risk level (`read`, `draft`, or `write`).
3. Tool schemas that reject unknown fields and bound text, identifiers, and result sizes.
4. A host-resolved connection handle. Credentials stay in the host and never enter model messages or tool arguments.
5. A service-side authorization check on every invocation.
6. A proposal or external approval step for consequential writes.
7. Audit events that identify the actor, agent, connector, tool, risk, and outcome without copying secrets or full private content.

The portable interfaces live in `packages/contracts`. The dispatcher checks scopes and schemas before invoking a connector; the connector and remote service must check authorization again. A connector must treat content returned from a service as untrusted input.

## Integration layers

| Layer | Purpose | Initial direction |
| --- | --- | --- |
| Damdle ecosystem | Founder identity, Build Space, discovery, opportunities, hosted agents, and approval UI | First-party MCP connector, implemented |
| Work communication | Draft and, with explicit approval, send messages in places founders already communicate | Slack, email, and WhatsApp connectors after the core approval contract is validated; generic MCP can cover read/draft services now |
| Work systems | Read context and prepare changes in planning, code, CRM, and finance tools | Add one connector per workflow; avoid broad administrator scopes |
| Agent-to-agent | Discover, inspect, request, and use hosted or external agents | Damdle catalog and delegation tools are the first implementation |
| Local resources | Files, calendars, and local development tools | Opt-in local connectors with OS-level isolation and narrow paths |

## How an integration should be added

Start with one founder workflow and a read-only vertical slice. Document the user value, data exchanged, OAuth permissions, rate limits, failure behavior, and revocation path. Add draft actions next, so the founder can inspect the result. Add writes only when the remote service has a reliable approval or undo path.

Before merging a connector, verify that:

- the requested OAuth scopes are the minimum needed;
- the manifest names every capability the model can invoke;
- schemas reject oversized or unexpected input;
- tokens are held by the host, not the connector or model;
- expired or revoked grants fail closed;
- retries cannot duplicate a write;
- audit output is useful without exposing message bodies, credentials, or private records;
- the connector can be disabled without changing the portable runtime.

## Product direction

The ecosystem remains the place where founder identity, Damdle permissions, hosted-agent access, and high-impact approvals are managed. Damdle Agents supplies the actor layer and connector protocol. This lets a founder run an agent locally or on private infrastructure while preserving Damdle's service-side authorization when the agent uses ecosystem capabilities.

The next integration should be selected from observed founder workflows, not from the number of available APIs. A small set of deep, permissioned connectors is more useful than a catalog of shallow tools that cannot explain what an agent is allowed to do.

For an MCP service without a first-party adapter, use `packages/connectors/mcp` with an explicit manifest. Do not auto-import the remote tool list into the agent. Keep write-capable services behind a dedicated connector until their approval semantics are documented and enforced.
