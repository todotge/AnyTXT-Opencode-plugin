# AnyTXT for OpenCode


![version](https://img.shields.io/badge/version-0.0.4-blue)
![npm](https://img.shields.io/npm/v/anytxt-opencode.svg?logo=nodedotjs)
![license](https://img.shields.io/badge/license-MIT-green)
[![Ko-fi](https://img.shields.io/badge/support-Ko--fi-ff5e5b)](https://ko-fi.com/gianlucagernone)

Plugin + skill for OpenCode: full-text search over files indexed by
[AnyTXT Searcher](https://anytxt.net/) — PDF, DOCX, PPTX, XLSX, EPUB, RTF and
other formats `grep`/`ripgrep` cannot read.

Uses the local JSON-RPC 2.0 API inside the ATGUI process
(`http://127.0.0.1:9920`). **Non-commercial use only.** ATGUI must be running.

## What it provides

**Plugin** (`src/main.ts`, TypeScript — loaded via the
`.opencode/plugins/anytxt.ts` shim) — three agent-callable tools:

| Tool | RPC method | Purpose |
| --- | --- | --- |
| `anytxt_search` | `Searcher.V1.GetResult` | Files matching a pattern, verified against raw text, with per-file occurrence counts |
| `anytxt_fragment` | `Searcher.V1.GetFragmentAll` | Snippets around matches in one file, by FID |
| `anytxt_sync` | `Searcher.V1.SyncIndex` | Add/refresh a folder in the index, with honest post-sync feedback |

**Skill** (`skills/anytxt/SKILL.md`) — tells the agent when to prefer anytxt
over ripgrep (binary documents), the query syntax, and the golden rule.

**Command** (`/anytxt-param`) — change settings at runtime, no restart.

## Install

```sh
bunx anytxt-opencode install
```

One command: copies the sources, generates the shim, installs skill and
command into `~/.config/opencode/`. Idempotent, never clobbers your `.env`.
Then restart OpenCode.

Alternative: `"plugin": ["anytxt-opencode"]` in `opencode.json` (auto-install
at startup). Full details, manual install and prerequisites:
[docs/user.md](docs/user.md).

## Quick usage

```text
Search my notes for "hello world"               → anytxt_search
Give me the context around that match           → anytxt_fragment
Index a new folder first                        → anytxt_sync
```

Query syntax: `&` AND, `|` OR, `!` NOT, `( )` grouping, `"..."` exact
phrase. `verify` (default on) drops index false positives and reports
occurrences per file. Golden rule: **anytxt for binaries, grep for text** —
versions, punctuation phrases and source code → grep.

## Docs

- [User guide](docs/user.md) — install, configuration, security, limitations, troubleshooting
- [Developer guide](docs/dev.md) — structure, testing, RPC reference, release process
- [Changelog](CHANGELOG.md) — Keep a Changelog format

## License

[MIT](LICENSE.md)
