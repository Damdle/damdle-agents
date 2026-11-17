import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { AsyncEntry } from "@napi-rs/keyring";
import type { AgentMessage, JsonValue, ModelToolCall, ToolOutcome } from "../../../contracts/src/index.js";

const VERSION = 1;
const MAX_ENCRYPTED_BYTES = 8 * 1024 * 1024;
const MAX_PLAINTEXT_BYTES = 5 * 1024 * 1024;
const CHAT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface EncryptedEnvelope {
  readonly version: 1;
  readonly iv: string;
  readonly tag: string;
  readonly ciphertext: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
};

function isToolCall(value: unknown): value is ModelToolCall {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.connectorId === "string"
    && typeof value.toolId === "string"
    && isJsonValue(value.input);
}

function isOutcome(value: unknown): value is ToolOutcome {
  if (!isRecord(value)) return false;
  if (value.status === "completed") return isJsonValue(value.output);
  if (value.status !== "proposed" || !isRecord(value.proposal)) return false;
  const proposal = value.proposal;
  return typeof proposal.id === "string"
    && typeof proposal.toolId === "string"
    && typeof proposal.summary === "string"
    && isJsonValue(proposal.input);
}

function isAgentMessage(value: unknown): value is AgentMessage {
  if (!isRecord(value)) return false;
  if (value.role === "user") return typeof value.content === "string";
  if (value.role === "assistant") {
    return typeof value.content === "string"
      && (value.toolCalls === undefined || (Array.isArray(value.toolCalls) && value.toolCalls.every(isToolCall)));
  }
  if (value.role !== "tool" || value.untrusted !== true
    || typeof value.callId !== "string" || typeof value.connectorId !== "string" || typeof value.toolId !== "string") return false;
  return (isRecord(value.content) && value.content.status === "error" && typeof value.content.message === "string")
    || isOutcome(value.content);
}

function validateHistory(value: unknown): AgentMessage[] {
  if (!Array.isArray(value) || value.length > 1000 || !value.every(isAgentMessage)) {
    throw new Error("The saved conversation is invalid or unsupported.");
  }
  if (value.length > 0 && (value[value.length - 1].role !== "assistant" || (value[value.length - 1] as Extract<AgentMessage, { role: "assistant" }>).toolCalls?.length)) {
    throw new Error("The saved conversation does not end at a completed agent turn.");
  }
  return value as AgentMessage[];
}

function isMissingFile(cause: unknown): boolean {
  return isRecord(cause) && cause.code === "ENOENT";
}

/** AES-256-GCM conversation storage; each chat has its own key in the OS credential store. */
export class EncryptedConversationStore {
  private readonly connectionId: string;
  private readonly profile: string;
  private readonly directory: string;

  constructor(connectionId: string, baseDirectory = join(homedir(), ".damdle-agents", "conversations"), profile = "default") {
    if (!/^[0-9a-f]{32}$/i.test(connectionId)) throw new Error("Invalid local connection id.");
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(profile)) throw new Error("Local profile must contain 1 to 64 letters, digits, underscores, or hyphens.");
    this.connectionId = connectionId;
    this.profile = profile;
    this.directory = join(baseDirectory, connectionId, profile);
  }

  newId(): string {
    return randomUUID();
  }

  async has(conversationId: string): Promise<boolean> {
    const filePath = this.filePath(conversationId);
    try {
      await stat(filePath);
      return true;
    } catch (cause) {
      if (isMissingFile(cause)) return false;
      throw cause;
    }
  }

  async load(conversationId: string): Promise<AgentMessage[]> {
    const filePath = this.filePath(conversationId);
    let raw: Buffer;
    try {
      raw = await readFile(filePath);
    } catch (cause) {
      if (isMissingFile(cause)) return [];
      throw cause;
    }
    if (raw.byteLength > MAX_ENCRYPTED_BYTES) throw new Error("Saved conversation exceeds the local size limit.");
    let envelope: unknown;
    try {
      envelope = JSON.parse(raw.toString("utf8"));
    } catch (cause) {
      throw new Error("Saved conversation envelope is unreadable.", { cause });
    }
    if (!isRecord(envelope) || envelope.version !== VERSION || typeof envelope.iv !== "string"
      || typeof envelope.tag !== "string" || typeof envelope.ciphertext !== "string") {
      throw new Error("Saved conversation uses an unsupported encryption envelope.");
    }

    try {
      const key = await this.keyFor(conversationId, false);
      const iv = Buffer.from(envelope.iv, "base64");
      const tag = Buffer.from(envelope.tag, "base64");
      const ciphertext = Buffer.from(envelope.ciphertext, "base64");
      if (iv.length !== 12 || tag.length !== 16 || ciphertext.length > MAX_ENCRYPTED_BYTES) throw new Error("Invalid encrypted data sizes.");
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(Buffer.from(`${VERSION}:${this.connectionId}:${this.profile}:${conversationId}`));
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
      return validateHistory(JSON.parse(plaintext) as unknown);
    } catch (cause) {
      if (cause instanceof Error && cause.message === "The saved conversation is invalid or unsupported.") throw cause;
      if (cause instanceof Error && cause.message === "The saved conversation does not end at a completed agent turn.") throw cause;
      throw new Error("Could not decrypt this conversation. The local key may be missing or the file may be damaged.", { cause });
    }
  }

  async save(conversationId: string, history: readonly AgentMessage[]): Promise<void> {
    const validated = validateHistory(history);
    const plaintext = Buffer.from(JSON.stringify(validated), "utf8");
    if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) throw new Error("Conversation exceeds the local encrypted storage size limit.");
    const key = await this.keyFor(conversationId, true);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(`${VERSION}:${this.connectionId}:${this.profile}:${conversationId}`));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const envelope: EncryptedEnvelope = {
      version: VERSION,
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
    await this.writeAtomically(this.filePath(conversationId), JSON.stringify(envelope));
  }

  async delete(conversationId: string): Promise<void> {
    const filePath = this.filePath(conversationId);
    try {
      await unlink(filePath);
    } catch (cause) {
      if (!isMissingFile(cause)) throw cause;
    }
    await this.keyEntry(conversationId).deletePassword();
  }

  private filePath(conversationId: string): string {
    if (!CHAT_ID.test(conversationId)) throw new Error("Conversation id must be a UUID.");
    return join(this.directory, `${conversationId}.enc`);
  }

  private keyEntry(conversationId: string): AsyncEntry {
    return new AsyncEntry("damdle-agents", `chat-key-${this.connectionId}-${this.profile}-${conversationId}`);
  }

  private async keyFor(conversationId: string, create: boolean): Promise<Buffer> {
    const entry = this.keyEntry(conversationId);
    let encoded = await entry.getPassword();
    if (!encoded && create) {
      await entry.setPassword(randomBytes(32).toString("base64"));
      encoded = await entry.getPassword();
    }
    if (!encoded) throw new Error("Conversation encryption key is missing.");
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32) throw new Error("Conversation encryption key in the OS keyring is invalid.");
    return key;
  }

  private async writeAtomically(filePath: string, content: string): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    if (process.platform !== "win32") await chmod(this.directory, 0o700);
    const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      const file = await open(tempPath, "wx", 0o600);
      try {
        if (process.platform !== "win32") await file.chmod(0o600);
        await file.writeFile(content, "utf8");
      } finally {
        await file.close();
      }
      await rename(tempPath, filePath);
    } catch (cause) {
      await unlink(tempPath).catch(() => undefined);
      throw cause;
    }
  }
}
