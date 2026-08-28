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
mkdir -p ~/.config/opencode/plugins ~/.config/opencode/skills
cp plugins/anytxt.mjs ~/.config/opencode/plugins/
cp -r skills/anytxt ~/.config/opencode/skills/

# optional, only needed if @opencode-ai/plugin is not already installed
cd ~/.config/opencode && bun install
```

Restart OpenCode. Plugin files in the plugin directory and skills under
`skills/` are discovered automatically — no `opencode.json` edit needed.

## Configuration

- `ANYTXT_URL` — API endpoint override (default `http://127.0.0.1:9920`).

## Usage

```text
Search my notes for "canonical basis"           → anytxt_search
Give me the context around that match           → anytxt_fragment
Index a new folder first                        → anytxt_sync
```

Query syntax: `&` AND, `|` OR, `!` NOT, `( )` grouping, `"..."` exact phrase.

Example: `patent & (canonical | basis) !draft`

## Notes

- Only files ATGUI has indexed are searchable — `anytxt_sync` first if unsure.
- The live API response shape differs from the published docs
  (`result.data.output` with tuple `files` + `field` header); the plugin
  handles both.
