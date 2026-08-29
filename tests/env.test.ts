import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cachedEnv } from "../src/env.ts";

const dir = mkdtempSync(join(tmpdir(), "anytxt-env-"));
const path = join(dir, ".env");

afterAll(() => rmSync(dir, { recursive: true, force: true }));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("cachedEnv", () => {
  test("reads the file", () => {
    writeFileSync(path, "ANYTXT_LIMIT=5\n");
    expect(cachedEnv(path, 50)).toEqual({ ANYTXT_LIMIT: "5" });
  });

  test("re-reads immediately when mtime changes", async () => {
    cachedEnv(path, 50);
    await sleep(5); // filesystem mtime tick — same-tick rewrites keep mtime
    writeFileSync(path, "ANYTXT_LIMIT=7\n");
    expect(cachedEnv(path, 50).ANYTXT_LIMIT).toBe("7");
  });

  test("re-reads after TTL even without mtime change", async () => {
    writeFileSync(path, "ANYTXT_LIMIT=9\n");
    cachedEnv(path, 60_000); // cache long
    writeFileSync(path, "ANYTXT_LIMIT=11\n");
    expect(cachedEnv(path, 60_000).ANYTXT_LIMIT).toBe("11"); // mtime changed
    expect(cachedEnv(path, 60_000).ANYTXT_LIMIT).toBe("11"); // cached
    await sleep(80);
    expect(cachedEnv(path, 50).ANYTXT_LIMIT).toBe("11"); // TTL short → re-read
  });

  test("missing file yields empty object", () => {
    expect(cachedEnv(join(dir, "nope.env"), 50)).toEqual({});
  });
});
