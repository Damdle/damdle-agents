import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const forbiddenPath = /(^|\/)(\.env(?:\..*)?|node_modules|dist)(\/|$)|\.enc$/i;
const secretPatterns = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(?:OPENAI|ANTHROPIC|GOOGLE|AWS|SUPABASE)[A-Z0-9_]*(?:KEY|TOKEN|SECRET)\s*[:=]\s*['"]?[A-Za-z0-9_\-/.]{20,}/i,
  /(?:api[_-]?key|access[_-]?token|service[_-]?role[_-]?key)\s*[:=]\s*(?!process\.env\b)['"]?[A-Za-z0-9_\-/.]{20,}/i,
  /\bsk-[A-Za-z0-9]{20,}\b/,
];
const findings = [];

for (const file of tracked) {
  if (forbiddenPath.test(file)) findings.push(`${file}: forbidden tracked path`);
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) {
      findings.push(`${file}: matched ${pattern}`);
      break;
    }
  }
}

if (findings.length) {
  console.error("Publication scan failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Publication scan passed for ${tracked.length} tracked files. This is a narrow pattern scan, not a security or rights review.`);
}
