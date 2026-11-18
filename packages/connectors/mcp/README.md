# Generic MCP connector

`GenericMcpConnector` adapts an already-authorized MCP client to the portable Damdle Agents connector contract. The host owns authentication, tokens, and the connection handle. The connector receives no bearer credential.

Each tool must be declared in a manifest with a local id, remote MCP name, input JSON Schema, required scopes, and a risk level. The constructor rejects tools that refer to undeclared scopes or duplicate local ids. Generic tools support `read` and `draft` risk only; write actions need a service-specific adapter that can prove its proposal and approval behavior.

The dispatcher still validates inputs and grants before invocation. The MCP service must enforce authorization again, and all returned content is treated as untrusted tool output.

This adapter does not discover arbitrary remote tools automatically. Explicit manifests make the permissions visible to founders and prevent a remote server from silently expanding an agent's capability surface.
