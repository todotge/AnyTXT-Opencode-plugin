#!/usr/bin/env bun
// anytxt-opencode install — copies the plugin, skill and command into the
// OpenCode config dir (~/.config/opencode by default; override with
// OPENCODE_CONFIG_DIR or a positional path). Idempotent, safe to re-run.
// Never touches an existing .env.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const root = process.argv[2] ?? process.env.OPENCODE_CONFIG_DIR ?? join(homedir(), ".config", "opencode");
const src = dirname(import.meta.dirname); // package root

const jobs = [
  ["plugins/anytxt.mjs", "plugins/anytxt.mjs"],
  ["skills/anytxt", "skills/anytxt"],
  ["command/anytxt-param.md", "command/anytxt-param.md"],
];

for (const [from, to] of jobs) {
  const dest = join(root, to);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(join(src, from), dest, { recursive: true, force: true });
  console.log(`installed ${to} -> ${dest}`);
}

const env = join(root, ".env");
if (!existsSync(env)) {
  cpSync(join(src, ".env.example"), env);
  console.log(`installed .env (from .env.example) -> ${env}`);
} else {
  console.log(`kept existing .env (${env})`);
}

console.log("Restart OpenCode to load the plugin, skill and command.");
