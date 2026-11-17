# Damdle Agents architecture

## Product boundary

- **Damdle ecosystem:** the platform and network that provide founder profiles, builds, discovery, resources, opportunities, connections, and other ecosystem capabilities.
- **Damdle Agents:** the open-source actor layer. It hosts or runs agents, connects them to services, and mediates actions on a founder's behalf.
- **Connectors:** adapters between an agent and a service. The Damdle connector is the first-party path into the ecosystem; other connectors let agents work in founders' existing tools.

The open-source project is Damdle Agents, not a copy of the complete ecosystem application. The ecosystem remains an optional, first-party connected service.

## Conceptual layers

1. **Agent definition** — identity, instructions, declared capabilities, and version.
2. **Runtime** — conversation/tool loop, model adapter, cancellation, and execution limits.
3. **Permission and action policy** — granted scopes, risk classification, approval, revocation, and audit events.
4. **Tool interface** — validated inputs and outputs, independent of a particular service or model vendor.
5. **Connectors** — Damdle ecosystem, MCP-compatible services, and future platform-specific integrations.
6. **Hosts** — Damdle-hosted execution, a founder's own server, or a local development runner.

## Trust boundary

Agents receive only the connector credentials and scopes a founder grants. The host resolves connection handles and grants from trusted authorization storage; it never treats scopes supplied by a model or external request as grants. A connector enforces authorization at the service boundary. Agents must never receive the Damdle application's Supabase secret key or privileged database client.

Read, draft, and write actions should remain distinguishable. Each connector owns the approval path appropriate to its service: for example, a Damdle write may create a proposal that the founder approves in Damdle, while a local connector may request approval from its host. Revocation must take effect at the connector and service boundary, not only in the agent prompt.

Tool output and user-provided content are untrusted input. The runtime should preserve that boundary, validate tool schemas, cap resource use, and record enough events to explain what an agent did.

## Existing implementation to learn from

The application currently provides useful behavior to preserve or adapt:

- `src/lib/agents/runtime.ts`: tool-loop execution, limits, saved conversations, and usage recording.
- `src/lib/agents/tools.ts`: capability definitions, scope checks, and proposal-based writes.
- `src/lib/agents/scopes.ts`: declared permissions and risk labels.
- `src/lib/agents/tokens.ts`: generated, hashed agent tokens.
- `src/app/api/mcp/route.ts`: remote MCP endpoint and authentication paths.
- `docs/agents.md`: current product and operational behavior.

These files are coupled to the Damdle app, Supabase, and the current AI Gateway setup. They are reference behavior, not yet a portable package boundary.

## First public interface

An initial draft of the portable contracts is in `packages/contracts/src/index.ts`. It defines agent and connector manifests, named scopes, opaque connection handles, tool invocations, proposal outcomes, and audit events without framework or service imports. The `hasRequiredScopes` helper is a host-side policy check; connectors must also enforce authorization at their service boundary. Hosts should reject outcomes that do not match a tool's declared risk using `isValidOutcomeForRisk`.

The first host-side dispatcher is in `packages/core/src/dispatch.ts`; it validates tool input against JSON Schema before invoking connectors. The Damdle connector adapter in `packages/connectors/damdle-mcp` maps the app's existing MCP tools. `packages/hosts/node-local` supplies an initial official-SDK OAuth client with a loopback callback and OS keyring credential store.

`packages/core/src/agent-runtime.ts` now provides a bounded, provider-neutral tool loop with a recent-history input/output contract. A first model adapter lives in `packages/models/openai-responses`; other model providers can implement the same interface. The local Node host stores resumable chat history as AES-256-GCM ciphertext and keeps each chat key in the OS credential store. This implementation still needs security review and does not provide cross-device synchronization.

Conversation persistence remains a host responsibility. The first OAuth host and connector need validation against a live Damdle account before the interfaces become a stable public API. MCP is a promising transport because the application already exposes it, but the connector contract should not depend on MCP alone. Confirm compatibility against target clients before declaring support.

The current interfaces do not isolate connector code. A host must treat installed connectors as trusted code until an explicit process/container sandbox is designed. Permission metadata alone is not a sandbox. The local host also does not yet provide its own permission-consent UI; its caller must supply only founder-approved scopes.

## Deployment modes

- **Damdle hosted:** lowest setup effort; Damdle operates the runtime and users connect authorized services.
- **Self-hosted:** the operator supplies model credentials and service connections; user data and runtime state remain in the operator's environment except where a connected service is called.
- **Local development:** a minimal runner and example connector for developing agents without production credentials.

Each mode must document where conversation state, tool results, credentials, and audit records are stored.
