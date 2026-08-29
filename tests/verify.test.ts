import { describe, expect, test } from "bun:test";
import { splitTerms, andPairs, countOcc, verifyRaw } from "../src/verify.ts";

describe("splitTerms", () => {
  test("extracts terms from advanced syntax", () => {
    expect(splitTerms("patent & (canonical | basis) !draft")).toEqual([
      "patent",
      "canonical",
      "basis",
      "draft",
    ]);
  });

  test("keeps quoted phrases as one term", () => {
    expect(splitTerms('"hello world" & foo')).toEqual(["hello world", "foo"]);
  });

  test("lowercases everything", () => {
    expect(splitTerms("Version")).toEqual(["version"]);
  });
});

describe("countOcc", () => {
  test("counts all occurrences", () => {
    expect(countOcc("release 1.0.0 and 1.0.0 again", "1.0.0")).toBe(2);
  });

  test("returns 0 when absent", () => {
    expect(countOcc("1.0.1", "1.0.0")).toBe(0);
  });
});

describe("verifyRaw — the index lies", () => {
  test("rejects tokenizer equivalence: 1.0.1 is not 1.0.0", () => {
    const r = verifyRaw("1.0.1", "1.0.0", { exact: true });
    expect(r.ok).toBe(false);
    expect(r.counts["1.0.0"]).toBe(0);
  });

  test("accepts real version in raw text", () => {
    const r = verifyRaw("**Version:** 1.0.0 release 1.0.0", "1.0.0", { exact: true });
    expect(r.ok).toBe(true);
    expect(r.counts["1.0.0"]).toBe(2);
  });

  test("exact phrase with punctuation matches literally", () => {
    const r = verifyRaw("**Version:** 1.0.0", "Version: 1.0.0", { exact: true });
    expect(r.ok).toBe(true);
  });

  test("rejects AND when terms are pages apart", () => {
    const raw =
      "version at start " +
      "filler ".repeat(80) +
      "the number appears only at the very end 1.0.0";
    expect(verifyRaw(raw, "version & 1.0.0", { near: 200 }).ok).toBe(false);
  });

  test("accepts AND when terms are close", () => {
    expect(verifyRaw("version 1.0.0", "version & 1.0.0", { near: 200 }).ok).toBe(true);
  });

  test("OR needs only one term", () => {
    expect(verifyRaw("only draft here", "patent | draft").ok).toBe(true);
  });

  test("NOT excludes when term present", () => {
    expect(verifyRaw("graphify temporal", "graphify !temporal").ok).toBe(false);
  });

  test("NOT passes when term absent", () => {
    expect(verifyRaw("graphify only", "graphify !temporal").ok).toBe(true);
  });

  test("missing term fails", () => {
    const r = verifyRaw("hello world", "hello & missing");
    expect(r.ok).toBe(false);
    expect(r.note).toContain("missing");
  });

  test("empty raw text never passes", () => {
    const r = verifyRaw("", "1.0.0");
    expect(r.ok).toBe(false);
    expect(r.note).toBe("no raw text");
  });
});

describe("andPairs", () => {
  test("pairs terms joined by &", () => {
    expect(andPairs("version & 1.0.0")).toEqual([["version", "1.0.0"]]);
  });

  test("no pairs without &", () => {
    expect(andPairs("patent | draft")).toEqual([]);
  });
});
