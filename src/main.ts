// main.ts — anytxt OpenCode plugin.
// Exposes AnyTXT Searcher (https://anytxt.net) full-text search as
// agent-callable tools via the JSON-RPC 2.0 API hosted inside the ATGUI
// process. Tries http://127.0.0.1:9920 then :9921 on every call; override
// with ANYTXT_URL (full URL) or ANYTXT_PORT.
// Config from the PROJECT .env (the session's cwd); the global opencode
// config dir .env is used only when the project has none.
//   ANYTXT_PORT, ANYTXT_DIR, ANYTXT_LIMIT (default 5), ANYTXT_FILTER_EXT,
//   ANYTXT_ORDER, ANYTXT_VERIFY, ANYTXT_NEAR, ANYTXT_SYNC_TIMEOUT.
// Cached with a short TTL so /anytxt-param edits apply without restart.
// Non-commercial use only. ATGUI must be running for these tools to work.
import { tool, type ToolContext } from "@opencode-ai/plugin";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AnyTxtError } from "./errors.ts";
import { cachedEnv, type Env } from "./env.ts";
import {
  type FragmentArgs,
  type FragmentOutput,
  type GetResultInput,
  type GetResultOutput,
  type RawTextOutput,
  type RpcEnvelope,
  type SearchArgs,
  type SearchOutput,
  type SyncArgs,
  type SyncOutput,
} from "./types.ts";
import { verifyRaw } from "./verify.ts";

// Portable package root (works under Node and Bun, .ts or compiled).
const pkgRoot = fileURLToPath(new URL("../", import.meta.url));
// ponytail: project .env wins; global config dir .env only when project has none.
const globalEnvPath = join(pkgRoot, ".env");

const cfg = (dir: string): Env => {
  const project = dir ? join(dir, ".env") : null;
  const path = project && existsSync(project) ? project : globalEnvPath;
  const e: Env = { ...cachedEnv(path) };
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && v !== "") e[k] = v;
  }
  return e;
};

const urls = (dir: string): string[] => {
  const e = cfg(dir);
  if (e.ANYTXT_URL) return [e.ANYTXT_URL.replace(/\/+$/, "")];
  if (e.ANYTXT_PORT) return [`http://127.0.0.1:${e.ANYTXT_PORT}`];
  return ["http://127.0.0.1:9920", "http://127.0.0.1:9921"];
};

// Plugin-side permission gate: the opencode permission engine ignores
// custom/plugin tool names (verified v1.17.18), so each tool raises its own
// ask via the official ToolContext.ask API. Disable with ANYTXT_ASK=0.
const maybeAsk = async (
  ctx: ToolContext,
  e: Env,
  permission: string,
  patterns: string[],
  always: string[],
  metadata: Record<string, unknown>,
) => {
  if ((e.ANYTXT_ASK ?? "1") === "0") return;
  await ctx.ask({ permission, patterns, always, metadata });
};

// ponytail: no cached URL — .env edits must land immediately; one failed
// fetch when primary port is down is the price. Cache only if ATGUI flaps.
// Failures are coded: unreachable (network) vs http_error vs rpc_error.
const rpc = async <T>(method: string, input: unknown, dir: string): Promise<T> => {
  let lastErr: unknown;
  for (const url of urls(dir)) {
    let res: Response;
    let data: RpcEnvelope<T>;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ id: 1, jsonrpc: "2.0", method, params: { input } }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        lastErr = new AnyTxtError("http_error", `${res.status} ${res.statusText} on ${url}`);
        continue; // connection-level failure → next port
      }
      data = (await res.json()) as RpcEnvelope<T>;
    } catch (err) {
      lastErr = err;
      continue; // connection-level failure → next port
    }
    // Real rpc error: surface it, do not mask it as "unreachable".
    if (data.error) throw new AnyTxtError("rpc_error", JSON.stringify(data.error));
    const out = data.result?.data?.output;
    if (out === undefined) throw new AnyTxtError("unknown", `missing result.data.output from ${url}`);
    // Real ATGUI wraps results as { result: { data: { input, output } } }.
    return out;
  }
  throw new AnyTxtError(
    "unreachable",
    `no server on ${urls(dir).join(", ")}: ${lastErr instanceof Error ? lastErr.message : "no server"}`,
  );
};

// ATGUI returns files as tuples aligned to the "field" header:
// ["fid", "lastModify", "size", "file"]
const fmtFiles = (out: GetResultOutput): string[] =>
  (out.files ?? []).map(
    ([fid, mod, size, file]) =>
      `${fid} ${file ?? JSON.stringify([fid, mod, size, file])}${size ? ` (${size}b)` : ""}${mod ? ` @ ${mod}` : ""}`,
  );

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
    st: tool.schema.number().optional().describe(
      "Search type: 1 exact, 2 advanced (default). 4 (regexp) is not supported over RPC. Quoted patterns switch to exact automatically.",
    ),
    verify: tool.schema.boolean().optional().describe(
      "Verify matches against raw text (GetRawTextByFID) and exclude false positives. Default: true (ANYTXT_VERIFY).",
    ),
  },
  async execute(args, context) {
    const a = args as SearchArgs;
    const ctx = context as ToolContext;
    const dir = ctx.directory ?? process.cwd();
    const e = cfg(dir);
    // Quoted phrase → exact mode (st=1) without quotes: ATGUI phrase search
    // breaks on punctuation, unquoted exact does not.
    const quoted = /^".*"$/s.test(a.pattern ?? "");
    const st = a.st ?? (quoted ? 1 : undefined);
    const pattern = quoted ? (a.pattern ?? "").slice(1, -1) : a.pattern;
    const verify = a.verify ?? (e.ANYTXT_VERIFY ?? "1") !== "0";
    const near = Number(e.ANYTXT_NEAR ?? 200);
    const exact = st === 1 || quoted;
    await maybeAsk(ctx, e, "anytxt_search", [pattern], [`search "${pattern}"`], { pattern });
    const input: GetResultInput = {
      pattern,
      filterExt: a.filterExt ?? e.ANYTXT_FILTER_EXT ?? "*",
      lastModifyBegin: 0,
      lastModifyEnd: 2147483647,
      limit: String(a.limit ?? e.ANYTXT_LIMIT ?? 5),
      offset: a.offset ?? 0,
      order: Number(e.ANYTXT_ORDER ?? 0),
    };
    if (st !== undefined) input.st = String(st);
    // ponytail: always send filterDir — omitting it makes the server default
    // to "C:" (Windows heritage) and return 0 results on Linux.
    // Priority: call arg > ANYTXT_DIR > session cwd > / (all volumes).
    input.filterDir = a.directory ?? e.ANYTXT_DIR ?? dir ?? "/";

    const result = await rpc<GetResultOutput>("ATRpcServer.Searcher.V1.GetResult", input, dir);
    const files = result.files;
    if (!Array.isArray(files) || files.length === 0) {
      return `anytxt: no files match "${pattern}"`;
    }
    if (!verify) {
      const head = `anytxt: ${files.length}/${result.count ?? files.length} files match "${pattern}"\n`;
      return head + fmtFiles(result).join("\n");
    }
    // The index lies about versions and proximity: verify each file against
    // its raw text and drop false positives.
    const kept: string[] = [];
    const excluded: string[] = [];
    for (const f of files) {
      const [fid, mod, size, file] = f;
      const line = `${fid} ${file}${size ? ` (${size}b)` : ""}${mod ? ` @ ${mod}` : ""}`;
      let raw: string | null = null;
      try {
        raw = (await rpc<RawTextOutput>("ATRpcServer.Searcher.V1.GetRawTextByFID", { fid }, dir))
          ?.text ?? "";
      } catch {
        // raw text unavailable — keep with flag, we cannot prove it wrong
      }
      if (raw === null) {
        kept.push(`${line} — unverified (no raw text)`);
        continue;
      }
      const res = verifyRaw(raw, pattern, { exact, near });
      if (!res.ok) {
        excluded.push(`${line} — ${res.note}`);
        continue;
      }
      const n = Math.min(...Object.values(res.counts));
      let flags = "";
      // Disk cross-check for text files: stale index or post-index edits.
      try {
        const s = statSync(file);
        if (s.isFile() && s.size < 5_000_000) {
          if (Math.floor(s.mtimeMs / 1000) > Number(mod ?? 0)) flags += " ⚠ stale index";
          const disk = readFileSync(file, "utf8");
          if (!verifyRaw(disk, pattern, { exact, near }).ok) flags += " ⚠ differs from disk";
        }
      } catch {
        // binary or unreadable — raw text is the truth
      }
      kept.push(`${line} — ${n} occ${flags}`);
    }
    const head = `anytxt: ${kept.length} verified / ${files.length} indexed match "${pattern}"`;
    const excl = excluded.length
      ? `\n${excluded.length} false positives excluded:\n${excluded.join("\n")}`
      : "";
    return head + excl + "\n" + kept.join("\n");
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
    const a = args as FragmentArgs;
    const ctx = context as ToolContext;
    const dir = ctx.directory ?? process.cwd();
    const e = cfg(dir);
    await maybeAsk(ctx, e, "anytxt_fragment", [a.fid], [`fragment ${a.fid}`], { fid: a.fid });
    const result = await rpc<FragmentOutput>(
      "ATRpcServer.Searcher.V1.GetFragmentAll",
      { fid: a.fid, pattern: a.pattern },
      dir,
    );
    const lines = (result.text ?? []).filter(Boolean);
    if (!lines.length) return `anytxt: no fragments for fid=${a.fid}`;
    // Fragment lie check: strip highlight markers, see if the pattern is
    // actually in the text (version tokenizer can return wrong fragments).
    const joined = lines.join("\n").replace(/\*<<\*|\*>>\*/g, "").toLowerCase();
    const p = (a.pattern ?? "").toLowerCase().replace(/^"|"$/g, "").replace(/[*_`]/g, "");
    const warn =
      p && joined.includes(p)
        ? ""
        : `⚠ fragment unverified — index lies for numbers/versions (pattern "${a.pattern}" not in fragments)\n`;
    return warn + lines.join("\n---\n");
  },
});

// First word (>=4 letters) from the first readable text file in the folder.
// Used as probe to confirm the folder actually entered the index after sync.
const findProbe = (folder: string): string | null => {
  try {
    const entries = readdirSync(folder, { recursive: true, withFileTypes: true });
    for (const x of entries) {
      if (!x.isFile()) continue;
      if (!/\.(md|txt|json|html|log|yml|yaml|csv)$/i.test(x.name)) continue;
      const parent = x.parentPath ?? (x as unknown as { path?: string }).path ?? folder;
      const text = readFileSync(join(parent, x.name), "utf8").slice(0, 65536);
      const m = text.match(/[A-Za-z]{4,}/);
      if (m) return m[0].toLowerCase();
    }
  } catch {
    // unreadable folder — no probe possible
  }
  return null;
};

const anytxt_sync = tool({
  description:
    "Add or refresh a folder in the AnyTXT Searcher index so its files become searchable.",
  args: {
    folder: tool.schema.string().describe("Folder path to index."),
  },
  async execute(args, context) {
    const a = args as SyncArgs;
    const ctx = context as ToolContext;
    const dir = ctx.directory ?? process.cwd();
    const e = cfg(dir);
    if (!existsSync(a.folder)) return `anytxt: no such folder ${a.folder}`;
    await maybeAsk(ctx, e, "anytxt_sync", [a.folder], [`sync ${a.folder}`], { folder: a.folder });
    let diskCount = "?";
    try {
      diskCount = String(
        readdirSync(a.folder, { recursive: true, withFileTypes: true }).filter((x) => x.isFile()).length,
      );
    } catch {
      // count is best-effort
    }
    const t0 = Date.now();
    await rpc<SyncOutput>("ATRpcServer.Searcher.V1.SyncIndex", { folder: a.folder }, dir);
    // SyncIndex returns {} and indexing is async: poll until a probe word
    // from the folder becomes searchable, or time out.
    const timeout = Number(e.ANYTXT_SYNC_TIMEOUT ?? 120) * 1000;
    const probe = findProbe(a.folder);
    let found = false;
    let count = 0;
    if (probe) {
      while (Date.now() - t0 < timeout) {
        try {
          const r = await rpc<SearchOutput>(
            "ATRpcServer.Searcher.V1.Search",
            {
              pattern: probe,
              filterExt: "*",
              lastModifyBegin: 0,
              lastModifyEnd: 2147483647,
              filterDir: a.folder,
            },
            dir,
          );
          count = r.count ?? 0;
          if (count > 0) {
            found = true;
            break;
          }
        } catch {
          // still indexing
        }
        await new Promise((res) => setTimeout(res, 5000));
      }
    }
    const secs = Math.round((Date.now() - t0) / 1000);
    const status = probe
      ? found
        ? `indexed after ${secs}s (probe "${probe}": ${count} files)`
        : `⚠ not in index after ${secs}s — folder may be outside ATGUI indexed roots`
      : "indexing started (no text file found to probe)";
    return `anytxt: synced ${a.folder} — ${diskCount} files on disk; ${status}`;
  },
});

export const AnyTxtPlugin = async () => ({
  tool: { anytxt_search, anytxt_fragment, anytxt_sync },
});
