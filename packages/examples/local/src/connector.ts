// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Damdle
import {
  hasRequiredScopes,
  type AgentConnector,
  type ConnectorManifest,
  type JsonValue,
  type ToolInvocation,
  type ToolOutcome,
} from "../../../contracts/src/index.js";

const READ_SCOPE = "sample:resources:read";
const DRAFT_SCOPE = "sample:update:draft";
const WRITE_SCOPE = "sample:resources:save";

const manifest: ConnectorManifest = {
  id: "damdle.example.local",
  version: "0.1.0",
  name: "Local Founder Toolkit",
  description: "A small example connector with read, draft, and proposal-only write tools.",
  scopes: [
    { id: READ_SCOPE, title: "Search sample resources", description: "Read the local example resource list.", risk: "read" },
    { id: DRAFT_SCOPE, title: "Draft a build update", description: "Prepare text for the founder to review.", risk: "draft" },
    { id: WRITE_SCOPE, title: "Save a sample resource", description: "Propose saving a resource; this demo does not write it automatically.", risk: "write" },
  ],
  tools: [
    {
      id: "resources.search",
      title: "Search sample resources",
      description: "Find an example tool for a startup task.",
      inputSchema: { type: "object", properties: { query: { type: "string", maxLength: 80 } }, additionalProperties: false },
      outputSchema: {
        type: "object",
        properties: {
          items: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, task: { type: "string" } }, required: ["id", "title", "task"], additionalProperties: false } },
        },
        required: ["items"],
        additionalProperties: false,
      },
      requiredScopes: [READ_SCOPE],
      risk: "read",
    },
    {
      id: "build_update.draft",
      title: "Draft a build update",
      description: "Draft a short progress update for the founder to review.",
      inputSchema: { type: "object", properties: { progress: { type: "string", minLength: 1, maxLength: 500 } }, required: ["progress"], additionalProperties: false },
      requiredScopes: [DRAFT_SCOPE],
      risk: "draft",
    },
    {
      id: "resources.save",
      title: "Propose saving a resource",
      description: "Prepare a proposal; the founder must approve it before it is saved.",
      inputSchema: { type: "object", properties: { resourceId: { type: "string", minLength: 1, maxLength: 80 } }, required: ["resourceId"], additionalProperties: false },
      requiredScopes: [WRITE_SCOPE],
      risk: "write",
    },
  ],
};

const isRecord = (value: JsonValue): value is { readonly [key: string]: JsonValue } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (input: JsonValue, key: string, maxLength: number): string => {
  if (!isRecord(input) || typeof input[key] !== "string") throw new Error(`Expected a string field: ${key}`);
  const value = input[key] as string;
  if (value.length > maxLength) throw new Error(`${key} is too long`);
  return value;
};

const resources = [
  { id: "customer-interviews", title: "Customer interview guide", task: "customer discovery" },
  { id: "prototype-checklist", title: "Prototype launch checklist", task: "product validation" },
  { id: "pricing-notes", title: "Early pricing worksheet", task: "pricing" },
] as const;

export class LocalExampleConnector implements AgentConnector {
  readonly manifest = manifest;

  async invoke(invocation: ToolInvocation, signal?: AbortSignal): Promise<ToolOutcome> {
    if (signal?.aborted) throw signal.reason ?? new Error("Invocation aborted");
    const tool = this.manifest.tools.find((candidate) => candidate.id === invocation.toolId);
    if (!tool) throw new Error(`Unknown example tool: ${invocation.toolId}`);
    if (!hasRequiredScopes(tool.requiredScopes, invocation.connection.grantedScopes)) {
      throw new Error(`Permission was not granted for ${tool.id}`);
    }

    if (tool.id === "resources.search") {
      const query = isRecord(invocation.input) && typeof invocation.input.query === "string"
        ? invocation.input.query.slice(0, 80).toLowerCase()
        : "";
      const matches = resources.filter((item) => `${item.title} ${item.task}`.toLowerCase().includes(query));
      return { status: "completed", output: { items: matches.slice(0, 5) } };
    }

    if (tool.id === "build_update.draft") {
      const progress = readString(invocation.input, "progress", 500).trim();
      if (!progress) throw new Error("progress cannot be empty");
      return { status: "completed", output: { draft: `This week, we ${progress}. Next, we will keep testing what works.` } };
    }

    if (tool.id === "resources.save") {
      const resourceId = readString(invocation.input, "resourceId", 80);
      const resource = resources.find((item) => item.id === resourceId);
      if (!resource) throw new Error("That sample resource was not found");
      const createdAt = new Date().toISOString();
      return {
        status: "proposed",
        proposal: {
          id: `${invocation.id}:proposal`,
          toolId: tool.id,
          summary: `Save ${resource.title} to the founder's collection`,
          input: { resourceId },
          createdAt,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      };
    }

    throw new Error(`No handler is implemented for ${tool.id}`);
  }
}
