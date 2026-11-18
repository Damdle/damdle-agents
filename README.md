# Damdle Agents

Damdle Agents is the open-source agent layer for the Damdle ecosystem.

The Damdle ecosystem brings together the people, tools, knowledge, and opportunities founders need. Damdle Agents are the actors founders can use to navigate that ecosystem and, over time, the other tools and places where they work.

The project is intended to support both Damdle-hosted agents and agents people run themselves. A self-hosted agent should connect through supported, user-authorized interfaces. It must not need private database credentials or platform service secrets.

## Project status

This local folder is an independent Git repository scaffold nested in a checkout of the Damdle application. It contains a newly written portable agent prototype; the Damdle app's existing hosted runtime and MCP service have not been copied here. The app's relevant implementation boundaries and extraction risks are listed in [the extraction audit](docs/extraction-audit.md). This is not yet the public remote repository.

See [Architecture](docs/architecture.md), [Roadmap](docs/roadmap.md), [Self-hosting](docs/self-hosting.md), [Contributing](CONTRIBUTING.md), [Security](SECURITY.md), [License decision](LICENSE-DECISION.md), and the first [portable contracts](packages/contracts/README.md). The core agent loop and local demo live under `packages/core` and `packages/examples/local`; the first-party [Damdle MCP adapter](packages/connectors/damdle-mcp/README.md) targets the app's existing remote MCP server. An initial [OpenAI Responses provider](packages/models/openai-responses/README.md) demonstrates a model integration without a vendor SDK dependency.

To try the isolated local demo, use Node.js 22.6 or newer and run `npm run demo` from this folder. It uses an in-memory audit sink and sample data only. `npm run build` compiles the workspace. An initial [local Node host](packages/hosts/node-local/README.md) implements OAuth authorization, local scope consent, secure credential storage, one-turn and resumable CLI chats, encrypted conversation history, and a local audit log. You can define custom JSON agents; see [agents/](agents/README.md). This is not yet a production deployment recipe.

The credential-free demo can also run in a repeatable container: `docker build -f Dockerfile.demo -t damdle-agents-demo .` followed by `docker run --rm damdle-agents-demo`. `Dockerfile.demo` is intentionally limited to the sample demo; it is not a self-hosted Damdle service or a production agent host.

For other MCP-compatible services, `packages/connectors/mcp` provides a manifest-driven adapter for explicit read and draft tools. It does not auto-discover remote tools or authorize generic writes.

## Intended design principles

Read the [integration strategy](docs/integration-strategy.md) for the connector contract and the workflow-first plan for future founder surfaces. The [publication checklist](docs/publication-checklist.md) records the gates for creating the public repository.

- **Portable:** can run as a hosted service or in a deployment controlled by the founder.
- **Connected:** reaches Damdle and other services through replaceable connectors.
- **Permissioned:** tools declare scopes; users grant and can revoke access.
- **Reviewable:** consequential actions have an approval path and an audit trail.
- **Provider-flexible:** model and hosting choices are adapters, not assumptions baked into agent definitions.

## Not ready for production

No supported self-hosting recipe, stable public API, or open-source license has been published from this scaffold. The local demo is illustrative and has not been security-reviewed. The license and rights for code and non-code assets must be settled before public release.
