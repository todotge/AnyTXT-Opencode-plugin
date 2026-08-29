#!/usr/bin/env bun
// anytxt-opencode install|remove|update — install copies the plugin source, OpenCode
// shim, skill and command into the OpenCode config dir (~/.config/opencode by
// default; override with OPENCODE_CONFIG_DIR or a positional path). Idempotent,
// safe to re-run. Never touches an existing .env. remove deletes exactly what
// install created — never the .env, never anything outside the known entries.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// `bunx anytxt-opencode@0.0.5 install|remove|update [target]` — subcommands are
// not paths. Optional positional target, then OPENCODE_CONFIG_DIR, then
// default. update = install (re-copy, idempotent), only wording differs.
const SUB = ["install", "remove", "update"];
const argv = process.argv.slice(2);
const mode = argv.includes("remove") ? "remove" : argv.includes("update") ? "update" : "install";
const args = argv.filter((a) => !SUB.includes(a));
const root = args[0] ?? process.env.OPENCODE_CONFIG_DIR ?? join(homedir(), ".config", "opencode");
const src = fileURLToPath(new URL("../", import.meta.url)); // package root

const entries = [
  ["src", "src"],
  ["skills/anytxt", "skills/anytxt"],
  ["command/anytxt-param.md", "command/anytxt-param.md"],
];

if (mode === "remove") {
  if (resolve(root) === parse(resolve(root)).root) {
    console.error(`refusing to remove from filesystem root: ${root}`);
    process.exit(1);
  }
  let removed = 0;
  let ok = true;
  for (const [, to] of entries) {
    const p = join(root, to);
    if (!existsSync(p)) {
      console.log(`skip ${to} (not installed)`);
      continue;
    }
    try {
      rmSync(p, { recursive: true, force: true });
      console.log(`removed ${to} -> ${p}`);
      removed += 1;
    } catch (err) {
      ok = false;
      console.error(`failed to remove ${to} (${p}): ${err.message}`);
    }
  }
  const shim = join(root, "plugins", "anytxt.ts");
  if (existsSync(shim)) {
    try {
      rmSync(shim, { force: true });
      console.log(`removed plugins/anytxt.ts (shim) -> ${shim}`);
      removed += 1;
    } catch (err) {
      ok = false;
      console.error(`failed to remove plugins/anytxt.ts (${shim}): ${err.message}`);
    }
  } else {
    console.log("skip plugins/anytxt.ts (not installed)");
  }
  if (existsSync(join(root, ".env"))) {
    console.log(`kept .env (${join(root, ".env")}) — never removed`);
  }
  if (removed === 0) console.log(`nothing installed under ${root}`);
  if (!ok) process.exit(1);
  console.log("Done. Restart OpenCode.");
  process.exit(0);
}

const verb = mode === "update" ? "updated" : "installed";
const jobs = entries;

for (const [from, to] of jobs) {
  const dest = join(root, to);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(join(src, from), dest, { recursive: true, force: true });
  console.log(`${verb} ${to} -> ${dest}`);
}

// Shim is generated, not copied: global plugins/ sits one level deep while
// the repo shim sits two (.opencode/plugins/), so the relative import
// differs. Keep it a one-line bridge.
const shimDir = join(root, "plugins");
mkdirSync(shimDir, { recursive: true });
const shim = join(shimDir, "anytxt.ts");
writeFileSync(shim, 'export { AnyTxtPlugin } from "../src/main.ts";\n');
console.log(`${verb} plugins/anytxt.ts (shim) -> ${shim}`);

const env = join(root, ".env");
if (!existsSync(env)) {
  cpSync(join(src, ".env.example"), env);
  console.log(`installed .env (from .env.example) -> ${env}`);
} else {
  console.log(`kept existing .env (${env})`);
}

console.log("Restart OpenCode to load the plugin, skill and command.");
