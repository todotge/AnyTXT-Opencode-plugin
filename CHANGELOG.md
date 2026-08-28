# Changelog

All notable changes to this project will be documented in this file.

____

## [0.0.1] - 2026-08-28

### Added

- OpenCode plugin (`plugins/anytxt.mjs`) exposing three agent tools over the
  AnyTXT Searcher JSON-RPC 2.0 API (ATGUI): `anytxt_search`, `anytxt_fragment`,
  `anytxt_sync`.
- Port fallback: tries `http://127.0.0.1:9920` then `:9921` on every call;
  overridable with `ANYTXT_URL` or `ANYTXT_PORT`.
- `.env` configuration (`ANYTXT_PORT`, `ANYTXT_URL`, `ANYTXT_DIR`,
  `ANYTXT_LIMIT`, `ANYTXT_FILTER_EXT`, `ANYTXT_ORDER`), re-read on every tool
  call. Project `.env` wins; the global `~/.config/opencode/.env` is used only
  when the project has none.
- `/anytxt-param` command (`command/anytxt-param.md`) to change settings at
  runtime without restart.
- Skill (`skills/anytxt/SKILL.md`) steering the agent toward AnyTXT for binary
  documents grep/ripgrep cannot read.
- `.env.example` template.

### Changed

- Removed unused default export; simplified file-result formatting.

[0.0.1]: https://github.com/todotge/AnyTXT-Opencode-plugin/releases/tag/v0.0.1
[Unreleased]: https://github.com/todotge/AnyTXT-Opencode-plugin/compare/v0.0.1...HEAD

___

## [Unreleased]

### 0.0.2 — Truthful index (bug fixes + verification)

Evidence collected against a live ATGUI instance (2026-08-28, local probe
folder, cross-checked with ripgrep on disk):

- Version tokenization is broken: `1.0.0` matches files containing only
  `1.0.1` and vice versa (search AND fragments).
- Exact phrase with punctuation fails: `"Version: 1.0.0"` → 0 results, but
  `st=1` (exact match) on the unquoted string works.
- `A & B` has no proximity: matches files where the terms are pages apart.
- False positives confirmed on disk: matched files with 0 real occurrences
  (node_modules `HISTORY.md` / `CHANGELOG.md`).
- `.py` and other source files are not indexed at all (`filterExt=py` → 0).
- `SyncIndex` returns `{}`: no feedback; indexing is async (~45 s); folders
  outside indexed roots (e.g. `/tmp`) are silently ignored.
- `GetRawTextByFID` works and returns plain text → plugin-side verification
  primitive. `Search` returns the total match count (no pagination).
- `st=4` (regexp) is not supported over RPC (always 0). Orders 3/4 sort by
  `filterDir` ASC/DESC. No filename filter exists over RPC.

(planned — this release is not cut yet):

1. `plugins/anytxt.mjs` — `anytxt_search` verification:
   - New `verify` argument (default `true`).
   - For every matched FID call `GetRawTextByFID`, count real occurrences of
     the pattern (literal match; split `&`/`|`/`!` into per-term checks).
   - Exclude files with 0 real occurrences (false positives); report the
     excluded count.
   - Proximity: for `A & B` require co-occurrence within a window
     (`ANYTXT_NEAR`, default 200 chars) in the raw text.
   - Per-file output: `path — N occurrences`; binaries reported as
     `unverified` when raw text is unavailable.
   - For text files on disk: compare disk mtime vs indexed `lastModify` and
     warn `⚠ stale index`; cross-check with `rg --fixed-strings`.
2. Punctuation phrases: strip surrounding quotes, send `st: "1"` (exact).
   Expose `st` as a manual argument (1/2 only; 4 is not supported over RPC).
3. `anytxt_sync` honest feedback:
   - `existsSync` check before calling.
   - After `SyncIndex`, poll `Search` with a probe word taken from the first
     readable text file on disk; timeout `ANYTXT_SYNC_TIMEOUT` (default
     120 s).
   - Report: files on disk / "indexed after Xs (probe found)" / warning
     "not in index yet — folder may be outside indexed roots".
4. `anytxt_fragment`: verify each fragment contains the pattern (normalized);
   otherwise flag `⚠ fragment unverified (index lies for numbers/versions)`.
5. Config: `ANYTXT_VERIFY`, `ANYTXT_NEAR`, `ANYTXT_SYNC_TIMEOUT` in
   `.env.example` and `command/anytxt-param.md`.
6. `skills/anytxt/SKILL.md`: golden rule — anytxt for binaries, grep for
   text, never trust the index right after sync; versions/punctuation/source
   code → grep; `.py` and source files are outside the AnyTXT index.
7. `README.md`: Limitations section documenting the bugs above; extend the
   `ANYTXT_ORDER` table with 3/4 (`filterDir` ASC/DESC).
8. Tests: `tests/probe.mjs` (run with `bun test`) end-to-end against local
   ATGUI, skipped when the port is down. Fixtures: versioned files, a
   punctuation phrase, a far-apart AND, a `.py` file. Asserts: version
   tokenization, `st=1` punctuation, proximity filter, raw-text verification,
   sync polling.

### 0.0.3 — Simple install (distribution)


- Publish to npm as `anytxt-opencode`:
  - `package.json`: `bin` (`anytxt-opencode` → `bin/install.mjs`),
    `main`/`exports` → `plugins/anytxt.mjs`, `files`
    (`bin`, `plugins`, `skills`, `command`, `.env.example`), `repository`,
    `keywords`, version 0.0.3.
  - Verify the tarball with `npm publish --dry-run`.
- Install with one command, no checkout needed:
  `bunx anytxt-opencode install` copies the plugin to
  `~/.config/opencode/plugins/`, the skill to `~/.config/opencode/skills/`,
  the command to `~/.config/opencode/command/`; `.env.example` is copied to
  `.env` only when no `.env` exists (never clobbers user config). Override
  the target with `OPENCODE_CONFIG_DIR` or a positional path. Idempotent.
- Alternative without copies: `"plugin": ["anytxt-opencode"]` in
  `opencode.json` — opencode auto-installs npm plugins with Bun at startup
  (cache `~/.cache/opencode/node_modules/`). Source: opencode.ai/docs/plugins
  (checked 2026-08-28).
- Skill + command alternative: serve via `skills.urls` from a hosted
  `.well-known/skills/` list (optional).
- Update `README.md` Install section: `bunx anytxt-opencode install` as the
  primary path; keep manual copy as fallback.
- Tag `v0.0.3`, publish the release, bump 0.0.1 → 0.0.3.

___

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
