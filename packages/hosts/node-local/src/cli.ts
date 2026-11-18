// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Damdle
import { chmod, mkdir, open, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { runAgentTurn } from "../../../core/src/agent-runtime.js";
import type { AgentManifest, AgentMessage, AuditEvent, AuditSink, ConnectorManifest } from "../../../contracts/src/index.js";
import { DamdleMcpConnector } from "../../../connectors/damdle-mcp/src/index.js";
import { OpenAIResponsesProvider } from "../../../models/openai-responses/src/index.js";
import { LocalDamdleMcpHost } from "./damdle-mcp-host.js";
import { requestLocalConnection } from "./scope-consent.js";
import { EncryptedConversationStore } from "./conversation-store.js";

const usage = `Damdle Agents local runner

Usage:
  npm run agent -- "your founder task"
  npm run agent -- --chat
  npm run agent -- --resume <conversation-id>
  npm run agent -- --delete-chat <conversation-id>
  npm run agent -- --forget-credentials
  npm run agent -- --agent <agent.json> "your founder task"

Required environment:
  DAMDLE_MCP_URL       Damdle MCP URL, such as https://damdle.com/api/mcp
  OPENAI_API_KEY       OpenAI API key
  OPENAI_MODEL         Model name supported by the Responses API

Optional environment:
  OPENAI_RESPONSES_URL Full Responses API URL for a compatible gateway
  DAMDLE_AGENT_AUDIT   Audit JSONL path (defaults to ~/.damdle-agents/audit.jsonl)
  DAMDLE_AGENT_PROFILE Local conversation profile (defaults to default)
  DAMDLE_AGENT_FILE    Default JSON agent manifest (defaults to agents/founder-guide.json)
  DAMDLE_OAUTH_PORT    Loopback OAuth callback port (defaults to 43173)
`;

const DEFAULT_AGENT_FILE = fileURLToPath(new URL("../../../../agents/founder-guide.json", import.meta.url));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function loadAgentManifest(filePath: string, connector: ConnectorManifest): Promise<AgentManifest> {
  const text = await readFile(filePath, "utf8");
  if (Buffer.byteLength(text, "utf8") > 64 * 1024) throw new Error("Agent manifest must be smaller than 64 KiB.");
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (cause) {
    throw new Error("Agent manifest is not valid JSON.", { cause });
  }
  if (!isRecord(value) || value.manifestVersion !== "1"
    || typeof value.id !== "string" || !value.id.trim() || value.id.length > 100
    || typeof value.version !== "string" || !value.version.trim() || value.version.length > 50
    || typeof value.name !== "string" || !value.name.trim() || value.name.length > 100
    || typeof value.description !== "string" || value.description.length > 500
    || typeof value.instructions !== "string" || value.instructions.trim().length < 20 || value.instructions.length > 8000
    || !Array.isArray(value.requestedScopes) || !value.requestedScopes.every((scope) => typeof scope === "string")) {
    throw new Error("Agent manifest is missing valid version, identity, instructions, or requestedScopes fields.");
  }
  const requestedScopes = value.requestedScopes as string[];
  if (new Set(requestedScopes).size !== requestedScopes.length) throw new Error("Agent manifest contains duplicate requested scopes.");
  const allowedScopes = new Set(connector.scopes.map((scope) => scope.id));
  const unsupported = requestedScopes.filter((scope) => !allowedScopes.has(scope));
  if (unsupported.length) throw new Error(`Agent manifest requests unsupported Damdle scope(s): ${unsupported.join(", ")}`);
  return {
    manifestVersion: "1",
    id: value.id,
    version: value.version,
    name: value.name,
    description: value.description,
    instructions: value.instructions,
    requestedScopes,
  };
}

function extractAgentFile(args: string[]): { readonly args: string[]; readonly agentFile?: string } {
  const index = args.indexOf("--agent");
  const agentFile = process.env.DAMDLE_AGENT_FILE;
  if (index === -1) return { args, agentFile };
  const filePath = args[index + 1];
  if (!filePath || filePath.startsWith("--")) throw new Error("--agent requires a JSON manifest path.");
  return { args: [...args.slice(0, index), ...args.slice(index + 2)], agentFile: filePath };
}

function makeFileAuditSink(filePath: string): AuditSink {
  return {
    async record(event: AuditEvent) {
      const directory = dirname(filePath);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      if (process.platform !== "win32") await chmod(directory, 0o700);
      const file = await open(filePath, "a", 0o600);
      try {
        await file.chmod(0o600);
        await file.appendFile(`${JSON.stringify(event)}\n`, "utf8");
      } finally {
        await file.close();
      }
    },
  };
}

async function main(): Promise<void> {
  const { args, agentFile } = extractAgentFile(process.argv.slice(2));
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    stdout.write(usage);
    if (args.length === 0) process.exitCode = 2;
    return;
  }
  const mode = args[0];
  const chatMode = mode === "--chat" || mode === "--resume";
  const deleteMode = mode === "--delete-chat";
  const forgetCredentialsMode = mode === "--forget-credentials";
  if ((mode === "--resume" || deleteMode) && args.length !== 2) throw new Error(`${mode} requires one conversation id.`);
  if (forgetCredentialsMode && args.length !== 1) throw new Error("Use --forget-credentials without additional arguments.");
  if (mode === "--chat" && args.length !== 1) throw new Error("Use --resume <conversation-id> to open an existing chat.");
  if (forgetCredentialsMode || deleteMode || mode === "--chat" || mode === "--resume") {
    const serverUrl = process.env.DAMDLE_MCP_URL;
    if (!serverUrl) throw new Error("Set DAMDLE_MCP_URL to identify the local profile.");
    const profile = process.env.DAMDLE_AGENT_PROFILE ?? "default";
    const host = new LocalDamdleMcpHost({ serverUrl, profile, onAuthorizationUrl: () => undefined });
    if (forgetCredentialsMode) {
      await host.forgetLocalCredentials();
      stdout.write(`Forgot local OAuth credentials for profile ${profile}. Server-side access remains active until revoked in Damdle.\n`);
      return;
    }
    const store = new EncryptedConversationStore(host.connectionId, undefined, profile);
    if (deleteMode) {
      await store.delete(args[1]);
      stdout.write(`Deleted local conversation ${args[1]} and its encryption key.\n`);
      return;
    }
  }
  const conversationId = chatMode && mode === "--resume" ? args[1] : undefined;
  const userMessage = chatMode ? "" : args.join(" ").trim();
  if (!chatMode && (args.includes("--delete-chat") || args.includes("--resume") || args.includes("--chat"))) {
    throw new Error("Chat commands cannot be mixed with a one-turn task.");
  }
  const serverUrl = process.env.DAMDLE_MCP_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const modelName = process.env.OPENAI_MODEL;
  if (!serverUrl || !apiKey || !modelName) throw new Error("Set DAMDLE_MCP_URL, OPENAI_API_KEY, and OPENAI_MODEL before running the local agent.");
  if (!stdin.isTTY || !stdout.isTTY) throw new Error("The local runner requires an interactive terminal for OAuth and permission consent.");

  const callbackPort = Number(process.env.DAMDLE_OAUTH_PORT ?? "43173");
  const profile = process.env.DAMDLE_AGENT_PROFILE ?? "default";
  const host = new LocalDamdleMcpHost({
    serverUrl,
    profile,
    callbackPort,
    onAuthorizationUrl: (url) => {
      stdout.write(`\nSign in and approve Damdle Agents in your browser:\n${url}\n\n`);
    },
  });
  const connector = new DamdleMcpConnector(host);
  const selectedAgent = await loadAgentManifest(agentFile ?? DEFAULT_AGENT_FILE, connector.manifest);
  const connection = await requestLocalConnection(connector.manifest, {
    connectionId: host.connectionId,
    subjectId: `local:${profile}:${host.connectionId}`,
    requestedScopes: selectedAgent.requestedScopes,
  });
  if (connection.grantedScopes.length === 0) {
    stdout.write("No connector permissions were granted; no agent turn was run.\n");
    return;
  }

  const controller = new AbortController();
  let activePrompt: ReturnType<typeof createInterface> | undefined;
  const onInterrupt = () => {
    controller.abort(new Error("Interrupted by user."));
    activePrompt?.close();
  };
  process.once("SIGINT", onInterrupt);
  try {
    stdout.write("\nConnecting to Damdle. Complete the browser sign-in if prompted.\n");
    await host.connect({ signal: controller.signal });
    const configuredAgent = selectedAgent;
    const auditPath = process.env.DAMDLE_AGENT_AUDIT ?? join(homedir(), ".damdle-agents", "audit.jsonl");
    const model = new OpenAIResponsesProvider({ apiKey, model: modelName, endpoint: process.env.OPENAI_RESPONSES_URL });
    const audit = makeFileAuditSink(auditPath);
    const runTurn = async (message: string, history: readonly AgentMessage[] = []) => {
      const result = await runAgentTurn({
        agent: configuredAgent,
        userMessage: message,
        history,
        model,
        connectors: [{ connector, connection }],
        audit,
        signal: controller.signal,
      });
      stdout.write(`\n${result.text || "The model returned no text."}\n`);
      if (result.proposals.length) stdout.write(`\nPending proposals:\n${JSON.stringify(result.proposals, null, 2)}\n`);
      if (!result.auditComplete) stdout.write(`\nWarning: the final audit event could not be saved. Review ${auditPath}.\n`);
      return result;
    };

    if (!chatMode) {
      await runTurn(userMessage);
      stdout.write(`\nAudit log: ${auditPath}\n`);
      return;
    }

    const store = new EncryptedConversationStore(host.connectionId, undefined, profile);
    const id = conversationId ?? store.newId();
    if (mode === "--resume" && !(await store.has(id))) throw new Error(`No saved conversation exists with id ${id}.`);
    let history = await store.load(id);
    let saved = await store.has(id);
    stdout.write(`\nLocal chat ${id}. Type /exit to finish.\n`);
    stdout.write("Conversation history is encrypted with a key in your OS credential store.\n");
    activePrompt = createInterface({ input: stdin, output: stdout, terminal: true });
    activePrompt.on("SIGINT", onInterrupt);
    try {
      for await (const line of activePrompt) {
        const message = line.trim();
        if (message === "/exit") break;
        if (!message) continue;
        const result = await runTurn(message, history);
        await store.save(id, result.history);
        history = [...result.history];
        saved = true;
        stdout.write(`Saved encrypted conversation ${id}.\n`);
      }
    } finally {
      activePrompt.close();
      activePrompt = undefined;
    }
    if (saved) stdout.write(`\nTo resume: npm run agent -- --resume ${id}\n`);
    else stdout.write("\nNo messages were sent; no conversation was saved.\n");
    stdout.write(`Audit log: ${auditPath}\n`);
  } finally {
    process.off("SIGINT", onInterrupt);
    await host.disconnect().catch(() => undefined);
  }
}

void main().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : "The local agent failed.";
  console.error(`Damdle Agents: ${message}`);
  process.exitCode = 1;
});
