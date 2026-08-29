#!/usr/bin/env bun
// anytxt-opencode install — copies the plugin source, OpenCode shim, skill
// and command into the OpenCode config dir (~/.config/opencode by default;
// override with OPENCODE_CONFIG_DIR or a positional path). Idempotent, safe
// to re-run. Never touches an existing .env.
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.argv[2] ?? process.env.OPENCODE_CONFIG_DIR ?? join(homedir(), ".config", "opencode");
const src = fileURLToPath(new URL("../", import.meta.url)); // package root

const jobs = [
  ["src", "src"],
  ["skills/anytxt", "skills/anytxt"],
  ["command/anytxt-param.md", "command/anytxt-param.md"],
];

for (const [from, to] of jobs) {
  const dest = join(root, to);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(join(src, from), dest, { recursive: true, force: true });
  console.log(`installed ${to} -> ${dest}`);
}

// Shim is generated, not copied: global plugins/ sits one level deep while
// the repo shim sits two (.opencode/plugins/), so the relative import
// differs. Keep it a one-line bridge.
const shimDir = join(root, "plugins");
mkdirSync(shimDir, { recursive: true });
const shim = join(shimDir, "anytxt.ts");
writeFileSync(shim, 'export { AnyTxtPlugin } from "../src/main.ts";\n');
console.log(`installed plugins/anytxt.ts (shim) -> ${shim}`);

const env = join(root, ".env");
if (!existsSync(env)) {
  cpSync(join(src, ".env.example"), env);
  console.log(`installed .env (from .env.example) -> ${env}`);
} else {
  console.log(`kept existing .env (${env})`);
}

console.log("Restart OpenCode to load the plugin, skill and command.");
