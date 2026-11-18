# Dependency license summary

> **Scope:** Direct dependencies only. Transitive dependencies are not listed here.
> Before the first public release, run a full transitive license review using a tool such as
> [`license-checker`](https://github.com/davglass/license-checker) or
> [`@license-checker-rseidelsohn/license-checker`](https://github.com/RSeidelsohn/license-checker-rseidelsohn),
> and address any `npm audit` advisories.

## Direct dependencies

| Package | Installed version | License | Apache 2.0 compatibility |
|---|---|---|---|
| `@modelcontextprotocol/client` | 2.4.0 | Apache-2.0 | ✅ Same license — fully compatible |
| `@napi-rs/keyring` | 2.1.2 | MIT | ✅ MIT is permissive and compatible with Apache 2.0 |
| `ajv` | 8.20.0 | MIT | ✅ MIT is permissive and compatible with Apache 2.0 |
| `@types/node` *(dev)* | 26.6.6 | MIT | ✅ Dev-only type stubs; MIT, not shipped in production output |
| `typescript` *(dev)* | 6.0.3 | Apache-2.0 | ✅ Dev-only compiler; same license, not shipped in production output |

## Notes

- MIT and Apache-2.0 are both OSI-approved permissive licenses. MIT is compatible with Apache 2.0 when Apache 2.0 governs the combined work.
- Dev-only packages (`@types/node`, `typescript`) are build tools and type stubs. They are not bundled into distributed artifacts, so their licenses impose no additional obligations on consumers of this package.
- No copyleft (GPL/LGPL/AGPL) dependencies were found in the direct dependency list.
- **Action required before release:** Run a full transitive review. Some transitive packages may carry different licenses (e.g. ISC, BSD, CC0). Confirm none are copyleft or unknown.
