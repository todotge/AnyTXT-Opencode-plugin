---
name: anytxt
description: "Use when searching or reading file content that ripgrep/grep cannot see — documents indexed by AnyTXT Searcher (anytxt.net): pdf, docx, pptx, xlsx, epub, rtf. Triggers: user asks to search documents/papers/notes/ebooks, find text inside pdfs or office files, or mentions anytxt. Tools: anytxt_search, anytxt_fragment, anytxt_sync."
---

# anytxt — full-text search via AnyTXT Searcher

Use ONLY when the target files are binary formats grep/ripgrep cannot read, or the user explicitly asks for anytxt. ATGUI must be running (API at `http://127.0.0.1:9920`, override with `ANYTXT_URL`). Non-commercial use only.

## Workflow

1. `anytxt_search` with `pattern` → file list with FID, path, size, modtime.
2. `anytxt_fragment` per promising FID → snippets around matches.
3. Quote from fragments. If a match is a plain-text file, open it with the read tool for full content.

## Query syntax

- `&` AND, `|` OR, `!` NOT, `( )` grouping, `"..."` exact phrase
- Example: `patent & (canonical | basis) !draft`
- `filterExt`: `"pdf;docx"` (default `*`). `directory`: restrict to a folder; omit to search all indexed folders.
- `anytxt_sync` a folder when it is not yet in the index.

## Config

- Port/folder/limit/extension defaults come from `.env` (see README), re-read every call.
- `/anytxt-param` changes them at runtime — no restart.

## Limits

- Only files ATGUI has indexed are searchable — if unsure, run `anytxt_sync` first.
- Index updates lag behind disk changes; sync the folder to refresh.
