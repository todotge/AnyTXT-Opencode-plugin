# AnyTXT for OpenCode — Developer Guide

Everything needed to develop, test and release the plugin.

## Structure

```
src/main.ts                    plugin: 3 tools + env config + RPC client
src/verify.ts                  truth engine (raw-text verification, proximity)
src/env.ts                     .env parsing + cache (mtime+size+TTL)
src/errors.ts                  AnyTxtError codes
src/types.ts                   RPC envelopes + tool args
.opencode/plugins/anytxt.ts    OpenCode shim — one-line re-export (no logic)
bin/install.mjs                installer (bunx anytxt-opencode@0.0.5 install/remove/update)
skills/anytxt/SKILL.md         agent skill
command/anytxt-param.md        /anytxt-param command
tests/verify.test.ts           unit: verify engine
tests/errors.test.ts           unit: error codes
tests/env.test.ts              unit: env cache
tests/probe.test.ts            e2e: live ATGUI (skipped when down) + error path
docs/user.md                   end-user guide
opencode.json                  project permission rules (asks)
```

**Shim pattern**: `.opencode/plugins/anytxt.ts` only re-exports
`../../src/main.ts` — OpenCode loads the shim, all logic lives in `src/`.
The installer GENERATES the shim with `../src/main.ts` because the global
config dir has one less nesting level than the repo.

## Setup

```sh
bun install
bun test                # unit always; live e2e when ATGUI port 9920/9921 is up
bun run typecheck       # tsc --noEmit
```

Add dev deps with `bun add -d <pkg>` (typescript, @types/bun). `tsconfig.json`
is strict (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `noEmit`).

## Testing

- TDD: write the failing test first (`bun test tests/x.test.ts`), watch it
  fail for the right reason, implement the minimum, watch it pass.
- `tests/probe.test.ts` pings 9920/9921 at import time; every live test is
  skipped when ATGUI is down. Fixtures live under `$HOME` because ATGUI
  ignores `/tmp` even after `SyncIndex` returns OK.
- The error-path test forces `ANYTXT_PORT=9911` (closed port) — deterministic
  regardless of ATGUI state.
- e2e asserts: sync feedback, `1.0.0` ≠ `1.0.1` exclusion, `st=1`
  punctuation, fragment lie warning, permission ask raised.

## AnyTXT API (official reference — non-commercial use only)

HTTP JSON-RPC 2.0 hosted inside the ATGUI process. Base:
`POST http://127.0.0.1:9920` (plugin falls back to 9921). Envelope:

```json
{ "id": 123, "jsonrpc": "2.0", "method": "ATRpcServer.Searcher.V1.<Method>", "params": { "input": { } } }
```

Response: `result.data.output`. Non-commercial use only (AnyTXT license).

### Methods

| Method | Input | Output |
| --- | --- | --- |
| `Search` | pattern, filterDir, filterExt, lastModifyBegin, lastModifyEnd | `{ count }` — matching file count (no pagination) |
| `GetResult` | Search inputs + limit, offset, order | `{ count, field, files: [fid, lastModify, size, file][] }` |
| `GetFragment` | fid, pattern | `{ text }` — one fragment, highlights `*<<*…*>>*` |
| `GetFragmentAll` | fid, pattern | `{ count, text[] }` — all fragments, highlights `*<<*…*>>*` |
| `SyncIndex` | folder | `{}` — no feedback |
| `GetRawTextByFID` | fid | `{ text }` — raw text (verification source of truth) |
| `OCR` | file | OCR text — OCR version only |

### Input fields

- `pattern`: advanced syntax (below); quoted phrases = exact, not tokenized.
- `filterDir`: folder restriction; server defaults to `"C:"` when omitted.
- `filterExt`: `"*"` or `"doc;pdf;ppt"` — multiple via `;`.
- `lastModifyBegin` / `lastModifyEnd`: Unix timestamps, `0` .. `2147483647`.
- `limit`: page size; `offset`: page start.
- `order`: 0 default, 1 lastModify ASC, 2 lastModify DESC, 3 filterDir ASC,
  4 filterDir DESC.

### Advanced search syntax

| Operator | Meaning |
| --- | --- |
| `&` | AND — terms on both sides included |
| `\|` | OR — at least one side matches |
| `!` | NOT — exclude results containing the term after |
| `( )` | grouping — combinable with other operators |
| `" "` | exact match — phrase not tokenized/split |

```text
test | hello
test | "hello word"
test | "hello word" !this
test & (hello | "this is") !that
```

### curl example (GetResult)

```sh
curl --location '127.0.0.1:9920' \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --data '{
    "id": 123, "jsonrpc": "2.0",
    "method": "ATRpcServer.Searcher.V1.GetResult",
    "params": { "input": {
      "pattern": "Hello", "filterDir": "C:\\", "filterExt": "*",
      "lastModifyBegin": 0, "lastModifyEnd": 2147483647,
      "limit": "300", "offset": 0, "order": 0 } } }'
```

### Quirks (probed live, 2026-08-28/29 — why the plugin is built this way)

- `filterDir` omitted → server defaults to `"C:"` (Windows heritage) → 0
  results on Linux. The plugin always sends it.
- Version tokenization is broken: `1.0.0` ≡ `1.0.1` (search AND fragments).
  Raw-text verification is the only cure.
- `st` param (plugin extension): `1` exact (unquoted phrase with punctuation
  works), `2` advanced, `4` regexp → always 0 over RPC (unsupported).
- Orders: 0 default, 1 modtime ASC, 2 DESC, 3 filterDir ASC, 4 DESC.
- No filename filter over RPC; `Search ""`/`"*"` → 0 (no "list all").
- Indexing is async (~45 s); `/tmp` never indexed; folders outside indexed
  roots are silently ignored even after a successful `SyncIndex`.
- False positives confirmed on disk: matched files with 0 real occurrences.
- Official API lists `OCR` (input `file`); 

## Architecture notes

- **Verification pipeline** (`anytxt_search`): GetResult → per-file
  `GetRawTextByFID` → `verifyRaw` (literal substring match, `&`/`|`/`!`
  parsed, `&` pairs within `ANYTXT_NEAR` window, markdown chars stripped) →
  false positives excluded and reported → disk cross-check (mtime vs indexed
  `lastModify`, content) → per-file occurrence counts.
- **Env cache** (`src/env.ts`): stat mtimeNs + size + TTL (1 s default) —
  `/anytxt-param` edits land immediately, no readFileSync per call. Same-tick
  rewrites keep mtime (fs granularity) — size guards that.
- **Errors** (`src/errors.ts`): `unreachable` (network) / `http_error` /
  `rpc_error` (logic) — distinguishable, prefixed `anytxt[code]:`.
- **Permission ask**: the opencode engine does not prompt for plugin tools
  unless the tool itself calls `ToolContext.ask()`. Both halves required:
  plugin raises ask (`ANYTXT_ASK`) AND `opencode.json` carries matching
  rules — otherwise the agent's allow-all default wins silently.
- **Plugin exports**: only `AnyTxtPlugin` — every function export of a
  plugin module is treated as a plugin factory by OpenCode; never export
  helpers from `main.ts` (they live in `verify.ts`/`env.ts`/…).

## Release process

1. Bump `version` in `package.json` (semver, matches the changelog phase).
2. Update `CHANGELOG.md` (Keep a Changelog, current order: newest released
   at top, `[Unreleased]` with planned phases, diff links at the bottom).
3. `npm publish --dry-run` — verify the tarball (bin, src, .opencode,
   skills, command, .env.example).
4. Tag `vX.Y.Z`, push, `npm publish`.
5. Test the installer end-to-end:
   `bun bin/install.mjs /tmp/anytxt-test` then import the generated shim.
6. Post release: `[Unreleased]` diff link moves to the new tag.
7. Bump the pinned bunx version (`@x.y.z`) in README, docs/user.md,
   docs/dev.md, bin/install.mjs comment — never leave bare `bunx
   anytxt-opencode` (stale cache).
