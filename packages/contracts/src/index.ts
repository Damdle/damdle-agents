/** JSON-compatible values used at agent and connector boundaries. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
export type JsonSchema = { readonly [keyword: string]: JsonValue };

export type RiskLevel = "read" | "draft" | "write";

/** A named permission shown to the person authorizing an agent. */
export interface PermissionScope {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly risk: RiskLevel;
}

/** Describes an agent independently of its host, model provider, or connected services. */
export interface AgentManifest {
  readonly manifestVersion: "1";
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly requestedScopes: readonly string[];
}

export interface ModelTool {
  readonly connectorId: string;
  readonly tool: ToolManifest;
}

export interface ModelToolCall {
  readonly id: string;
  readonly connectorId: string;
  readonly toolId: string;
  readonly input: JsonValue;
}

export type AgentMessage =
  | { readonly role: "user"; readonly content: string }
  | { readonly role: "assistant"; readonly content: string; readonly toolCalls?: readonly ModelToolCall[] }
  | {
      readonly role: "tool";
      readonly callId: string;
      readonly connectorId: string;
      readonly toolId: string;
      readonly content: ToolOutcome | { readonly status: "error"; readonly message: string };
      /** Tool output can contain user-authored text; model adapters must preserve this trust label. */
      readonly untrusted: true;
    };

export interface ModelUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

export interface ModelRequest {
  readonly instructions: string;
  readonly messages: readonly AgentMessage[];
  readonly tools: readonly ModelTool[];
  readonly maxOutputTokens: number;
  readonly signal?: AbortSignal;
}

export interface ModelResponse {
  readonly text?: string;
  readonly toolCalls?: readonly ModelToolCall[];
  readonly usage?: ModelUsage;
}

/** Implementations adapt a model vendor or local model to the portable turn contract. */
export interface ModelProvider {
  generate(request: ModelRequest): Promise<ModelResponse>;
}

/** Describes one callable capability exposed by an agent connector. */
export interface ToolManifest {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  readonly requiredScopes: readonly string[];
  readonly risk: RiskLevel;
}

/** Host-resolved connection authorization; never deserialize this directly from a model/client request. */
export interface ConnectorConnection {
  readonly id: string;
  readonly subjectId: string;
  readonly grantedScopes: readonly string[];
  readonly expiresAt?: string;
}

/** Returns false for malformed or expired authorization timestamps. Hosts should fail closed. */
export function isConnectionActive(connection: ConnectorConnection, now = new Date()): boolean {
  if (!connection.expiresAt) return true;
  const expiresAt = Date.parse(connection.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

export interface ToolInvocation {
  readonly id: string;
  readonly toolId: string;
  readonly input: JsonValue;
  readonly connection: ConnectorConnection;
}

export interface ActionProposal {
  readonly id: string;
  readonly toolId: string;
  readonly summary: string;
  readonly input: JsonValue;
  readonly createdAt?: string;
  readonly expiresAt?: string;
  readonly approvalUrl?: string;
}

/** Write tools return a proposal. A host or connected service handles approval and execution. */
export type ToolOutcome =
  | { readonly status: "completed"; readonly output: JsonValue }
  | { readonly status: "proposed"; readonly proposal: ActionProposal };

/** Enforces the contract that write-risk tools propose first; only read/draft tools complete inline. */
export function isValidOutcomeForRisk(risk: RiskLevel, outcome: ToolOutcome): boolean {
  return risk === "write" ? outcome.status === "proposed" : outcome.status === "completed";
}

export interface ConnectorManifest {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly scopes: readonly PermissionScope[];
  readonly tools: readonly ToolManifest[];
}

/**
 * Connector implementations enforce grants again at the service boundary. Hosts must check them
 * before dispatch too. The connection carries no bearer token or provider secret.
 */
export interface AgentConnector {
  readonly manifest: ConnectorManifest;
  invoke(invocation: ToolInvocation, signal?: AbortSignal): Promise<ToolOutcome>;
}

export type AuditOutcome = "started" | "completed" | "proposed" | "denied" | "failed";

export interface AuditEvent {
  readonly id: string;
  readonly occurredAt: string;
  readonly actorId: string;
  readonly agentId: string;
  readonly connectorId: string;
  readonly toolId: string;
  readonly risk: RiskLevel;
  readonly outcome: AuditOutcome;
  readonly summary?: string;
}

export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}

/** Host-side policy gate: refuse calls whose requested scopes were not granted. */
export function hasRequiredScopes(
  required: readonly string[],
  granted: readonly string[],
): boolean {
  const grantSet = new Set(granted);
  return required.every((scope) => grantSet.has(scope));
}
