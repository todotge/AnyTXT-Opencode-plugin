// types.ts — AnyTXT JSON-RPC 2.0 shapes + tool argument types.

// GetResult/Search/GetFragmentAll outputs (ATGUI wraps as result.data.output).
export type FileTuple = [fid: string, lastModify: number, size: number, file: string];

export type GetResultOutput = {
  count?: number;
  field?: string[];
  files?: FileTuple[];
};

export type SearchOutput = { count?: number };
export type FragmentOutput = { count?: number; text?: string[] };
export type RawTextOutput = { text?: string };
export type SyncOutput = Record<string, never>;

export type RpcEnvelope<T> = {
  id?: number;
  jsonrpc?: string;
  result?: { data?: { input?: unknown; output: T }; errno?: number };
  error?: { code?: number; data?: unknown; message?: string };
};

export type GetResultInput = {
  pattern: string;
  filterExt?: string;
  filterDir?: string;
  lastModifyBegin?: number;
  lastModifyEnd?: number;
  limit?: string;
  offset?: number;
  order?: number;
  st?: string;
};

// Tool args (schema-typed at the tool boundary, cast here).
export type SearchArgs = {
  pattern: string;
  directory?: string;
  filterExt?: string;
  limit?: number;
  offset?: number;
  st?: number;
  verify?: boolean;
};

export type FragmentArgs = { fid: string; pattern: string };
export type SyncArgs = { folder: string };
