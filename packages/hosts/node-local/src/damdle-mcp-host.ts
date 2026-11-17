import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { Client, StreamableHTTPClientTransport, UnauthorizedError } from "@modelcontextprotocol/client";
import type { JsonValue } from "../../../contracts/src/index.js";
import type {
  DamdleMcpClient,
  DamdleMcpClientProvider,
  McpToolResult,
} from "../../../connectors/damdle-mcp/src/index.js";
import { KeyringOAuthProvider } from "./oauth-provider.js";

const CALLBACK_HOST = "127.0.0.1";
const CALLBACK_PATH = "/oauth/callback";
const DEFAULT_CALLBACK_PORT = 43173;

function listenLoopback(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(port, CALLBACK_HOST, () => {
      server.off("error", onError);
      resolve();
    });
  });
}

function waitForCallback(server: Server, provider: KeyringOAuthProvider, timeoutMs: number, signal?: AbortSignal): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      server.off("request", onRequest);
      signal?.removeEventListener("abort", onAbort);
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onAbort = () => finish(() => reject(signal?.reason ?? new Error("Damdle connection cancelled.")));
    const timer = setTimeout(() => finish(() => reject(new Error("Timed out waiting for the Damdle OAuth callback."))), timeoutMs);
    const onRequest = async (request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse) => {
      const host = request.headers.host;
      const callback = new URL(request.url ?? "/", `http://${host || CALLBACK_HOST}`);
      if (request.method !== "GET" || callback.pathname !== CALLBACK_PATH) {
        response.writeHead(404).end("Not found");
        return;
      }
      const stateOk = await provider.verifyState(callback.searchParams.get("state")).catch(() => false);
      if (!stateOk) {
        response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("Authorization could not be verified. Return to Damdle Agents and try again.");
        return;
      }
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" })
        .end("<!doctype html><title>Damdle connected</title><p>Damdle is connected. Return to the Damdle Agents terminal.</p>");
      finish(() => resolve(callback.searchParams));
    };
    server.on("request", onRequest);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Local interactive host for one founder-authorized Damdle MCP connection. */
export class LocalDamdleMcpHost implements DamdleMcpClientProvider {
  readonly connectionId: string;
  readonly serverUrl: URL;
  readonly profile: string;
  private readonly callbackPort: number;
  private readonly onAuthorizationUrl: (url: URL) => void;
  private client?: Client;
  private provider?: KeyringOAuthProvider;

  constructor(options: {
    serverUrl: string | URL;
    profile?: string;
    callbackPort?: number;
    onAuthorizationUrl: (url: URL) => void;
  }) {
    this.serverUrl = new URL(options.serverUrl);
    if (this.serverUrl.username || this.serverUrl.password || this.serverUrl.search || this.serverUrl.hash) {
      throw new Error("Damdle MCP URL must not include credentials, query parameters, or a fragment.");
    }
    if (this.serverUrl.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(this.serverUrl.hostname)) {
      throw new Error("Damdle MCP must use HTTPS except for a loopback development server.");
    }
    this.connectionId = createHash("sha256").update(this.serverUrl.href).digest("hex").slice(0, 32);
    this.profile = options.profile ?? "default";
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(this.profile)) throw new Error("Local profile must contain 1 to 64 letters, digits, underscores, or hyphens.");
    this.callbackPort = options.callbackPort ?? DEFAULT_CALLBACK_PORT;
    if (!Number.isInteger(this.callbackPort) || this.callbackPort < 1 || this.callbackPort > 65535) {
      throw new Error("OAuth callback port must be an integer between 1 and 65535.");
    }
    this.onAuthorizationUrl = options.onAuthorizationUrl;
  }

  async connect(options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<void> {
    if (this.client) return;
    if (options.signal?.aborted) throw options.signal.reason ?? new Error("Connection cancelled.");
    const callbackUrl = LocalDamdleMcpHost.callbackAddress(this.callbackPort);
    let callbackServer: Server | undefined;
    let callbackListen: Promise<void> | undefined;
    const provider = await KeyringOAuthProvider.create({
      connectionId: this.connectionId,
      profile: this.profile,
      serverUrl: this.serverUrl,
      redirectUrl: callbackUrl,
      onAuthorizationUrl: async (url) => {
        callbackServer ??= createServer();
        callbackListen ??= listenLoopback(callbackServer, this.callbackPort);
        await callbackListen;
        await this.onAuthorizationUrl(url);
      },
    });
    this.provider = provider;
    const client = new Client({ name: "damdle-agents-local", version: "0.1.0" });
    const transport = new StreamableHTTPClientTransport(this.serverUrl, { authProvider: provider });
    try {
      try {
        await client.connect(transport, { signal: options.signal });
      } catch (cause) {
        if (!(cause instanceof UnauthorizedError)) throw cause;
        if (!callbackServer?.listening) throw new Error("OAuth requested authorization before the loopback callback server was ready.");
        const timeoutMs = options.timeoutMs ?? 5 * 60_000;
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("OAuth callback timeout must be a positive number of milliseconds.");
        const params = await waitForCallback(callbackServer, provider, timeoutMs, options.signal);
        await transport.finishAuth(params);
        await provider.invalidateCredentials("verifier");
        await client.connect(new StreamableHTTPClientTransport(this.serverUrl, { authProvider: provider }), { signal: options.signal });
      }
      this.client = client;
      this.provider = provider;
    } catch (cause) {
      await client.close().catch(() => undefined);
      throw cause;
    } finally {
      if (callbackServer?.listening) await new Promise<void>((resolve) => callbackServer!.close(() => resolve()));
    }
  }

  async forConnection(connectionId: string): Promise<DamdleMcpClient | null> {
    if (connectionId !== this.connectionId || !this.client) return null;
    const client = this.client;
    return {
      callTool: async (name: string, args: { readonly [key: string]: JsonValue }, options?: { readonly signal?: AbortSignal }): Promise<McpToolResult> =>
        client.callTool({ name, arguments: args }, { signal: options?.signal }),
    };
  }

  async disconnect(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    await client?.close();
  }

  async forgetLocalCredentials(): Promise<void> {
    await this.disconnect();
    const provider = this.provider ?? await KeyringOAuthProvider.create({
      connectionId: this.connectionId,
      profile: this.profile,
      serverUrl: this.serverUrl,
      redirectUrl: LocalDamdleMcpHost.callbackAddress(this.callbackPort),
      onAuthorizationUrl: this.onAuthorizationUrl,
    });
    await provider.clear();
    this.provider = undefined;
  }

  static callbackAddress(port = DEFAULT_CALLBACK_PORT): string {
    return `http://${CALLBACK_HOST}:${port}${CALLBACK_PATH}`;
  }
}
