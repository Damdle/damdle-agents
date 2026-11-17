# Damdle Agents extraction audit

**Status: internal working inventory.** This is a boundary guide, not a rights opinion or a release approval. The new `damdle-agents` repository currently contains a separately drafted prototype and does not copy the Damdle application runtime, schema, or brand assets.

## Reuse through the public service boundary

The existing application exposes `POST /api/mcp` as an OAuth-protected Streamable HTTP MCP server. It is the intended first-party integration surface. The external client acts with the founder's Supabase Auth identity; the server applies its own account permissions. The open-source agent host should call this service and must not import application server code or use the Supabase service-role key.

The current MCP tools include agent catalog discovery and requests, hosted-agent delegation, founder capabilities, drafts, and proposal-based writes. The adapter in `packages/connectors/damdle-mcp` maps those workflows into the portable contracts. It is a new adapter, not a copied application module, and still needs live-account compatibility validation.

## Application files: reference only, do not copy as-is

| Application path | Current coupling or concern | Open-source handling |
| --- | --- | --- |
| `src/lib/agents/runtime.ts` | AI SDK `ToolLoopAgent`, `server-only`, Supabase usage and Vercel AI Gateway | Replace with portable runtime/provider contracts; do not copy directly |
| `src/lib/agents/tools.ts` | AI SDK and Zod plus internal opportunities, discovery, builds, toolbox, builder data APIs | Reimplement through public MCP or independent connectors; do not copy internal service logic |
| `src/lib/agents/data.ts`, `external.ts`, `budget.ts`, `notify.ts` | Supabase clients, server-only code, private tables, rate limits, email and usage accounting | Keep with the Damdle service; do not extract |
| `src/lib/agents/tokens.ts` | Platform-issued `dat_` software-agent tokens and their validation lifecycle | Keep platform token issuance and verification in Damdle; external founders use user-authorized OAuth |
| `src/lib/agents/scopes.ts`, `types.ts`, `specs.ts`, `untrusted.ts` | Useful policy and product behavior, but tied to Damdle's agent catalog and current implementation | Treat as behavior references; port only after a rights review and a clean portable API design |
| `src/app/api/mcp/route.ts` | Next.js route, `mcp-handler`, Supabase admin credentials, module flags, platform rate limits and agent tokens | Keep server-side; the public client connects over HTTP |
| `supabase/migrations/*agents.sql` | Private application schema, RLS policies, triggers, functions and grants | Keep private; no database dump or privileged schema in the open-source repository |
| `src/app/agents/**`, `src/app/oauth/**`, `src/components/agents/**` | Damdle web application, consent UI, account pages and product-specific workflows | Keep in the ecosystem app; reproduce only generic local host UX where needed |
| `docs/agents.md` | Product and operational notes, including private implementation details and unreleased plans | Reference only; write public setup documentation from verified behavior |

## Dependencies and secret boundaries

The application agent stack currently depends on `ai`, `@supabase/supabase-js`, `mcp-handler`, `zod`, `marked`, and `next/server`, in addition to internal Damdle modules. The new project intentionally has no Next.js or Supabase SDK dependency. Its direct dependencies are listed and locked in `package.json` and `package-lock.json`; transitive license and vulnerability review is still required before a public release.

Never copy `.env`, `.env.local`, deployment variables, access tokens, service-role credentials, database URLs, OAuth client secrets, user records, or audit data into this repository. The local MCP host stores OAuth client credentials and tokens in the operating-system keyring. The CLI audit JSONL contains event metadata and is stored outside the repository by default.

## Brand, content, and provenance

No files from `brand/` or `public/brand/` are present in this repository. Do not add Damdle logos, mascot artwork, product screenshots, sample founder data, or other branded assets under the software license without a separate rights and trademark decision.

Git history for the existing agent implementation includes commits attributed to `Claude <noreply@anthropic.com>`. Git author metadata alone does not establish copyright ownership or contribution rights. Before copying or relicensing any existing application code or documentation, confirm the rights and contribution terms for every relevant author with the project owner and obtain qualified legal review as appropriate.

## Public extraction gate

- [ ] Confirm code and documentation ownership for any files selected for reuse.
- [ ] Review direct and transitive dependency licenses and security advisories.
- [ ] Confirm the repository contains no secrets, private data, privileged SQL, or unapproved brand assets.
- [ ] Select software and documentation licenses and publish a separate trademark policy.
- [ ] Review the Damdle MCP host against a test account and document required Supabase OAuth settings.
- [ ] Publish a verified private security contact and enable private vulnerability reporting.
- [ ] Create the intended remote repository and review the exact initial commit before making it public.
