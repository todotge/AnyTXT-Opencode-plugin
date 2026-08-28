// anytxt — OpenCode plugin.
// Exposes AnyTXT Searcher (https://anytxt.net) full-text search as
// agent-callable tools via the JSON-RPC 2.0 API hosted inside the ATGUI
// process (default http://127.0.0.1:9920, override with ANYTXT_URL).
// Non-commercial use only. ATGUI must be running for these tools to work.
import { tool } from "@opencode-ai/plugin";

const rpc = async (method, input) => {
  const url = (process.env.ANYTXT_URL || "http://127.0.0.1:9920").replace(/\/+$/, "");
  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params: { input } }),
  });
  if (!res.ok) throw new Error(`anytxt HTTP ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (data.error) throw new Error(`anytxt rpc error: ${JSON.stringify(data.error)}`);
  // Real ATGUI wraps results as { result: { data: { input, output } } }.
  return data.result?.data?.output ?? data.result;
};

// ATGUI returns files as tuples aligned to a "field" header: [fid, lastModify, size, file].
const fmtFiles = (out) => {
  const field = out.field ?? ["fid", "lastModify", "size", "file"];
  return out.files.map((row) => {
    const f = Object.fromEntries(field.map((k, i) => [k, row[i]]));
    const p = f.file ?? f.path ?? JSON.stringify(row);
    const size = f.size ? ` (${f.size}b)` : "";
    const mod = f.lastModify ? ` @ ${f.lastModify}` : "";
    return `${f.fid ?? ""} ${p}${size}${mod}`;
  });
};

export const anytxt_search = tool({
  description:
    "Search file contents via the local AnyTXT Searcher index (covers pdf, docx, pptx, xlsx, epub, rtf and other formats grep/ripgrep cannot read). Returns matching files with their FID. Use anytxt_fragment for snippets around matches.",
  args: {
    pattern: tool.schema.string().describe(
      'Search query. Advanced syntax: & AND, | OR, ! NOT, () grouping, "..." exact phrase. Example: patent & (canonical | basis) !draft',
    ),
    directory: tool.schema.string().optional().describe(
      "Optional folder to restrict the search to. Omit to search all indexed folders.",
    ),
    filterExt: tool.schema.string().optional().describe(
      'Optional extension filter, multiple separated by ";", e.g. "pdf;docx". Default "*".',
    ),
    limit: tool.schema.number().optional().describe("Max number of results. Default 100."),
    offset: tool.schema.number().optional().describe("Result offset. Default 0."),
  },
  async execute(args) {
    const input = {
      pattern: args.pattern,
      filterExt: args.filterExt ?? "*",
      lastModifyBegin: 0,
      lastModifyEnd: 2147483647,
      limit: String(args.limit ?? 100),
      offset: args.offset ?? 0,
      order: 0,
    };
    if (args.directory) input.filterDir = args.directory;

    const result = await rpc("ATRpcServer.Searcher.V1.GetResult", input);
    const files = result?.files;
    if (!Array.isArray(files) || files.length === 0) {
      return `anytxt: no files match "${args.pattern}"`;
    }
    const head = `anytxt: ${files.length}/${result.count ?? files.length} files match "${args.pattern}"\n`;
    return head + fmtFiles(result).join("\n");
  },
});

export const anytxt_fragment = tool({
  description:
    "Get text fragments containing a keyword from a file in the AnyTXT index, by FID returned from anytxt_search.",
  args: {
    fid: tool.schema.string().describe("File ID (FID) from anytxt_search results."),
    pattern: tool.schema.string().describe("Keyword whose surrounding text should be returned."),
  },
  async execute(args) {
    const result = await rpc("ATRpcServer.Searcher.V1.GetFragmentAll", {
      fid: args.fid,
      pattern: args.pattern,
    });
    const lines = (result?.text ?? []).filter(Boolean);
    if (!lines.length) return `anytxt: no fragments for fid=${args.fid}`;
    return lines.join("\n---\n");
  },
});

export const anytxt_sync = tool({
  description:
    "Add or refresh a folder in the AnyTXT Searcher index so its files become searchable.",
  args: {
    folder: tool.schema.string().describe("Folder path to index."),
  },
  async execute(args) {
    await rpc("ATRpcServer.Searcher.V1.SyncIndex", { folder: args.folder });
    return `anytxt: synced index for ${args.folder}`;
  },
});

export const AnyTxtPlugin = async () => ({
  tool: { anytxt_search, anytxt_fragment, anytxt_sync },
});

export default AnyTxtPlugin;
