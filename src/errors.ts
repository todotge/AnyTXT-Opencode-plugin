// errors.ts — distinguishable AnyTXT failures: network vs logic.
export type AnyTxtErrorCode =
  | "unreachable" // ATGUI down / all ports failed
  | "http_error" // HTTP status != 2xx
  | "rpc_error" // JSON-RPC error object (bad query etc.)
  | "unknown";

export class AnyTxtError extends Error {
  readonly code: AnyTxtErrorCode;

  constructor(code: AnyTxtErrorCode, message: string) {
    super(`anytxt[${code}]: ${message}`);
    this.name = "AnyTxtError";
    this.code = code;
  }
}
