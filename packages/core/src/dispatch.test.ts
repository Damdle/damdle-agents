import assert from "node:assert/strict";
import { test } from "node:test";
import type { AgentConnector, AuditEvent, AuditSink, ToolInvocation } from "../../contracts/src/index.js";
import { DispatchError, dispatchTool } from "./dispatch.js";

const inputSchema = {
  type: "object",
  properties: { query: { type: "string", maxLength: 80 } },
  required: ["query"],
  additionalProperties: false,
} as const;
const outputSchema = {
  type: "object",
  properties: { count: { type: "integer", minimum: 0 } },
  required: ["count"],
  additionalProperties: false,
} as const;

function fixture(risk: "read" | "write", invoke: AgentConnector["invoke"], withOutputSchema = false) {
  const events: AuditEvent[] = [];
  const audit: AuditSink = { record: async (event) => { events.push(event); } };
  const connector: AgentConnector = {
    manifest: {
      id: "test.connector",
      version: "1.0.0",
      name: "Test connector",
      description: "Connector used by dispatcher tests",
      scopes: [{ id: "test:read", title: "Read", description: "Read test data", risk: "read" }],
      tools: [{
        id: "items.lookup",
        title: "Look up items",
        description: "Test tool",
        inputSchema,
        ...(withOutputSchema ? { outputSchema } : {}),
        requiredScopes: ["test:read"],
        risk,
      }],
    },
    invoke,
  };
  const invocation: ToolInvocation = {
    id: "call-1",
    toolId: "items.lookup",
    input: { query: "founder" },
    connection: { id: "connection-1", subjectId: "founder-1", grantedScopes: ["test:read"] },
  };
  return { audit, connector, events, invocation };
}

test("dispatcher accepts completed output matching its declared output schema", async () => {
  const fixtureState = fixture("read", async () => ({ status: "completed", output: { count: 3 } }), true);
  const receipt = await dispatchTool({ agentId: "test.agent", ...fixtureState });
  assert.deepEqual(receipt.outcome, { status: "completed", output: { count: 3 } });
  assert.deepEqual(fixtureState.events.map((event) => event.outcome), ["started", "completed"]);
});

test("dispatcher rejects completed output that violates its declared output schema", async () => {
  const fixtureState = fixture("read", async () => ({ status: "completed", output: { count: "many" } }), true);
  await assert.rejects(
    dispatchTool({ agentId: "test.agent", ...fixtureState }),
    (error: unknown) => error instanceof DispatchError && error.code === "invalid_output",
  );
  assert.deepEqual(fixtureState.events.map((event) => event.outcome), ["started", "failed"]);
});

test("dispatcher rejects a write proposal that names another tool", async () => {
  const fixtureState = fixture("write", async () => ({
    status: "proposed",
    proposal: { id: "proposal-1", toolId: "other.tool", summary: "Save item", input: { query: "founder" } },
  }));
  await assert.rejects(
    dispatchTool({ agentId: "test.agent", ...fixtureState }),
    (error: unknown) => error instanceof DispatchError && error.code === "invalid_outcome",
  );
  assert.deepEqual(fixtureState.events.map((event) => event.outcome), ["started", "failed"]);
});

test("dispatcher accepts write proposals matching the tool and input schema", async () => {
  const fixtureState = fixture("write", async (_call, signal) => {
    assert.equal(signal, undefined);
    return { status: "proposed", proposal: { id: "proposal-1", toolId: "items.lookup", summary: "Save item", input: { query: "founder" } } };
  });
  const receipt = await dispatchTool({ agentId: "test.agent", ...fixtureState });
  assert.equal(receipt.outcome.status, "proposed");
  assert.deepEqual(fixtureState.events.map((event) => event.outcome), ["started", "proposed"]);
});
