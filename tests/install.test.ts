// install.test.ts — installer CLI: `install` subcommand must not be
// mistaken for a target path (regression: installed into cwd/install/).
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const bin = join(import.meta.dir, "../bin/install.mjs");

const run = (args: string[], cwd: string, env: Record<string, string> = {}) =>
  Bun.spawnSync(["bun", bin, ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdout: "ignore",
  });

describe("installer CLI", () => {
  test("`install` subcommand targets config dir, not cwd", () => {
    const cwd = mkdtempSync(join(tmpdir(), "atx-cwd-"));
    const target = mkdtempSync(join(tmpdir(), "atx-target-"));
    const res = run(["install", target], cwd);
    expect(res.exitCode).toBe(0);
    expect(existsSync(join(target, "plugins", "anytxt.ts"))).toBe(true);
    expect(existsSync(join(target, "src", "main.ts"))).toBe(true);
    expect(existsSync(join(cwd, "install"))).toBe(false);
    rmSync(cwd, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
  });

  test("`install` without target uses OPENCODE_CONFIG_DIR", () => {
    const cwd = mkdtempSync(join(tmpdir(), "atx-cwd2-"));
    const target = mkdtempSync(join(tmpdir(), "atx-target2-"));
    const res = run(["install"], cwd, { OPENCODE_CONFIG_DIR: target });
    expect(res.exitCode).toBe(0);
    expect(existsSync(join(target, "plugins", "anytxt.ts"))).toBe(true);
    expect(existsSync(join(cwd, "install"))).toBe(false);
    rmSync(cwd, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
  });

  test("plain positional target still works", () => {
    const target = mkdtempSync(join(tmpdir(), "atx-target3-"));
    const res = run([target], "/");
    expect(res.exitCode).toBe(0);
    expect(existsSync(join(target, "plugins", "anytxt.ts"))).toBe(true);
    rmSync(target, { recursive: true, force: true });
  });

  test("`remove` deletes installed entries, keeps .env", () => {
    const target = mkdtempSync(join(tmpdir(), "atx-target4-"));
    expect(run(["install", target], "/").exitCode).toBe(0);
    expect(existsSync(join(target, "src", "main.ts"))).toBe(true);
    const res = run(["remove", target], "/");
    expect(res.exitCode).toBe(0);
    expect(existsSync(join(target, "src"))).toBe(false);
    expect(existsSync(join(target, "plugins", "anytxt.ts"))).toBe(false);
    expect(existsSync(join(target, "skills", "anytxt"))).toBe(false);
    expect(existsSync(join(target, "command", "anytxt-param.md"))).toBe(false);
    expect(existsSync(join(target, ".env"))).toBe(true);
    rmSync(target, { recursive: true, force: true });
  });

  test("`remove` on empty target exits 0, nothing to remove", () => {
    const target = mkdtempSync(join(tmpdir(), "atx-target5-"));
    const res = run(["remove", target], "/");
    expect(res.exitCode).toBe(0);
    rmSync(target, { recursive: true, force: true });
  });

  test("`remove` refuses filesystem root", () => {
    const res = run(["remove", "/"], "/");
    expect(res.exitCode).toBe(1);
    expect(res.stderr.toString()).toContain("refusing");
  });

  test("`remove` without target uses OPENCODE_CONFIG_DIR", () => {
    const cwd = mkdtempSync(join(tmpdir(), "atx-cwd3-"));
    const target = mkdtempSync(join(tmpdir(), "atx-target6-"));
    expect(
      run(["install"], cwd, { OPENCODE_CONFIG_DIR: target }).exitCode,
    ).toBe(0);
    const res = run(["remove"], cwd, { OPENCODE_CONFIG_DIR: target });
    expect(res.exitCode).toBe(0);
    expect(existsSync(join(target, "src"))).toBe(false);
    expect(existsSync(join(cwd, "remove"))).toBe(false);
    rmSync(cwd, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
  });
});
