import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { ConnectorManifest, ConnectorConnection } from "../../../contracts/src/index.js";

/** Ask a local founder to grant connector scopes for the current host session. */
export async function requestLocalConnection(
  connector: ConnectorManifest,
  options: {
    readonly connectionId: string;
    readonly subjectId: string;
    readonly requestedScopes?: readonly string[];
  },
): Promise<ConnectorConnection> {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("Connector permissions require an interactive terminal. No scopes were granted.");
  }
  const prompt = createInterface({ input: stdin, output: stdout });
  const grantedScopes: string[] = [];
  const requested = options.requestedScopes ? new Set(options.requestedScopes) : new Set(connector.scopes.map((scope) => scope.id));
  const knownScopes = new Set(connector.scopes.map((scope) => scope.id));
  const unknown = [...requested].filter((scope) => !knownScopes.has(scope));
  if (unknown.length) {
    prompt.close();
    throw new Error(`The agent requests unsupported connector scope(s): ${unknown.join(", ")}`);
  }
  try {
    stdout.write(`\n${connector.name} permissions requested by this agent:\n`);
    stdout.write("These local grants apply to this session. Damdle will also enforce its own account permissions.\n\n");
    for (const scope of connector.scopes.filter((item) => requested.has(item.id))) {
      stdout.write(`[${scope.risk.toUpperCase()}] ${scope.title}\n${scope.description}\n`);
      if (scope.risk === "write") stdout.write("This can create a proposal; Damdle still requires you to approve it before it takes effect.\n");
      const answer = await prompt.question("Grant this permission? [y/N] ");
      if (answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes") grantedScopes.push(scope.id);
      stdout.write("\n");
    }
  } finally {
    prompt.close();
  }
  return { id: options.connectionId, subjectId: options.subjectId, grantedScopes };
}
