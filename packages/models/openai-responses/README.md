# OpenAI Responses model provider

This dependency-free adapter implements the portable `ModelProvider` interface using the OpenAI Responses API. It sends the request instructions, bounded conversation, JSON Schema tools, and output-token limit; it maps function calls and usage back into the Damdle Agents contracts. The request sets `store: false`.

```ts
import { OpenAIResponsesProvider } from "./src/index.js";

const model = new OpenAIResponsesProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.DAMDLE_AGENT_MODEL!,
});
```

Set `DAMDLE_AGENT_MODEL` to a tool-capable model enabled for the API account.

Keep API keys in the host's secret store. A custom HTTPS endpoint can be supplied for a compatible gateway; plain HTTP is allowed only for loopback development endpoints. Compatibility with third-party gateways has not been validated.
