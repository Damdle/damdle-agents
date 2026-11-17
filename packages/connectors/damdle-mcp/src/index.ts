import {
  hasRequiredScopes,
  type ActionProposal,
  type AgentConnector,
  type ConnectorManifest,
  type JsonValue,
  type ToolInvocation,
  type ToolOutcome,
} from "../../../contracts/src/index.js";

/** A pre-authenticated MCP client. The host owns MCP OAuth and token storage. */
export interface DamdleMcpClient {
  callTool(
    name: string,
    args: { readonly [key: string]: JsonValue },
    options?: { readonly signal?: AbortSignal },
  ): Promise<McpToolResult>;
}

/** Resolve an already-authorized session by opaque connection id; do not return credentials to tools. */
export interface DamdleMcpClientProvider {
  forConnection(connectionId: string, signal?: AbortSignal): Promise<DamdleMcpClient | null>;
}

export interface McpToolResult {
  readonly isError?: boolean;
  readonly structuredContent?: unknown;
  readonly content?: readonly { readonly type: string; readonly text?: string }[];
}

type Mapping = {
  id: string;
  title: string;
  description: string;
  damdleTool: string;
  scope: string;
  risk: "read" | "draft" | "write";
  readonly writeFlow?: "rental_request";
  inputSchema: { readonly [key: string]: JsonValue };
};

const mappings: readonly Mapping[] = [
  {
    id: "agents.search", title: "Find Damdle agents", damdleTool: "list_agents", scope: "read:agents", risk: "read",
    description: "Search the published Damdle agent catalog by use case or words in the name.",
    inputSchema: { type: "object", properties: { use_case: { type: "string", maxLength: 20 }, q: { type: "string", maxLength: 60 } }, additionalProperties: false },
  },
  {
    id: "agents.describe", title: "Read about a Damdle agent", damdleTool: "get_agent", scope: "read:agents", risk: "read",
    description: "Get the public description and requested permissions for a published Damdle agent.",
    inputSchema: { type: "object", properties: { slug: { type: "string", pattern: "^[a-z0-9-]{2,40}$" } }, required: ["slug"], additionalProperties: false },
  },
  {
    id: "agents.mine", title: "List your Damdle agents", damdleTool: "list_my_agents", scope: "read:my_agents", risk: "read",
    description: "List the agents this founder has added and the permissions granted to each.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    id: "agents.request", title: "Request a Damdle agent", damdleTool: "request_rental", scope: "write:request_agent", risk: "write", writeFlow: "rental_request",
    description: "Create a request for the founder to add a published Damdle agent. The agent is not activated until the founder reviews the request and grants its permissions in My Agents.",
    inputSchema: { type: "object", properties: { slug: { type: "string", pattern: "^[a-z0-9-]{2,40}$" } }, required: ["slug"], additionalProperties: false },
  },
  {
    id: "agents.ask", title: "Ask a Damdle-hosted agent", damdleTool: "ask_agent", scope: "use:hosted_agents", risk: "draft",
    description: "Ask one of this founder's Damdle-hosted agents for an answer. This runs a hosted model call, consumes that agent's daily usage budget, and may create a saved Damdle conversation. The hosted agent still observes the founder's granted scopes and proposes consequential actions for approval.",
    inputSchema: { type: "object", properties: { message: { type: "string", minLength: 1, maxLength: 4000 }, agent: { type: "string", pattern: "^[a-z0-9-]{2,40}$", default: "builder" } }, required: ["message"], additionalProperties: false },
  },
  {
    id: "toolbox.search", title: "Search the Toolbox", damdleTool: "search_toolbox", scope: "read:toolbox", risk: "read",
    description: "Search Damdle's reviewed tools, learning resources, and services.",
    inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 80 }, kind: { type: "string", maxLength: 10 }, category: { type: "string", maxLength: 40 }, stage: { type: "string", maxLength: 12 }, pricing: { type: "string", maxLength: 10 } }, additionalProperties: false },
  },
  {
    id: "opportunities.search", title: "Search opportunities", damdleTool: "search_opportunities", scope: "read:opportunities", risk: "read",
    description: "Search open funding, programmes, events, jobs, partnerships, competitions, and fellowships.",
    inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 80 }, kind: { type: "string", maxLength: 14 }, stage: { type: "string", maxLength: 12 }, region: { type: "string", maxLength: 60 } }, additionalProperties: false },
  },
  {
    id: "people.search", title: "Find builders", damdleTool: "search_people", scope: "read:people", risk: "read",
    description: "Find builders who have chosen to be discoverable on Damdle.",
    inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 80 }, role: { type: "string", maxLength: 14 }, stage: { type: "string", maxLength: 12 }, skill: { type: "string", maxLength: 40 }, looking: { type: "string", maxLength: 20 }, country: { type: "string", maxLength: 60 } }, additionalProperties: false },
  },
  {
    id: "builds.search", title: "Search public builds", damdleTool: "search_builds", scope: "read:builds", risk: "read",
    description: "Search builds their owners have made public.",
    inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 80 }, stage: { type: "string", maxLength: 12 }, sector: { type: "string", maxLength: 40 }, need: { type: "string", maxLength: 20 } }, additionalProperties: false },
  },
  {
    id: "build.read", title: "Read your Build Space", damdleTool: "get_my_build", scope: "read:my_build", risk: "read",
    description: "Read the connected founder's profile, Build Space, and milestones.", inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    id: "collection.list", title: "Read My Collection", damdleTool: "list_saved", scope: "read:collection", risk: "read",
    description: "List resources and opportunities saved by the connected founder.", inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    id: "inbox.summary", title: "Check your inbox summary", damdleTool: "get_inbox", scope: "read:my_build", risk: "read",
    description: "Check pending connection requests, unread messages, and recent notifications.", inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    id: "message.draft", title: "Draft a message", damdleTool: "draft_message", scope: "draft:message", risk: "draft",
    description: "Draft an introduction for the founder to review; it will not be sent.",
    inputSchema: { type: "object", properties: { person_id: { type: "string", format: "uuid" }, body: { type: "string", minLength: 10, maxLength: 600 } }, required: ["person_id", "body"], additionalProperties: false },
  },
  {
    id: "collection.save", title: "Propose saving an item", damdleTool: "save_item", scope: "write:save", risk: "write",
    description: "Propose saving a Toolbox resource or opportunity. The founder approves the proposal in Damdle.",
    inputSchema: { type: "object", properties: { type: { type: "string", enum: ["resource", "opportunity"] }, id: { type: "string", format: "uuid" } }, required: ["type", "id"], additionalProperties: false },
  },
  {
    id: "build.milestone.propose", title: "Propose a milestone", damdleTool: "add_milestone", scope: "write:milestone", risk: "write",
    description: "Propose a milestone for the founder's Build Space. The founder approves it in Damdle.",
    inputSchema: { type: "object", properties: { title: { type: "string", minLength: 2, maxLength: 120 }, due_date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } }, required: ["title"], additionalProperties: false },
  },
  {
    id: "connection.propose", title: "Propose a connection request", damdleTool: "request_connection", scope: "write:connection", risk: "write",
    description: "Propose a connection request. The founder approves it in Damdle before it is sent.",
    inputSchema: { type: "object", properties: { person_id: { type: "string", format: "uuid" }, note: { type: "string", maxLength: 300 } }, required: ["person_id"], additionalProperties: false },
  },
  {
    id: "yard.post.propose", title: "Propose a Yard post", damdleTool: "post_to_yard", scope: "write:post", risk: "write",
    description: "Propose a post in the Damdle Yard. The founder approves it in Damdle before it is published.",
    inputSchema: { type: "object", properties: { kind: { type: "string", enum: ["building", "need", "offer", "learned", "win", "question", "showcase", "challenge"] }, body: { type: "string", minLength: 1, maxLength: 1200 } }, required: ["kind", "body"], additionalProperties: false },
  },
];

const scopes = [...new Set(mappings.map((mapping) => mapping.scope))];

const manifest: ConnectorManifest = {
  id: "damdle.ecosystem.mcp",
  version: "0.1.0",
  name: "Damdle ecosystem",
  description: "Connect an agent to the founder-authorized Damdle ecosystem MCP server.",
  scopes: scopes.map((id) => {
    const mapping = mappings.find((candidate) => candidate.scope === id)!;
    return { id: `damdle:${id}`, title: mapping.title, description: mapping.description, risk: mapping.risk };
  }),
  tools: mappings.map((mapping) => ({
    id: mapping.id,
    title: mapping.title,
    description: mapping.description,
    inputSchema: mapping.inputSchema,
    requiredScopes: [`damdle:${mapping.scope}`],
    risk: mapping.risk,
  })),
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isJsonObject = (value: JsonValue): value is { readonly [key: string]: JsonValue } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!isRecord(value)) return false;
  return Object.values(value).every(isJsonValue);
};

function normalizeResult(result: McpToolResult): JsonValue {
  if (result.isError) {
    const message = result.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join(" ").slice(0, 400);
    throw new Error(message || "Damdle returned an MCP tool error.");
  }
  if (isJsonValue(result.structuredContent)) return result.structuredContent;

  const text = result.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n").trim();
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (isJsonValue(parsed)) return parsed;
  } catch {
    // Some MCP clients return plain text rather than Damdle's JSON text wrapper.
  }
  return { text };
}

function proposalFromDamdle(value: JsonValue, mapping: Mapping, invocation: ToolInvocation): ActionProposal {
  if (mapping.writeFlow === "rental_request") {
    if (isRecord(value) && value.status === "pending_approval" && typeof value.message === "string") {
      return {
        id: `request:${invocation.id}`,
        toolId: mapping.id,
        summary: value.message,
        input: invocation.input,
      };
    }
    if (isRecord(value) && typeof value.message === "string") {
      throw new Error(value.message);
    }
    throw new Error("Damdle did not return a recognizable pending agent request.");
  }
  if (!isRecord(value) || value.status !== "proposed" || typeof value.actionId !== "string" || typeof value.summary !== "string") {
    throw new Error("Damdle did not return a recognizable pending action proposal.");
  }
  const proposal: ActionProposal = {
    id: value.actionId,
    toolId: mapping.id,
    summary: value.summary,
    input: invocation.input,
    ...(typeof value.createdAt === "string" ? { createdAt: value.createdAt } : {}),
    ...(typeof value.expiresAt === "string" ? { expiresAt: value.expiresAt } : {}),
    ...(typeof value.approve_in_damdle === "string" ? { approvalUrl: value.approve_in_damdle } : {}),
  };
  return proposal;
}

/**
 * Adapter from the portable connector contract to Damdle's current remote MCP tool names.
 * OAuth/session setup is supplied by the host through `DamdleMcpClientProvider`.
 */
export class DamdleMcpConnector implements AgentConnector {
  readonly manifest = manifest;
  private readonly clients: DamdleMcpClientProvider;

  constructor(clients: DamdleMcpClientProvider) {
    this.clients = clients;
  }

  async invoke(invocation: ToolInvocation, signal?: AbortSignal): Promise<ToolOutcome> {
    const mapping = mappings.find((candidate) => candidate.id === invocation.toolId);
    if (!mapping) throw new Error(`Unknown Damdle connector tool: ${invocation.toolId}`);
    const requiredScope = `damdle:${mapping.scope}`;
    if (!hasRequiredScopes([requiredScope], invocation.connection.grantedScopes)) {
      throw new Error(`Permission was not granted for ${mapping.id}`);
    }
    const args = invocation.input;
    if (!isJsonObject(args)) {
      throw new Error("Damdle tool input must be a JSON object.");
    }
    const client = await this.clients.forConnection(invocation.connection.id, signal);
    if (!client) throw new Error("No authorized Damdle connection is available. Connect your account first.");

    const value = normalizeResult(await client.callTool(mapping.damdleTool, args, { signal }));
    if (mapping.risk === "write") return { status: "proposed", proposal: proposalFromDamdle(value, mapping, invocation) };
    return { status: "completed", output: value };
  }
}
