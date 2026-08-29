# AnyTXT for OpenCode — User Guide

End-user documentation for the AnyTXT plugin + skill. Requires
[AnyTXT Searcher](https://anytxt.net/) running locally (**non-commercial use
only** — the RPC API must not be used commercially).

## Install

Prerequisites: OpenCode, [Bun](https://bun.sh) (for `bunx`), ATGUI running.

### One command (recommended, after npm publish)

```sh
bunx anytxt-opencode@0.0.5 install
```

Copies `src/` → `~/.config/opencode/src/`, writes the one-line shim
`~/.config/opencode/plugins/anytxt.ts`, the skill to
`~/.config/opencode/skills/anytxt/`, the command to
`~/.config/opencode/command/anytxt-param.md`. `.env.example` → `.env` only
when no `.env` exists (never clobbers user config). Idempotent. Override the
target with `OPENCODE_CONFIG_DIR` or a positional path.

### Project-local install

```sh
cd your-project
bunx anytxt-opencode@0.0.5 install .opencode
```

Everything lands in the project's `.opencode/` (`.opencode/src/`,
`.opencode/plugins/anytxt.ts`, skills, command) — scoped to this project
only, nothing in the global config. Same shim path works for both targets.

### Update

```sh
bunx anytxt-opencode@0.0.5 update            # global
bunx anytxt-opencode@0.0.5 update .opencode  # project-local
```

Same as install (idempotent re-copy), never clobbers `.env`. Use it after a
new `anytxt-opencode` release.

### Uninstall

```sh
bunx anytxt-opencode@0.0.5 remove            # global
bunx anytxt-opencode@0.0.5 remove .opencode  # project-local
```

Removes exactly what install created (`src/`, `plugins/anytxt.ts`,
`skills/anytxt/`, `command/anytxt-param.md`). Never touches `.env`. Skips
entries that are not installed; exits 1 on removal errors.

### Alternative: npm plugin entry (no copies)

```json
{ "plugin": ["anytxt-opencode"] }
```

OpenCode auto-installs npm plugins with Bun at startup (cache
`~/.cache/opencode/node_modules/`). The skill and command still need a
manual copy from the repo.

### Manual (from a repo checkout)

```sh
mkdir -p ~/.config/opencode/plugins ~/.config/opencode/skills ~/.config/opencode/command
cp -r src ~/.config/opencode/
cp -r skills/anytxt ~/.config/opencode/skills/
cp command/anytxt-param.md ~/.config/opencode/command/
printf 'export { AnyTxtPlugin } from "../src/main.ts";\n' > ~/.config/opencode/plugins/anytxt.ts
cp .env.example ~/.config/opencode/.env  # optional
```

`@opencode-ai/plugin` must be resolvable from the config directory — add it
to `~/.config/opencode/package.json` and run `bun install` if missing.

Restart OpenCode after any install.

## Configuration

All settings optional. Read from the project `.env` (session cwd) on every
tool call, cached with a short TTL — process env vars win, no restart
needed. When the project has no `.env`, the global `~/.config/opencode/.env`
is used.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANYTXT_PORT` | try 9920, then 9921 | ATGUI port |
| `ANYTXT_URL` | — | full URL override (beats PORT) |
| `ANYTXT_DIR` | everywhere | default search folder |
| `ANYTXT_LIMIT` | 5 | results per request |
| `ANYTXT_FILTER_EXT` | `*` | extension filter, e.g. `pdf;docx` |
| `ANYTXT_ORDER` | 0 | 0 default, 1 modtime ASC, 2 DESC, 3 filterDir ASC, 4 filterDir DESC |
| `ANYTXT_VERIFY` | 1 | 0 disables post-match verification (index false positives pass through) |
| `ANYTXT_NEAR` | 200 | max chars between terms joined by `&` (proximity) |
| `ANYTXT_SYNC_TIMEOUT` | 120 | seconds to wait for the index after a sync |
| `ANYTXT_ASK` | 1 | ask approval before each tool call (0 disables) |

Change settings at runtime with `/anytxt-param` (updates the `.env`).

## Usage

```text
Search my notes for "hello world"               → anytxt_search
Give me the context around that match           → anytxt_fragment
Index a new folder first                        → anytxt_sync
```

Query syntax: `&` AND, `|` OR, `!` NOT, `( )` grouping, `"..."` exact phrase.

Example: `signed & (agreement | contract) !draft`

- `verify` (default on) re-checks every match against raw text
  (`GetRawTextByFID`), drops false positives and reports occurrences per
  file: `3 verified / 4 indexed match`.
- `st: 1` = exact, `2` = advanced (default). Quoted patterns auto-switch to
  exact, punctuation included (`"Version: 1.0.0"` works). `4` (regexp) is
  not supported over RPC.
- `anytxt_sync` reports files on disk and confirms indexing with a probe
  word, or warns when the folder never enters the index.

## Security

Approval before every call needs **both** halves (verified on opencode
v1.17.18, 2026-08-28):

1. The plugin raises its own ask via the official `ToolContext.ask` API
   (`ANYTXT_ASK=1` default, `0` disables).
2. The config rule decides — with no matching rule the agent's default
   allow-all wins silently, so add explicit rules to `opencode.json` (this
   repo ships them):

```json
"permission": {
  "anytxt_search": "ask",
  "anytxt_fragment": "ask",
  "anytxt_sync": "ask"
}
```

Restart OpenCode to apply. Add the same block to
`~/.config/opencode/opencode.json` for a global lockdown.

## Golden rule

anytxt for **binaries** (pdf/docx/xlsx/epub/rtf), grep/ripgrep for **text**.
Never trust the index right after a sync. Versions/numbers, punctuation
phrases and source code → grep.

## Limitations (measured against a live ATGUI, 2026-08-28)

- Version numbers are tokenized badly: `1.0.0` and `1.0.1` match the same
  files. The `verify` step catches this via raw text; grep is the final word.
- `&` has no proximity: terms pages apart still match. `ANYTXT_NEAR` filters.
- Exact phrases with punctuation fail unless exact mode is used.
- Source files (`.py`, `.js`, …) are not indexed at all — use grep/ripgrep.
- `SyncIndex` returns no feedback and indexing is async (~45 s); folders
  outside ATGUI's indexed roots (e.g. `/tmp`) are silently ignored.
- The index can be stale after edits — cross-check text files with grep.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `anytxt[unreachable]` | ATGUI not running — start it (API on port 9920/9921) |
| `anytxt[rpc_error]` | bad query — simplify syntax, check `st` value |
| sync says `not in index` | folder outside ATGUI indexed roots; add it in ATGUI settings |
| 0 results for a known file | run `anytxt_sync` on the folder first |
| no approval prompt | check `ANYTXT_ASK` + the `permission` rules (see Security) |
