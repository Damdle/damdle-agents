# Damdle Agents roadmap

The roadmap prioritizes a dependable open-source core and one useful ecosystem connection before adding many integrations.

## Stage 0 — Product boundary and extraction plan

- [x] Confirm Damdle Agents is the open-source product; the ecosystem app is a connected service.
- [x] Record the first architecture boundary and trust principles.
- [ ] Settle code, documentation, and asset licensing before public release.

## Stage 1 — Portable core

- [x] Draft framework-independent contracts for agent definitions, tools, scopes, connector connections, proposals, and audit events.
- [x] Add a first dispatcher and local example connector demonstrating read, draft, and proposal-only write flows.
- [x] Add a bounded provider-neutral turn loop and an OpenAI Responses API adapter.
- [x] Compile and exercise the local demo, then revise the contracts based on use.
- [x] Prototype a Damdle MCP adapter for the app's current read, draft, and proposal tools.
- [x] Add a generic manifest-driven MCP adapter for explicit read and draft integrations.
- [x] Validate model-generated tool inputs against JSON Schema, including declared formats, before connector invocation.
- [x] Add an initial local Node host for MCP OAuth, callback state validation, and OS keyring credential storage.
- [x] Ask the local founder to approve connector scopes explicitly; default to denying each permission.
- [ ] Validate the host and connector integration against a live Damdle account.
- [ ] Define persistence and authorization lifecycle based on those implementations.
- [x] Separate the initial execution policy from web UI, Supabase clients, Vercel APIs, and Damdle-specific data access.
- Keep the first runtime deliberately small and provider-flexible.

## Stage 2 — Developer and self-hosting experience

- [x] Add a one-turn local CLI runner and a sample agent/connector.
- [x] Load user-authored JSON agent manifests and limit the consent prompt to their requested scopes.
- [x] Add encrypted local conversation history with per-chat keyring keys and explicit deletion.
- [x] Document local setup, model and secret configuration, local persistence, and how to revoke or delete local state.
- [x] Document upgrades and backups for the current local self-hosting boundary.
- [x] Add a credential-free demo container for repeatable contributor setup.
- Provide a container or similarly repeatable deployment path after the runtime boundary is stable.

## Stage 3 — Damdle ecosystem connector

- [x] Define the initial agent catalog, hosted-agent delegation, and founder capability operations.
- [x] Reuse the platform's OAuth/MCP direction without direct access to private database credentials.
- [x] Keep direct writes scoped and visible; pending agent requests and other consequential changes remain subject to founder approval.

## Stage 4 — Integrations and community

- Add connectors based on where target founders work, with clear capability and permission declarations.
- [x] Draft contribution, security reporting, and community conduct guidance.
- [x] Add CI for clean install, compile, CLI help, and local demo.
- [ ] Finalize verified private security and conduct contacts before inviting contributions.
- [ ] Establish release/versioning and a public support path before inviting broad contributions.

## Integration planning

- [x] Define the connector contract and a workflow-first integration selection policy in [integration strategy](integration-strategy.md).

## Release gate

Do not describe the project as ready for general self-hosting until a new operator can follow the setup guide, connect a model and one service, inspect/revoke grants, understand data storage, and run the documented checks from a clean environment.
