// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Damdle
import { runAgentTurn } from "../../../core/src/agent-runtime.js";
import type { AgentManifest, AuditEvent, AuditSink, ConnectorConnection, ModelProvider, ModelRequest, ModelResponse } from "../../../contracts/src/index.js";
import { LocalExampleConnector } from "./connector.js";

const events: AuditEvent[] = [];
const audit: AuditSink = { async record(event) { events.push(event); } };
const connector = new LocalExampleConnector();
const connection: ConnectorConnection = {
  id: "local-founder-connection",
  subjectId: "local-founder",
  grantedScopes: connector.manifest.scopes.map((scope) => scope.id),
};

const agent: AgentManifest = {
  manifestVersion: "1",
  id: "example.builder",
  version: "0.1.0",
  name: "Local Builder",
  description: "A scripted local agent that demonstrates the portable runtime.",
  instructions: "Help a founder make practical progress. Be concise and honest.",
  requestedScopes: connector.manifest.scopes.map((scope) => scope.id),
};

/** A deterministic stand-in so the demo exercises the agent loop without an API key or network call. */
const model: ModelProvider = {
  async generate(request: ModelRequest): Promise<ModelResponse> {
    if (!request.messages.some((message) => message.role === "assistant")) {
      return {
        toolCalls: [
          { id: "call-search", connectorId: connector.manifest.id, toolId: "resources.search", input: { query: "customer" } },
          { id: "call-draft", connectorId: connector.manifest.id, toolId: "build_update.draft", input: { progress: "interviewed five potential customers" } },
          { id: "call-save", connectorId: connector.manifest.id, toolId: "resources.save", input: { resourceId: "customer-interviews" } },
        ],
      };
    }
    return {
      text: "I found the customer interview guide and drafted your update. I also proposed saving the guide; review that proposal before anything changes.",
      usage: { inputTokens: 420, outputTokens: 42 },
    };
  },
};

async function runDemo() {
  const result = await runAgentTurn({
    agent,
    userMessage: "Help me follow up after customer interviews and save a useful resource.",
    model,
    connectors: [{ connector, connection }],
    audit,
  });
  console.log(JSON.stringify({
    text: result.text,
    proposals: result.proposals,
    steps: result.steps,
    toolCalls: result.toolCalls,
    usage: result.usage,
    auditComplete: result.auditComplete,
  }, null, 2));
  console.log(`Recorded ${events.length} audit events.`);
}

void runDemo().catch((error: unknown) => {
  console.error("Local example failed:", error);
});
