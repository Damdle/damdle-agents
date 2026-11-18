# Versioning policy

Damdle Agents is still experimental. Until the first public release, package and contract versions may change while the maintainers stabilize the boundaries. Every release should state which parts are experimental and which are supported.

## Public surfaces

The following are versioned surfaces:

- portable contract types and risk semantics in `packages/contracts`;
- connector manifests, scope ids, tool ids, and input schemas;
- agent manifest format;
- host persistence formats and credential namespaces;
- model provider request and response adapters.

## Compatibility rules

- Use semantic versioning once a public package is published.
- A breaking change to a portable type, manifest field, scope meaning, tool id, or persistence format requires a major version or an explicit migration plan.
- New optional fields, tools, connectors, and scopes may be minor releases when existing agents continue to work with the old declarations.
- Bug fixes and documentation changes are patch releases unless they change security behavior or authorization semantics.
- A security correction may require accelerated release notes and a temporary compatibility exception; document the affected versions and migration steps.

Connector and agent manifest versions are independent. A host must reject an unsupported manifest version rather than guessing how to interpret permissions. A connector may add tools only when the host's scope and approval policy can represent them explicitly.

## Release notes

Every release should record:

- supported Node.js and operating-system credential-store versions;
- contract, connector, and host persistence changes;
- permission or approval behavior changes;
- data migration and rollback instructions;
- security fixes and affected versions;
- verification commands run from a clean checkout.

The first public release should remain a pre-1.0 release until live Damdle integration, persistence lifecycle, security review, and self-hosting support have been validated.
