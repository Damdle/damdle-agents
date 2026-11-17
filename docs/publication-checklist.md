# Publication checklist

This repository is an internal release candidate. Complete every owner gate before creating a public remote or inviting outside contributors.

## Workspace checks

- [ ] Review every tracked file and confirm that no secrets, user data, private URLs, production audit data, or branded assets are present.
- [ ] Review direct and transitive dependency licenses and security advisories.
- [ ] Run `npm ci`, `npm run build`, `npm run agent -- --help`, and `npm run demo` from a clean checkout.
- [ ] Review the OAuth and Damdle connector behavior with an authorized test account, including sign-in, refresh, scope denial, proposal creation, expiry, and revocation.
- [ ] Confirm the local host's encrypted conversation storage and key deletion behavior on each supported operating system.
- [ ] Decide which interfaces are experimental and publish a compatibility/versioning policy.

## Owner decisions

- [ ] Select the software license and copyright holder; add the actual license file.
- [ ] Select a documentation and example-content license where needed.
- [ ] Confirm that all contributors and copied materials have the rights needed for publication. Existing app code and assets remain excluded until cleared.
- [ ] Publish a Damdle trademark and branding policy separate from the software license.
- [ ] Choose DCO or CLA terms before accepting outside contributions.
- [ ] Provide a monitored private security contact and enable GitHub private vulnerability reporting.
- [ ] Provide a public support channel and maintainer ownership for releases.

## Repository setup

1. Create the intended public repository under the Damdle organization or owner account.
2. Add the repository description, topics, default branch protections, and security settings.
3. Configure secret scanning, dependency update policy, and private vulnerability reporting.
4. Add the selected license, trademark policy, security contact, and support links.
5. Push the reviewed `main` history and inspect the first public commit and rendered README.
6. Publish a clearly marked pre-release before calling the project stable.

## First public release

The first release should describe the current product accurately: a portable agent runtime, a local Node host, a Damdle MCP connector, custom JSON agent manifests, encrypted local chat history, and a credential-free demo. It should not claim that the full Damdle ecosystem, a multi-tenant server, or arbitrary connector sandboxing can already be self-hosted.

After release, keep a short changelog, record breaking contract changes, and update the roadmap when a connector or host moves from experimental to supported.
