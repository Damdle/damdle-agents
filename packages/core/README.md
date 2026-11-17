# Core dispatcher

`src/dispatch.ts` is the first host-side execution boundary. It resolves a tool from the connector manifest, checks the connection's granted scopes, requires a persisted `started` audit event before invocation, rejects outcomes inconsistent with the declared risk, and records the final result. The host must construct `invocation.connection` from its trusted connection/authorization store; never accept caller- or model-supplied scopes as grants.

Inputs are validated against each tool's declared JSON Schema, including declared formats, before invocation; invalid calls are audited as denied. If final audit storage fails after a read or proposal result is returned, the receipt has `auditComplete: false`. Hosts should surface this state and must not retry automatically. This dispatcher does not execute proposals; approval and execution need a separate, service-aware lifecycle.

This is an early reference implementation, not a security sandbox. The connector repeats its permission check, but self-hosting arbitrary connector code still means trusting that code.
