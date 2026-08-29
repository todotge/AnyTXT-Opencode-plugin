# Changelog

All notable changes to this project will be documented in this file.

____

## [0.0.5] - 2026-08-29

### Added

- `bunx anytxt-opencode remove [target]`: uninstalls the plugin, skill and
  command from the target (positional path or `OPENCODE_CONFIG_DIR`,
  default `~/.config/opencode`). Deletes only what install created — never
  the `.env`. Skips entries not installed, refuses to run against a
  filesystem root, exits 1 when a removal fails.
- `bunx anytxt-opencode update [target]`: re-runs install (idempotent
  re-copy) — same target resolution as install/remove, keeps existing
  `.env`. Tests: `tests/install.test.ts` (9 cases).

## [0.0.4] - 2026-08-29

### Fixed

- `bunx anytxt-opencode install` installed into `./install/` in the cwd
  instead of the config dir: the `install` subcommand was treated as a
  positional target path. Subcommand now filtered before path resolution;
  positional target and `OPENCODE_CONFIG_DIR` still work. Regression test:
  `tests/install.test.ts`.

## [0.0.3] - 2026-08-29

### Added

- npm distribution: published as `anytxt-opencode` — `bin`
  (`anytxt-opencode` → `bin/install.mjs`), `main`/`exports` → `src/main.ts`,
  `files` (`bin`, `src`, `.opencode`, `skills`, `command`, `.env.example`),
  `repository`, `keywords`. Tarball verified with `npm publish --dry-run`
  (13 files, 33.9 kB unpacked).
- One-command installer: `bunx anytxt-opencode install` copies `src/` to
  `~/.config/opencode/src/`, generates the shim
  `~/.config/opencode/plugins/anytxt.ts`, copies the skill to
  `~/.config/opencode/skills/` and the command to
  `~/.config/opencode/command/`; `.env.example` is copied to `.env` only
  when no `.env` exists (never clobbers user config). Override the target
  with `OPENCODE_CONFIG_DIR` or a positional path. Idempotent.
- Alternative without copies: `"plugin": ["anytxt-opencode"]` in
  `opencode.json` — opencode auto-installs npm plugins with Bun at startup.
- Permission lockdown: each tool raises its own approval ask via
  `ToolContext.ask` (`ANYTXT_ASK=1` default, `0` disables) AND
  `opencode.json` ships explicit `"anytxt_*": "ask"` rules — both halves
  required. Installer never touches the user's `opencode.json`.
- Docs: `docs/user.md` (install, configuration, security, limitations,
  troubleshooting), `docs/dev.md` (structure, testing, RPC reference,
  architecture, release), `LICENSE.md` (MIT), README badges + Install
  section.

### Changed

- README Install: `bunx anytxt-opencode install` primary path, manual copy
  as fallback.

## [0.0.2] - 2026-08-28

### Added

- `verify` argument on `anytxt_search` (default `true`, `ANYTXT_VERIFY`):
  every match re-checked against raw text (`GetRawTextByFID`); false
  positives from ATGUI version tokenization (`1.0.0` ≡ `1.0.1`, measured
  live) and missing proximity excluded and reported; per-file occurrence
  counts; `⚠ stale index` / `⚠ differs from disk` flags via disk mtime +
  content cross-check.
- Proximity window `ANYTXT_NEAR` (default 200 chars) for terms joined by `&`.
- `st` argument on `anytxt_search` (1 exact, 2 advanced); quoted patterns
  auto-switch to exact, fixing punctuation phrases (`"Version: 1.0.0"`).
- `anytxt_sync` honest feedback: disk file count, post-sync probe poll
  (`ANYTXT_SYNC_TIMEOUT`, default 120 s), warning when the folder never
  enters the index (outside ATGUI roots).
- `anytxt_fragment` lie check: `⚠ fragment unverified` when fragments do not
  contain the pattern.
- Config keys `ANYTXT_VERIFY`, `ANYTXT_NEAR`, `ANYTXT_SYNC_TIMEOUT` in
  `.env.example` and `/anytxt-param`.
- `skills/anytxt/SKILL.md` golden rule (binaries → anytxt, text → grep,
  never trust the index right after sync); README Limitations + Development
  sections.
- Tests: `tests/verify.test.ts` (unit) + `tests/probe.test.ts` (e2e,
  skipped when ATGUI is down): 30 tests, 0 fail.

### Changed

- TypeScript restructure, OpenCode shim pattern: logic in `src/`
  (`main.ts`, `verify.ts`, `env.ts`, `errors.ts`, `types.ts`);
  `.opencode/plugins/anytxt.ts` is a one-line shim; `tsc --noEmit` clean.
- Typed RPC envelopes, tool args and context.
- `AnyTxtError` codes (`unreachable` network / `http_error` / `rpc_error`
  logic) — distinguishable failures.
- `.env` read cached (mtime + size + short TTL) instead of readFileSync on
  every tool call.
- Portable package root via `fileURLToPath(new URL("../", import.meta.url))`
  (Node + Bun).
- `anytxt_search` output: `N verified / M indexed match` + per-file
  `— N occ`; `anytxt_sync`/`anytxt_fragment` outputs reworded with real
  feedback.

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
[0.0.2]: https://github.com/todotge/AnyTXT-Opencode-plugin/compare/v0.0.1...v0.0.2
[0.0.3]: https://github.com/todotge/AnyTXT-Opencode-plugin/compare/v0.0.2...v0.0.3
[0.0.4]: https://github.com/todotge/AnyTXT-Opencode-plugin/compare/v0.0.3...v0.0.4
[0.0.5]: https://github.com/todotge/AnyTXT-Opencode-plugin/compare/v0.0.4...v0.0.5
[Unreleased]: https://github.com/todotge/AnyTXT-Opencode-plugin/compare/v0.0.5...HEAD


___

## [Unreleased]

### 0.0.6 — project `opencode.json` wiring

- `install` and `update` also update the target's `opencode.json`: merge
  the AnyTXT permission rules (`"permission": {"anytxt_search": "ask",
  "anytxt_fragment": "ask", "anytxt_sync": "ask"}`) into it — preserve
  existing content, never overwrite, idempotent. Needed for project-local
  installs: without the rules the agent's allow-all default wins silently.
  Global install → `~/.config/opencode/opencode.json`, project-local →
  `<project>/opencode.json`.
- Honest verify degradation (feasibility probed 2026-08-29): `verifyRaw`
  treats wildcards (`*`, `?`) as literal characters today — `version*`
  matches nothing, silently reported `missing`. Fix: detect unsupported
  tokens, add `⚠ verify degraded to literal` flag instead of silent lie.
- Non-indexed extension hint (probed): index skips `.py` (measured),
  `rg` is NOT installed on user machine — grep POSIX `-F` works
  (`grep -cF`, `-ci`). `anytxt_search` will add hint when `filterExt` or
  pattern hits text sources AnyTXT does not index (`.py`, `.js`, …).
- Opt-in grep cross-check `ANYTXT_GREP=1` (probed): on text-extension
  matches run POSIX `grep -oiF` per file (fixed strings — no escaping
  bugs, case-insensitive, occurrence count), append `grep: N occ`. Off by
  default — latency.
- Input validation (probed: current `args as SearchArgs` casts are blind):
  hand-rolled runtime guards for tool args → `AnyTxtError` instead of
  silent cast. CI: GitHub Actions `bun test` + `tsc --noEmit` on push.

### 0.0.7 — OCR

- `anytxt_ocr` tool wrapping `Searcher.V1.OCR`. Probe 2026-08-29: current
  ATGUI build returns `invalid method called` for all OCR method-name
  variants (`Searcher.V1.OCR`, `.Ocr`, `OCR.V1.OCR`,
  `Searcher.V1.GetOCRText`) — this build is the non-OCR edition
  (dev.md: "OCR version only"). Implementation feasible as thin RPC
  wrapper + honest `rpc_error` passthrough, but live verification blocked
  until an OCR-edition ATGUI is available.

___

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
