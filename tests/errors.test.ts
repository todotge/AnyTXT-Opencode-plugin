import { describe, expect, test } from "bun:test";
import { AnyTxtError } from "../src/errors.ts";

describe("AnyTxtError", () => {
  test("network failure carries unreachable code", () => {
    const e = new AnyTxtError("unreachable", "no server on 9920, 9921");
    expect(e.name).toBe("AnyTxtError");
    expect(e.code).toBe("unreachable");
    expect(e.message).toContain("no server");
  });

  test("rpc error carries rpc_error code", () => {
    const e = new AnyTxtError("rpc_error", JSON.stringify({ code: -32600, message: "invalid request" }));
    expect(e.code).toBe("rpc_error");
  });

  test("http failure carries http_error code", () => {
    const e = new AnyTxtError("http_error", "HTTP 500");
    expect(e.code).toBe("http_error");
  });

  test("unknown falls back to unknown code", () => {
    const e = new AnyTxtError("unknown", "x");
    expect(e.code).toBe("unknown");
  });
});
