# Contributing to Damdle Agents

Thanks for your interest. Damdle Agents is currently in a private pre-release repository. Public pull requests will be accepted after the first public release and maintainer support process are announced.

## Before contributing

- Read the project README, architecture, roadmap, and security notes.
- Read the [integration strategy](docs/integration-strategy.md) before proposing a connector, scope, or cross-service workflow.
- Open an issue first for a new connector, permission scope, or change to the public contracts.
- Keep connectors least-privileged and declare every scope and risk level. Never put credentials in manifests, tool inputs, logs, or examples.
- Write or update documentation for behavior changes. Include focused tests when the public repository is opened and a test harness is in place.
- Do not submit real user data, production credentials, or copyrighted assets without permission.

## Pull requests

Keep changes focused. Explain the user need, security implications, setup requirements, and how you checked the change. CI currently builds the TypeScript workspace and runs the local sample demo.

## DCO sign-off

Damdle Agents uses the [Developer Certificate of Origin](https://developercertificate.org/) (DCO). Every commit you submit must carry a `Signed-off-by` trailer with your real name and email:

```
git commit --signoff
```

By signing off you certify that the contribution is your own work (or work you have the right to submit) under the Apache License 2.0. Anonymous commits will not be merged.
