# AnyTXT for OpenCode

Plugin + skill that give OpenCode full-text search over files indexed by
[AnyTXT Searcher](https://anytxt.net/) — PDF, DOCX, PPTX, XLSX, EPUB, RTF and
other formats `grep`/`ripgrep` cannot read.

Uses the local JSON-RPC 2.0 API hosted inside the ATGUI process
(`http://127.0.0.1:9920`). **Non-commercial use only.** ATGUI must be running.

## What it provides

**Plugin** (`plugins/anytxt.mjs`) — three agent-callable tools:

| Tool | RPC method | Purpose |
| --- | --- | --- |
| `anytxt_search` | `Searcher.V1.GetResult` | List files matching a pattern (FID, path, size, modtime) |
| `anytxt_fragment` | `Searcher.V1.GetFragmentAll` | Snippets around matches in one file, by FID |
| `anytxt_sync` | `Searcher.V1.SyncIndex` | Add/refresh a folder in the index |

**Skill** (`skills/anytxt/SKILL.md`) — tells the agent when to prefer anytxt
over ripgrep (binary documents), the query syntax, and the search →
fragment workflow.

## Install

Copy into the OpenCode global config:

```sh
# from a checkout of this repo
mkdir -p ~/.config/opencode/plugins ~/.config/opencode/skills ~/.config/opencode/command
cp plugins/anytxt.mjs ~/.config/opencode/plugins/
cp -r skills/anytxt ~/.config/opencode/skills/
cp command/anytxt-param.md ~/.config/opencode/command/
cp .env.example ~/.config/opencode/.env  # optional, see Configuration
```

`@opencode-ai/plugin` must be resolvable from the config directory — add it
to `~/.config/opencode/package.json` and run `bun install` if missing.

Register the plugin in `~/.config/opencode/opencode.json` (the plugin
directory is not scanned automatically in current builds):

```json
"plugin": ["./plugins/anytxt.mjs"]
```

Restart OpenCode.

## Configuration

All settings optional, read from the project `.env` (the session's cwd) on
every tool call — process env vars win, no restart needed. When the project
has no `.env`, the global `~/.config/opencode/.env` is used instead.
See `.env.example`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANYTXT_PORT` | try 9920, then 9921 | ATGUI port |
| `ANYTXT_URL` | — | full URL override (beats PORT) |
| `ANYTXT_DIR` | everywhere | default search folder |
| `ANYTXT_LIMIT` | 5 | results per request |
| `ANYTXT_FILTER_EXT` | `*` | extension filter, e.g. `pdf;docx` |
| `ANYTXT_ORDER` | 0 | 0 default, 1 modtime ASC, 2 DESC |

Change settings at runtime with `/anytxt-param` (updates the `.env`).

## Usage

```text
Search my notes for "hello world"               → anytxt_search
Give me the context around that match           → anytxt_fragment
Index a new folder first                        → anytxt_sync
```

Query syntax: `&` AND, `|` OR, `!` NOT, `( )` grouping, `"..."` exact phrase.

Example: `signed & (agreement | contract) !draft`

## Notes

- Only files ATGUI has indexed are searchable — `anytxt_sync` first if unsure.
- The live API response shape differs from the published docs
  (`result.data.output` with tuple `files` + `field` header); the plugin
  handles both.
