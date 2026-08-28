# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.0.1]: https://github.com/luke/AnyTXT-Opencode-skill/releases/tag/v0.0.1
