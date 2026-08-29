// env.ts — .env parsing with a short cache.
// ponytail: statSync per call (cheap) + read only when mtime changed; TTL as
// a hard re-read floor. Keeps /anytxt-param edits instant without re-reading
// the file on every concurrent tool call.
import { existsSync, readFileSync, statSync } from "node:fs";

export type Env = Record<string, string>;

type Entry = { mtimeNs: bigint; size: number; at: number; data: Env };

const cache = new Map<string, Entry>();

const parse = (text: string): Env => {
  const out: Env = {};
  for (const line of text.split("\n")) {
    const i = line.indexOf("=");
    if (i < 1 || line.slice(0, i).trimStart().startsWith("#")) continue;
    const v = line.slice(i + 1).trim().replace(/^"|"$/g, "");
    if (v === "") continue;
    out[line.slice(0, i).trim()] = v;
  }
  return out;
};

// Cached .env reader. ttlMs: minimum age before an unconditional re-read.
export const cachedEnv = (path: string, ttlMs = 1000): Env => {
  if (!existsSync(path)) return {};
  const now = Date.now();
  const entry = cache.get(path);
  let mtimeNs = 0n;
  let size = 0;
  try {
    const s = statSync(path, { bigint: true });
    mtimeNs = s.mtimeNs;
    size = Number(s.size);
  } catch {
    // gone mid-call — treat as missing
    cache.delete(path);
    return {};
  }
  if (entry && entry.mtimeNs === mtimeNs && entry.size === size && now - entry.at < ttlMs)
    return entry.data;
  let data: Env = {};
  try {
    data = parse(readFileSync(path, "utf8"));
  } catch {
    // unreadable — keep last known or empty
    data = entry?.data ?? {};
  }
  cache.set(path, { mtimeNs, size, at: now, data });
  return data;
};
