# Public architecture boundary

Damdle Agents is a portable agent runtime and local Node host. It connects to
the Damdle ecosystem through an OAuth-protected MCP service and keeps the
founder's credentials in the host's operating-system credential store.

This repository contains:

- portable agent, connector, model-provider, and audit contracts;
- a bounded agent runtime with scope and schema checks;
- a local Node host with encrypted conversation storage;
- the Damdle MCP adapter and a manifest-driven generic MCP adapter; and
- credential-free demos and example agent manifests.

This repository does not contain:

- the Damdle hosted application or its server runtime;
- Damdle database schemas, migrations, or privileged database credentials;
- production user records, production audit data, or deployment secrets;
- OAuth client secrets or access tokens; or
- Damdle logos, mascot artwork, or other restricted brand assets.

The local host connects to a user-authorized Damdle service. It is not a
self-hosted replacement for that service, a multi-tenant server, or a sandbox
for arbitrary connector code. The current release candidate is intended for
development and evaluation until the project publishes a supported production
recipe.
