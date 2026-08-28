// anytxt — OpenCode plugin.
// Exposes AnyTXT Searcher (https://anytxt.net) full-text search as
// agent-callable tools via the JSON-RPC 2.0 API hosted inside the ATGUI
// process. Tries http://127.0.0.1:9920 then :9921 on every call; override
// with ANYTXT_URL (full URL) or ANYTXT_PORT.
// Config from the PROJECT .env (the session's cwd); the global opencode
// config dir .env is used only when the project has none.
//   ANYTXT_PORT, ANYTXT_DIR, ANYTXT_LIMIT (default 5), ANYTXT_FILTER_EXT, ANYTXT_ORDER.
// Read fresh on every call so /anytxt-param edits apply without restart.
// Non-commercial use only. ATGUI must be running for these tools to work.
import { tool } from "@opencode-ai/plugin";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// ponytail: project .env wins; global config dir .env only when project has none.
const globalEnv = join(dirname(dirname(import.meta.dirname)), ".env");

const readEnv = (dir) => {
  const project = dir ? join(dir, ".env") : null;
  const path = project && existsSync(project) ? project : globalEnv;
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split("\n")
        .map((l) => {
          const i = l.indexOf("=");
          if (i < 1 || l.slice(0, i).trimStart().startsWith("#")) return null;
          const v = l.slice(i + 1).trim().replace(/^"|"$/g, "");
          return v === "" ? null : [l.slice(0, i).trim(), v];
        })
        .filter(Boolean),
    );
  } catch {
    return {};
  }
};

// process.env wins — but drop empty strings: Bun auto-loads .env into
// process.env unfiltered, so `ANYTXT_LIMIT=` would arrive as "" and bypass
// the `??` defaults.
const cfg = (dir) => {
  const e = { ...readEnv(dir), ...process.env };
  for (const k of Object.keys(e)) if (e[k] === "") delete e[k];
  return e;
};

const urls = (dir) => {
  const e = cfg(dir);
  if (e.ANYTXT_URL) return [e.ANYTXT_URL.replace(/\/+$/, "")];
  if (e.ANYTXT_PORT) return [`http://127.0.0.1:${e.ANYTXT_PORT}`];
  return ["http://127.0.0.1:9920", "http://127.0.0.1:9921"];
};

// ponytail: no cached URL — .env edits must land immediately; one failed
// fetch when primary port is down is the price. Cache only if ATGUI flaps.
const rpc = async (method, input, dir) => {
  let lastErr;
  for (const url of urls(dir)) {
    let res, data;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params: { input } }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`anytxt HTTP ${res.status} ${res.statusText}`);
      data = await res.json();
    } catch (err) {
      lastErr = err;
      continue; // connection-level failure → next port
    }
    // Real rpc error: surface it, do not mask it as "unreachable".
    if (data.error) throw new Error(`anytxt rpc error: ${JSON.stringify(data.error)}`);
    // Real ATGUI wraps results as { result: { data: { input, output } } }.
    return data.result?.data?.output ?? data.result;
  }
  throw new Error(`anytxt: unreachable on ${urls(dir).join(", ")}: ${lastErr?.message ?? "no server"}`);
};

// ATGUI returns files as tuples aligned to the "field" header:
// ["fid", "lastModify", "size", "file"]
const fmtFiles = (out) =>
  out.files.map(([fid, mod, size, file]) =>
    `${fid} ${file ?? JSON.stringify([fid, mod, size, file])}${size ? ` (${size}b)` : ""}${mod ? ` @ ${mod}` : ""}`);

const anytxt_search = tool({
  description:
    "Search file contents via the local AnyTXT Searcher index (covers pdf, docx, pptx, xlsx, epub, rtf and other formats grep/ripgrep cannot read). Returns matching files with their FID. Use anytxt_fragment for snippets around matches.",
  args: {
    pattern: tool.schema.string().describe(
      'Search query. Advanced syntax: & AND, | OR, ! NOT, () grouping, "..." exact phrase. Example: patent & (canonical | basis) !draft',
    ),
    directory: tool.schema.string().optional().describe(
      "Optional folder to restrict the search to. Default: ANYTXT_DIR, then the session's project folder, then / (all volumes).",
    ),
    filterExt: tool.schema.string().optional().describe(
      'Optional extension filter, multiple separated by ";", e.g. "pdf;docx". Default: ANYTXT_FILTER_EXT or "*".',
    ),
    limit: tool.schema.number().optional().describe("Max number of results. Default: ANYTXT_LIMIT or 5."),
    offset: tool.schema.number().optional().describe("Result offset. Default 0."),
  },
  async execute(args, context) {
    const dir = context?.directory ?? process.cwd();
    const e = cfg(dir);
    const input = {
      pattern: args.pattern,
      filterExt: args.filterExt ?? e.ANYTXT_FILTER_EXT ?? "*",
      lastModifyBegin: 0,
      lastModifyEnd: 2147483647,
      limit: String(args.limit ?? e.ANYTXT_LIMIT ?? 5),
      offset: args.offset ?? 0,
      order: Number(e.ANYTXT_ORDER ?? 0),
    };
    // ponytail: always send filterDir — omitting it makes the server default
    // to "C:" (Windows heritage) and return 0 results on Linux.
    // Priority: call arg > ANYTXT_DIR > session cwd > / (all volumes).
    input.filterDir = args.directory ?? e.ANYTXT_DIR ?? dir ?? "/";

    const result = await rpc("ATRpcServer.Searcher.V1.GetResult", input, dir);
    const files = result?.files;
    if (!Array.isArray(files) || files.length === 0) {
      return `anytxt: no files match "${args.pattern}"`;
    }
    const head = `anytxt: ${files.length}/${result.count ?? files.length} files match "${args.pattern}"\n`;
    return head + fmtFiles(result).join("\n");
  },
});

const anytxt_fragment = tool({
  description:
    "Get text fragments containing a keyword from a file in the AnyTXT index, by FID returned from anytxt_search.",
  args: {
    fid: tool.schema.string().describe("File ID (FID) from anytxt_search results."),
    pattern: tool.schema.string().describe("Keyword whose surrounding text should be returned."),
  },
  async execute(args, context) {
    const result = await rpc("ATRpcServer.Searcher.V1.GetFragmentAll", {
      fid: args.fid,
      pattern: args.pattern,
    }, context?.directory ?? process.cwd());
    const lines = (result?.text ?? []).filter(Boolean);
    if (!lines.length) return `anytxt: no fragments for fid=${args.fid}`;
    return lines.join("\n---\n");
  },
});

const anytxt_sync = tool({
  description:
    "Add or refresh a folder in the AnyTXT Searcher index so its files become searchable.",
  args: {
    folder: tool.schema.string().describe("Folder path to index."),
  },
  async execute(args, context) {
    await rpc("ATRpcServer.Searcher.V1.SyncIndex", { folder: args.folder }, context?.directory ?? process.cwd());
    return `anytxt: synced index for ${args.folder}`;
  },
});

export const AnyTxtPlugin = async () => ({
  tool: { anytxt_search, anytxt_fragment, anytxt_sync },
});
