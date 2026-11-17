# Local agent definitions

`founder-guide.json` is the starter agent definition for the local runner. Copy it to make an agent for a particular founder task, then set its `name`, `description`, `instructions`, and `requestedScopes`.

Run a custom definition with:

```powershell
npm run agent -- --agent .\agents\my-agent.json "Help me with this task"
npm run agent -- --agent .\agents\my-agent.json --chat
```

You can also set `DAMDLE_AGENT_FILE` to use the same definition by default. A manifest is JSON data; the runner does not execute code from the file. It accepts manifest version `1` and rejects any requested scope that the Damdle connector does not provide.

Keep `requestedScopes` narrow. The local host asks the founder to approve each requested permission at run time, with each permission denied by default. The model only sees tools that are both declared by the agent and locally approved. Damdle independently enforces its own account permissions, and write tools remain approval-gated in Damdle.

Instructions are still untrusted configuration. The host adds its safety rules after the agent's instructions, validates tool arguments, enforces scopes, and treats tool results as untrusted. A manifest does not sandbox tools or third-party connector code.
