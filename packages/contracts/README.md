# Portable contracts

This folder starts the package boundary for Damdle Agents. Its public types describe agent manifests, scopes, tool calls, connector connections, proposals, and audit events without importing Next.js, Supabase, Vercel, an AI SDK, or a model vendor.

The contracts are an internal draft, not a stable public API. Keep runtime-specific implementations in adapters until the interfaces have been exercised by a local runner and the Damdle connector.

The interfaces do not sandbox connector code. Hosts must check the outcome against the tool's declared risk with `isValidOutcomeForRisk` and reject mismatches. Only load connectors the operator trusts; a future untrusted-agent marketplace needs a separate process/container isolation design.

`ConnectorConnection.expiresAt` is enforced by the core runtime and dispatcher. Missing expiry is treated as an ongoing host-managed grant; malformed or past timestamps fail closed.
