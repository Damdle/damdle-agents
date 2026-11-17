import { AsyncEntry } from "@napi-rs/keyring";
import type {
  OAuthClientInformationContext,
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthDiscoveryState,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
} from "@modelcontextprotocol/client";

interface StoredCredentials {
  readonly clientIssuer?: string;
  readonly tokenIssuer?: string;
  readonly client?: StoredOAuthClientInformation;
  readonly tokens?: StoredOAuthTokens;
  readonly verifier?: string;
  readonly discovery?: OAuthDiscoveryState;
  readonly state?: string;
}

/** Keeps MCP OAuth material in the operating system credential store. */
export class KeyringOAuthProvider implements OAuthClientProvider {
  readonly redirectUrl: string;
  readonly clientMetadata: OAuthClientMetadata;
  private readonly entry: AsyncEntry;
  private readonly serverUrl: URL;
  private readonly onAuthorizationUrl: (url: URL) => void | Promise<void>;
  private credentials: StoredCredentials;

  private constructor(options: {
    entry: AsyncEntry;
    serverUrl: URL;
    redirectUrl: string;
    onAuthorizationUrl: (url: URL) => void | Promise<void>;
    credentials: StoredCredentials;
  }) {
    this.entry = options.entry;
    this.serverUrl = options.serverUrl;
    this.redirectUrl = options.redirectUrl;
    this.onAuthorizationUrl = options.onAuthorizationUrl;
    this.credentials = options.credentials;
    this.clientMetadata = {
      client_name: "Damdle Agents Local",
      redirect_uris: [this.redirectUrl],
      application_type: "native",
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    };
  }

  static async create(options: {
    connectionId: string;
    profile: string;
    serverUrl: URL;
    redirectUrl: string;
    onAuthorizationUrl: (url: URL) => void | Promise<void>;
  }): Promise<KeyringOAuthProvider> {
    const entry = new AsyncEntry("damdle-agents", `mcp-oauth-${options.connectionId}-${options.profile}`);
    const serialized = await entry.getPassword();
    let credentials: StoredCredentials = {};
    if (serialized) {
      try {
        credentials = JSON.parse(serialized) as StoredCredentials;
      } catch (cause) {
        throw new Error("Damdle OAuth credentials in the OS keyring are unreadable; remove the Damdle Agents keyring entry and reconnect.", { cause });
      }
    }
    return new KeyringOAuthProvider({ ...options, entry, credentials });
  }

  clientInformation(ctx?: OAuthClientInformationContext): StoredOAuthClientInformation | undefined {
    if (!ctx?.issuer || this.credentials.clientIssuer !== ctx.issuer || this.credentials.client?.issuer !== ctx.issuer) return undefined;
    return this.credentials.client;
  }

  async saveClientInformation(client: StoredOAuthClientInformation, ctx?: OAuthClientInformationContext): Promise<void> {
    if (!ctx?.issuer || (client.issuer && client.issuer !== ctx.issuer)) {
      throw new Error("Refusing to store MCP client registration without its matching authorization-server issuer.");
    }
    this.credentials = { ...this.credentials, clientIssuer: ctx.issuer, client };
    await this.persist();
  }

  tokens(ctx?: OAuthClientInformationContext): StoredOAuthTokens | undefined {
    if (ctx?.issuer && (this.credentials.tokenIssuer !== ctx.issuer || this.credentials.tokens?.issuer !== ctx.issuer)) return undefined;
    return this.credentials.tokens;
  }

  async saveTokens(tokens: StoredOAuthTokens, ctx?: OAuthClientInformationContext): Promise<void> {
    if (!ctx?.issuer || (tokens.issuer && tokens.issuer !== ctx.issuer)) {
      throw new Error("Refusing to store MCP tokens without their matching authorization-server issuer.");
    }
    this.credentials = { ...this.credentials, tokenIssuer: ctx.issuer, tokens };
    await this.persist();
  }

  async state(): Promise<string> {
    const state = crypto.randomUUID();
    this.credentials = { ...this.credentials, state };
    await this.persist();
    return state;
  }

  async saveCodeVerifier(verifier: string): Promise<void> {
    this.credentials = { ...this.credentials, verifier };
    await this.persist();
  }

  codeVerifier(): string {
    if (!this.credentials.verifier) throw new Error("OAuth PKCE verifier is missing. Restart the Damdle connection flow.");
    return this.credentials.verifier;
  }

  async saveDiscoveryState(discovery: OAuthDiscoveryState): Promise<void> {
    this.credentials = { ...this.credentials, discovery };
    await this.persist();
  }

  discoveryState(): OAuthDiscoveryState | undefined {
    return this.credentials.discovery;
  }

  async redirectToAuthorization(url: URL): Promise<void> {
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
      throw new Error("Damdle authorization must use HTTPS except for a loopback development server.");
    }
    await this.onAuthorizationUrl(url);
  }

  validateResourceURL(serverUrl: string | URL, resource?: string): Promise<URL | undefined> {
    const expected = new URL(serverUrl);
    if (expected.href !== this.serverUrl.href) throw new Error("MCP transport URL does not match the configured Damdle server.");
    if (resource && new URL(resource).href !== this.serverUrl.href) {
      throw new Error("Damdle OAuth metadata named a different protected resource.");
    }
    return Promise.resolve(this.serverUrl);
  }

  async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery"): Promise<void> {
    const next: StoredCredentials = scope === "all" ? {} : {
      ...this.credentials,
      ...(scope === "client" ? { client: undefined, clientIssuer: undefined } : {}),
      ...(scope === "tokens" ? { tokens: undefined, tokenIssuer: undefined } : {}),
      ...(scope === "verifier" ? { verifier: undefined, state: undefined } : {}),
      ...(scope === "discovery" ? { discovery: undefined } : {}),
    };
    this.credentials = next;
    await this.persist();
  }

  async clear(): Promise<void> {
    this.credentials = {};
    await this.entry.deletePassword();
  }

  async verifyState(candidate: string | null): Promise<boolean> {
    const valid = Boolean(candidate && this.credentials.state && candidate === this.credentials.state);
    if (valid) {
      this.credentials = { ...this.credentials, state: undefined };
      await this.persist();
    }
    return valid;
  }

  private async persist(): Promise<void> {
    await this.entry.setPassword(JSON.stringify(this.credentials));
  }
}
