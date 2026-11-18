# Damdle Agents architecture

## Product boundary

- **Damdle ecosystem:** the connected service that provides founder identity,
  permissions, discovery, resources, opportunities, and approvals.
- **Damdle Agents:** the open-source actor layer that runs agents and mediates
  their interactions with connected services.
- **Connectors:** narrow adapters between an agent and a service.
- **Hosts:** processes that own credentials, grants, persistence, and runtime
  policy.

Damdle Agents is not a copy of the complete Damdle application. The ecosystem
remains a connected first-party service with its own authentication and
authorization boundary.

## Runtime layers

1. **Agent definition** — identity, instructions, declared capabilities, and
   version.
2. **Runtime** — conversation and tool loop, model adapter, cancellation, and
   execution limits.
3. **Permission and action policy** — granted scopes, risk classification,
   approval, revocation, and audit events.
4. **Tool interface** — validated inputs and outputs independent of a model or
   service vendor.
5. **Connectors** — Damdle MCP, generic MCP, and future service adapters.
6. **Hosts** — local development, private deployments, or a future hosted
   runtime.

## Trust boundary

The host resolves connection handles and grants from trusted authorization
storage. A model response or agent manifest never grants access. The connector
and the connected service must enforce authorization independently.

Tool output and user content are untrusted input. The runtime validates tool
schemas, caps steps and calls, and records audit events without copying
credentials or full private content. Read, draft, and write actions remain
distinct. Consequential actions should produce a proposal or use a service-side
approval flow.

Credentials belong to the host. They must not enter model messages, tool
arguments, agent manifests, or audit summaries. The local host stores OAuth
material in the operating-system credential store and encrypts resumable chat
history locally.

## Public interfaces

The portable contracts define agent manifests, connector manifests, scopes,
opaque connection handles, tool invocations, outcomes, proposals, and audit
events. The dispatcher validates scope grants and JSON Schema before invoking a
connector, then validates returned outcomes against the tool's declared risk.

The local Node host supplies interactive OAuth with a loopback callback, local
scope consent, an OS keyring, encrypted conversation storage, and a CLI. The
Damdle connector maps explicit ecosystem operations onto an authorized MCP
session. The generic MCP adapter requires an explicit manifest and does not
auto-discover or authorize arbitrary remote tools.

## Deployment modes

- **Local development:** credential-free demos and a local runner for building
  and evaluating agents.
- **Private deployment:** an operator-controlled process with its own model
  credentials and service connections.
- **Damdle hosted:** a future or separate service that operates the runtime for
  founders.

The current local host is not a multi-tenant server and does not sandbox
connector code. Treat installed connectors as trusted code until an explicit
sandbox design is available.
