import type {
  AgentMessage,
  JsonValue,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelTool,
  ModelToolCall,
} from "../../../contracts/src/index.js";

export interface OpenAIResponsesOptions {
  readonly apiKey?: string;
  readonly model: string;
  /** Full Responses API URL. Defaults to OpenAI; compatible gateways can be configured explicitly. */
  readonly endpoint?: string;
  readonly fetch?: typeof fetch;
}

type FunctionCallInput = { type: "function_call"; call_id: string; name: string; arguments: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!isRecord(value)) return false;
  return Object.values(value).every(isJsonValue);
};

const isJsonObject = (value: unknown): value is { readonly [key: string]: JsonValue } =>
  isRecord(value) && Object.values(value).every(isJsonValue);

const formatToolName = (index: number) => `damdle_tool_${index}`;

const toolIndex = (tools: readonly ModelTool[]) => new Map(tools.map((entry, index) => [
  `${entry.connectorId}\u0000${entry.tool.id}`,
  formatToolName(index),
]));

function inputItems(messages: readonly AgentMessage[], names: ReadonlyMap<string, string>): unknown[] {
  const output: unknown[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      output.push({ role: "user", content: message.content });
    } else if (message.role === "assistant") {
      if (message.content) output.push({ role: "assistant", content: message.content });
      for (const call of message.toolCalls ?? []) {
        const name = names.get(`${call.connectorId}\u0000${call.toolId}`);
        if (!name) throw new Error(`Model history references an unavailable tool: ${call.toolId}`);
        const item: FunctionCallInput = { type: "function_call", call_id: call.id, name, arguments: JSON.stringify(call.input) };
        output.push(item);
      }
    } else {
      output.push({ type: "function_call_output", call_id: message.callId, output: JSON.stringify(message.content) });
    }
  }
  return output;
}

function parseResponse(body: unknown, names: ReadonlyMap<string, string>): ModelResponse {
  if (!isRecord(body)) throw new Error("Model provider returned an invalid response.");
  const reverseNames = new Map([...names.entries()].map(([key, name]) => [name, key]));
  const output = Array.isArray(body.output) ? body.output : [];
  const textParts: string[] = [];
  const toolCalls: ModelToolCall[] = [];

  for (const item of output) {
    if (!isRecord(item)) continue;
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const content of item.content) {
        if (isRecord(content) && content.type === "output_text" && typeof content.text === "string") textParts.push(content.text);
      }
    }
    if (item.type === "function_call") {
      if (typeof item.name !== "string" || typeof item.call_id !== "string" || typeof item.arguments !== "string") {
        throw new Error("Model provider returned an incomplete tool call.");
      }
      const key = reverseNames.get(item.name);
      if (!key) throw new Error(`Model provider selected an unknown function: ${item.name}`);
      const [connectorId, toolId] = key.split("\u0000");
      let args: unknown;
      try {
        args = JSON.parse(item.arguments);
      } catch (cause) {
        throw new Error("Model provider returned invalid JSON tool arguments.", { cause });
      }
      if (!isJsonObject(args)) throw new Error("Model tool arguments must be a JSON object.");
      toolCalls.push({ id: item.call_id, connectorId, toolId, input: args });
    }
  }

  const usage = isRecord(body.usage) ? {
    inputTokens: typeof body.usage.input_tokens === "number" ? body.usage.input_tokens : undefined,
    outputTokens: typeof body.usage.output_tokens === "number" ? body.usage.output_tokens : undefined,
  } : undefined;

  return {
    ...(textParts.length ? { text: textParts.join("\n") } : {}),
    ...(toolCalls.length ? { toolCalls } : {}),
    ...(usage ? { usage } : {}),
  };
}

/** ModelProvider adapter for the OpenAI Responses API; no SDK dependency is required. */
export class OpenAIResponsesProvider implements ModelProvider {
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;
  private readonly options: OpenAIResponsesOptions;

  constructor(options: OpenAIResponsesOptions) {
    if (!options.model.trim()) throw new Error("A model name is required.");
    const endpoint = new URL(options.endpoint ?? "https://api.openai.com/v1/responses");
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && localHosts.has(endpoint.hostname))) {
      throw new Error("Model endpoints must use HTTPS unless they are on loopback.");
    }
    this.endpoint = endpoint.toString();
    this.fetcher = options.fetch ?? fetch;
    this.options = options;
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const names = toolIndex(request.tools);
    const tools = request.tools.map((entry, index) => ({
      type: "function",
      name: formatToolName(index),
      description: entry.tool.description,
      parameters: entry.tool.inputSchema,
    }));
    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.options.model,
        instructions: request.instructions,
        input: inputItems(request.messages, names),
        max_output_tokens: request.maxOutputTokens,
        store: false,
        ...(tools.length ? { tools, tool_choice: "auto" } : {}),
      }),
      signal: request.signal,
    });

    if (!response.ok) {
      throw new Error(`Model provider request failed with HTTP ${response.status}. Check the endpoint, model, and API key.`);
    }
    return parseResponse(await response.json(), names);
  }
}
