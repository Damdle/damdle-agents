# Security policy

Damdle Agents is an early-stage project and is not ready for production deployment. Do not connect production accounts or place real credentials in sample configuration.

## Reporting a vulnerability

To report a vulnerability, email **security@damdle.com**. Do not publish vulnerability details in public issues or discussions. Include only the minimum information needed to arrange a secure report.

GitHub private vulnerability reporting must be enabled on the public repository before it is announced. The maintainer is responsible for enabling this in the repository's **Security settings** on GitHub. Once enabled, it is the preferred reporting channel.

## Security boundaries

- Treat connector implementations as trusted code; current interfaces do not sandbox plugins.
- Resolve scopes and connection handles from trusted host storage, never from model output or caller-supplied metadata.
- Keep provider credentials in the host's credential store and out of prompts, tool inputs, and audit summaries.
- Validate tool input at the connector boundary and enforce authorization again at the connected service.
- Write-risk tools must propose changes; service-specific approval and execution must be implemented before those actions are production-ready.
