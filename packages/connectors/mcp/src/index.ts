import type {
  AgentConnector,
  ConnectorManifest,
  JsonValue,
  PermissionScope,
  ToolInvocation,
  ToolManifest,
  ToolOutcome,
} from "../../../contracts/src/index.js";

/** A host-owned, already-authorized MCP session. Credentials never enter this connector. */
export interface GenericMcpClient {
  callTool(name: string, args: { readonly [key: string]: JsonValue }, options?: { readonly signal?: AbortSignal }): Promise<GenericMcpResult>;
}

export interface GenericMcpResult {
  readonly isError?: boolean;
  readonly structuredContent?: unknown;
  readonly content?: readonly { readonly type: string; readonly text?: string }[];
}

export interface GenericMcpToolDefinition {
  readonly id: string;
  readonly remoteName: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: { readonly [key: string]: JsonValue };
  readonly requiredScopes: readonly string[];
  readonly risk: "read" | "draft";
}

export interface GenericMcpConnectorOptions {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly scopes: readonly PermissionScope[];
  readonly tools: readonly GenericMcpToolDefinition[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
};

const isJsonObject = (value: JsonValue): value is { readonly [key: string]: JsonValue } =>
  isRecord(value) && isJsonValue(value);

function normalizeResult(result: GenericMcpResult): JsonValue {
  if (result.isError) {
    const message = result.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join(" ").slice(0, 400);
    throw new Error(message || "The MCP service returned a tool error.");
  }
  if (isJsonValue(result.structuredContent)) return result.structuredContent;
  const text = result.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n").trim();
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (isJsonValue(parsed)) return parsed;
  } catch {
    // Some MCP servers return plain text rather than a JSON text wrapper.
  }
  return { text };
}

/** Manifest-driven adapter for an already-authorized MCP service. */
export class GenericMcpConnector implements AgentConnector {
  readonly manifest: ConnectorManifest;
  private readonly client: GenericMcpClient;
  private readonly remoteNames: ReadonlyMap<string, string>;

  constructor(client: GenericMcpClient, options: GenericMcpConnectorOptions) {
    const toolIds = new Set<string>();
    const remoteNames = new Map<string, string>();
    const knownScopes = new Set(options.scopes.map((scope) => scope.id));
    for (const tool of options.tools) {
      if (toolIds.has(tool.id)) throw new Error(`Duplicate generic MCP tool id: ${tool.id}`);
      if (!tool.id || !tool.remoteName) throw new Error("Generic MCP tools require id and remoteName.");
      if (tool.requiredScopes.some((scope) => !knownScopes.has(scope))) throw new Error(`Generic MCP tool ${tool.id} references an undeclared scope.`);
      toolIds.add(tool.id);
      remoteNames.set(tool.id, tool.remoteName);
    }
    this.client = client;
    this.remoteNames = remoteNames;
    this.manifest = {
      id: options.id,
      version: options.version,
      name: options.name,
      description: options.description,
      scopes: [...options.scopes],
      tools: options.tools.map(({ remoteName: _remoteName, ...tool }): ToolManifest => tool),
    };
  }

  async invoke(invocation: ToolInvocation, signal?: AbortSignal): Promise<ToolOutcome> {
    const tool = this.manifest.tools.find((candidate) => candidate.id === invocation.toolId);
    if (!tool) throw new Error(`Generic MCP tool is not registered: ${invocation.toolId}`);
    if (!isJsonObject(invocation.input)) throw new Error(`MCP tool input must be an object: ${tool.id}`);
    const result = await this.client.callTool(this.remoteNames.get(tool.id)!, invocation.input, { signal });
    return { status: "completed", output: normalizeResult(result) };
  }
}
