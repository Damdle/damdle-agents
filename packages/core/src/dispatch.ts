import {
  hasRequiredScopes,
  isConnectionActive,
  isValidOutcomeForRisk,
  type AgentConnector,
  type AuditEvent,
  type AuditSink,
  type ToolOutcome,
  type ToolInvocation,
} from "../../contracts/src/index.js";
import { Ajv, type ErrorObject } from "ajv";

export type DispatchFailureCode =
  | "unknown_tool"
  | "scope_denied"
  | "invalid_input"
  | "invalid_output"
  | "audit_unavailable"
  | "connector_failed"
  | "invalid_outcome";

export class DispatchError extends Error {
  readonly code: DispatchFailureCode;

  constructor(
    code: DispatchFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DispatchError";
    this.code = code;
  }
}

export interface DispatchRequest {
  readonly agentId: string;
  readonly connector: AgentConnector;
  readonly invocation: ToolInvocation;
  readonly audit: AuditSink;
  readonly signal?: AbortSignal;
}

export interface DispatchReceipt {
  readonly outcome: ToolOutcome;
  /** False means the start event was recorded but the final outcome event could not be stored. */
  readonly auditComplete: boolean;
}

export interface DispatchOptions {
  readonly now?: () => Date;
  readonly createId?: () => string;
}

const defaultId = () => globalThis.crypto.randomUUID();
const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addFormat("uuid", /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

/**
 * Dispatches one connector tool call. The host checks grants before dispatch; the connector must
 * check them again at its service boundary. A started audit event must persist before the tool runs.
 */
export async function dispatchTool(
  request: DispatchRequest,
  options: DispatchOptions = {},
): Promise<DispatchReceipt> {
  const { connector, invocation, audit } = request;
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? defaultId;
  const tool = connector.manifest.tools.find((item) => item.id === invocation.toolId);

  const makeEvent = (
    outcome: AuditEvent["outcome"],
    risk: AuditEvent["risk"],
    summary?: string,
  ): AuditEvent => ({
    id: createId(),
    occurredAt: now().toISOString(),
    actorId: invocation.connection.subjectId,
    agentId: request.agentId,
    connectorId: connector.manifest.id,
    toolId: invocation.toolId,
    risk,
    outcome,
    ...(summary ? { summary } : {}),
  });

  if (!tool) {
    await audit.record(makeEvent("denied", "read", "Tool is not registered by this connector.")).catch((cause: unknown) => {
      throw new DispatchError("audit_unavailable", "The tool call was refused because its audit event could not be recorded.", { cause });
    });
    throw new DispatchError("unknown_tool", `Connector does not provide tool: ${invocation.toolId}`);
  }

  if (!hasRequiredScopes(tool.requiredScopes, invocation.connection.grantedScopes)) {
    await audit.record(makeEvent("denied", tool.risk, "Required permission was not granted.")).catch((cause: unknown) => {
      throw new DispatchError("audit_unavailable", "The tool call was refused because its audit event could not be recorded.", { cause });
    });
    throw new DispatchError("scope_denied", `Missing permission for tool: ${tool.id}`);
  }

  if (!isConnectionActive(invocation.connection, now())) {
    await audit.record(makeEvent("denied", tool.risk, "Connector authorization has expired or is invalid.")).catch((cause: unknown) => {
      throw new DispatchError("audit_unavailable", "The tool call was refused because its audit event could not be recorded.", { cause });
    });
    throw new DispatchError("scope_denied", `Connector authorization has expired for tool: ${tool.id}`);
  }

  let validInput = false;
  try {
    validInput = ajv.validate(tool.inputSchema, invocation.input);
  } catch {
    throw new DispatchError("invalid_input", `Connector has an invalid input schema for tool: ${tool.id}`);
  }
  if (!validInput) {
    const errors = ajv.errors as ErrorObject[] | null | undefined;
    const details = errors?.slice(0, 3).map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`).join("; ");
    await audit.record(makeEvent("denied", tool.risk, "Tool input did not match the declared schema.")).catch((cause: unknown) => {
      throw new DispatchError("audit_unavailable", "The invalid tool call was refused because its audit event could not be recorded.", { cause });
    });
    throw new DispatchError("invalid_input", `Invalid input for tool ${tool.id}${details ? `: ${details}` : ""}`);
  }

  try {
    await audit.record(makeEvent("started", tool.risk));
  } catch (cause) {
    throw new DispatchError("audit_unavailable", "The tool call was refused because its start event could not be recorded.", { cause });
  }

  let outcome: ToolOutcome;
  try {
    outcome = await connector.invoke(invocation, request.signal);
  } catch (cause) {
    await audit.record(makeEvent("failed", tool.risk, "Connector invocation failed.")).catch(() => undefined);
    throw new DispatchError("connector_failed", `Connector failed while running tool: ${tool.id}`, { cause });
  }

  if (!isValidOutcomeForRisk(tool.risk, outcome)) {
    await audit.record(makeEvent("failed", tool.risk, "Connector returned an outcome inconsistent with the declared risk.")).catch(() => undefined);
    throw new DispatchError("invalid_outcome", `Connector returned an invalid outcome for ${tool.risk}-risk tool: ${tool.id}`);
  }

  if (outcome.status === "proposed") {
    let validProposalInput = false;
    try {
      validProposalInput = outcome.proposal.toolId === tool.id && ajv.validate(tool.inputSchema, outcome.proposal.input);
    } catch {
      validProposalInput = false;
    }
    if (!validProposalInput) {
      await audit.record(makeEvent("failed", tool.risk, "Connector returned a proposal for a different tool or with invalid arguments.")).catch(() => undefined);
      throw new DispatchError("invalid_outcome", `Connector returned an invalid proposal for tool: ${tool.id}`);
    }
  }

  if (outcome.status === "completed" && tool.outputSchema) {
    let validOutput = false;
    try {
      validOutput = ajv.validate(tool.outputSchema, outcome.output);
    } catch {
      validOutput = false;
    }
    if (!validOutput) {
      await audit.record(makeEvent("failed", tool.risk, "Connector output did not match the declared schema.")).catch(() => undefined);
      throw new DispatchError("invalid_output", `Connector returned an invalid output for tool: ${tool.id}`);
    }
  }

  const finalStatus = outcome.status === "proposed" ? "proposed" : "completed";
  try {
    await audit.record(makeEvent(finalStatus, tool.risk));
    return { outcome, auditComplete: true };
  } catch {
    // The start event exists, and this implementation only returns a result/proposal. Never retry
    // automatically: the host should surface the incomplete audit state to its operator.
    return { outcome, auditComplete: false };
  }
}
