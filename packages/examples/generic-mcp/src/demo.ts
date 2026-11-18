// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Damdle
import { GenericMcpConnector, type GenericMcpClient } from "../../../connectors/mcp/src/index.js";
import { dispatchTool } from "../../../core/src/dispatch.js";
import type { AuditEvent, AuditSink, JsonValue } from "../../../contracts/src/index.js";

const events: AuditEvent[] = [];
const audit: AuditSink = { record: async (event) => { events.push(event); } };
const client: GenericMcpClient = {
  async callTool(name: string, args: { readonly [key: string]: JsonValue }) {
    if (name !== "search_docs") throw new Error(`Unexpected remote tool: ${name}`);
    return { structuredContent: { query: args.query, results: ["Founder onboarding guide"] } };
  },
};

const connector = new GenericMcpConnector(client, {
  id: "example.docs.mcp",
  version: "0.1.0",
  name: "Example docs",
  description: "An in-memory MCP service used by the generic connector example.",
  scopes: [{ id: "docs:read", title: "Search docs", description: "Search the example document index.", risk: "read" }],
  tools: [{
    id: "docs.search",
    remoteName: "search_docs",
    title: "Search docs",
    description: "Search the example document index.",
    inputSchema: { type: "object", properties: { query: { type: "string", minLength: 1, maxLength: 80 } }, required: ["query"], additionalProperties: false },
    requiredScopes: ["docs:read"],
    risk: "read",
  }],
});

const receipt = await dispatchTool({
  agentId: "example-agent",
  connector,
  invocation: {
    id: "example-call",
    toolId: "docs.search",
    input: { query: "onboarding" },
    connection: { id: "example-connection", subjectId: "example-founder", grantedScopes: ["docs:read"] },
  },
  audit,
});

console.log(JSON.stringify({ output: receipt.outcome, auditEvents: events.length }, null, 2));
