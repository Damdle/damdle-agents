# Local example connector

The example connector demonstrates a read tool, a draft tool, and a write-risk tool that returns a proposal. The scripted model drives a complete agent turn through the core runtime, and the demo records audit events in memory. A first Damdle ecosystem adapter is in `packages/connectors/damdle-mcp` and accepts an already-authorized MCP client from its host.

From the `damdle-agents` folder, run `npm run demo`. It needs Node.js 22.6 or newer and does not need an install step; it does not call Damdle, Supabase, an AI provider, or the network. `npm run build` uses the TypeScript dev dependency to compile the workspace.
