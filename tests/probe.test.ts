// probe.test.ts — end-to-end against a live ATGUI (port 9920/9921).
// Skipped when ATGUI is down. Fixtures live under the home dir because
// ATGUI only indexes configured roots (e.g. /tmp is silently ignored).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AnyTxtPlugin } from "../.opencode/plugins/anytxt.ts";

const rpcPing = async (): Promise<boolean> => {
  for (const port of [9920, 9921]) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          method: "ATRpcServer.Searcher.V1.Search",
          params: { input: { pattern: "hello", filterDir: "/" } },
        }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) return true;
    } catch {
      // next port
    }
  }
  return false;
};

const up = await rpcPing();
const run = up ? test : test.skip;
const TIMEOUT = 300_000;

let dir: string;
let plugin: Awaited<ReturnType<typeof AnyTxtPlugin>>;
let ctx: { directory: string };

beforeAll(async () => {
  process.env.ANYTXT_ASK = "0"; // e2e ctx has no ask() — gate off for the suite
  plugin = await AnyTxtPlugin();
  dir = mkdtempSync(join(tmpdir().replace("/tmp", process.env.HOME ?? ""), "/anytxt-e2e-"));
  ctx = { directory: dir };
  writeFileSync(join(dir, "spec.md"), "**Version:** 1.0.0\nrelease 1.0.0\n");
  writeFileSync(join(dir, "v101.md"), "1.0.1\n");
  writeFileSync(join(dir, "v100.md"), "1.0.0\n");
  writeFileSync(
    join(dir, "far.md"),
    "version at start " + "filler ".repeat(80) + "the number appears only at the very end 1.0.0\n",
  );
  writeFileSync(join(dir, "code.py"), "def enrich():\n    return 1.0.0\n");
});

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("anytxt plugin e2e (live ATGUI)", () => {
  test(
    "raises permission ask before search when ANYTXT_ASK=1",
    async () => {
      process.env.ANYTXT_ASK = "1";
      const asks: unknown[] = [];
      const askCtx = { directory: dir, ask: async (i: unknown) => asks.push(i) };
      try {
        await (plugin.tool.anytxt_search.execute as any)({ pattern: "1.0.0", verify: false, limit: 5 }, askCtx);
      } finally {
        process.env.ANYTXT_ASK = "0";
      }
      expect(asks.length).toBe(1);
      expect((asks[0] as { permission: string }).permission).toBe("anytxt_search");
    },
    TIMEOUT,
  );

  run(
    "network failure raises coded unreachable error",
    async () => {
      // Forced closed port — deterministic regardless of ATGUI state.
      process.env.ANYTXT_PORT = "9911";
      try {
        await expect(
          (plugin.tool.anytxt_search.execute as any)({ pattern: "x", verify: false }, ctx),
        ).rejects.toThrow(/unreachable/);
      } finally {
        delete process.env.ANYTXT_PORT;
      }
    },
    TIMEOUT,
  );

  run(
    "sync reports disk count and confirms indexing",
    async () => {
      const out = await (plugin.tool.anytxt_sync.execute as any)({ folder: dir }, ctx);
      expect(out).toContain("files on disk");
      expect(out).toContain("indexed");
    },
    TIMEOUT,
  );

  run(
    "search verify excludes tokenizer false positive (1.0.0 != 1.0.1)",
    async () => {
      const out = await (plugin.tool.anytxt_search.execute as any)(
        { pattern: "1.0.0", verify: true, limit: 20 },
        ctx,
      );
      expect(out).toContain("3 verified / 4 indexed");
      expect(out).toContain("false positives excluded");
      expect(out).toMatch(/v101\.md.*missing "1\.0\.0"/);
      expect(out).toContain("v100.md");
      expect(out).toContain("spec.md");
      // excluded file must not appear among verified occurrences
      expect(out).not.toMatch(/v101\.md.*occ/);
    },
    TIMEOUT,
  );

  run(
    "st=1 exact matches punctuation phrase",
    async () => {
      const out = await (plugin.tool.anytxt_search.execute as any)(
        { pattern: '"Version: 1.0.0"', limit: 20 },
        ctx,
      );
      expect(out).toContain("spec.md");
      expect(out).not.toContain("v100.md");
    },
    TIMEOUT,
  );

  run(
    "fragment flags unverified when index lies about versions",
    async () => {
      const res = await (plugin.tool.anytxt_search.execute as any)(
        { pattern: "1.0.1", verify: false, limit: 20 },
        ctx,
      );
      const fid = res.match(/^(\d+)[^\n]*v101\.md/m)?.[1];
      expect(fid).toBeTruthy();
      const frag = await (plugin.tool.anytxt_fragment.execute as any)({ fid, pattern: "1.0.0" }, ctx);
      expect(frag).toContain("unverified");
    },
    TIMEOUT,
  );
});
