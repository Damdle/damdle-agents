# Security policy

Damdle Agents is an early prototype and is not ready for production deployment. Do not connect production accounts or place real credentials in sample configuration.

## Reporting a vulnerability

After the separate repository is published, use GitHub's **Private vulnerability reporting** for that repository. The maintainer must enable it before announcing the project. Do not report vulnerabilities in public issues or discussions.

Until private reporting is enabled, this scaffold has no verified security contact. Do not publish vulnerability details; contact the project owner through a verified private channel and include only the minimum information needed to arrange a secure report.

## Security boundaries

- Treat connector implementations as trusted code; current interfaces do not sandbox plugins.
- Resolve scopes and connection handles from trusted host storage, never from model output or caller-supplied metadata.
- Keep provider credentials in the host's credential store and out of prompts, tool inputs, and audit summaries.
- Validate tool input at the connector boundary and enforce authorization again at the connected service.
- Write-risk tools must propose changes; service-specific approval and execution must be implemented before those actions are production-ready.
