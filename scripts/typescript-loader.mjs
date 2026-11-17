import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/** Resolve source imports written for TypeScript's emitted .js files when running TS directly. */
export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && specifier.endsWith(".js") && context.parentURL) {
    const jsUrl = new URL(specifier, context.parentURL);
    const tsUrl = new URL(jsUrl.href.slice(0, -3) + ".ts");
    try {
      await access(fileURLToPath(tsUrl));
      return nextResolve(tsUrl.href, context);
    } catch {
      // Keep ordinary JavaScript imports on their normal path.
    }
  }
  return nextResolve(specifier, context);
}
