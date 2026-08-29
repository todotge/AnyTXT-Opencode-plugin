// verify.ts — truth checks for AnyTXT results.
// The AnyTXT index lies about numbers/versions and ignores proximity;
// raw text (GetRawTextByFID) is the source of truth used here.
// ponytail: literal substring matching only — no regexp engine.

// Split an advanced-syntax pattern into literal terms.
// Supports: & | ! ( ) "quoted phrases". Everything lowercased.
export const splitTerms = (pattern: string): string[] => {
  const terms: string[] = [];
  for (const tok of pattern.match(/"([^"]+)"|[^\s&|!()]+/g) ?? []) {
    const t = tok.replace(/^"|"$/g, "");
    if (t) terms.push(t.toLowerCase());
  }
  return terms;
};

// Terms that must co-occur within a window: first term of each & side.
// ponytail: | and ! get no window check.
export const andPairs = (pattern: string): [string, string][] => {
  const sides = pattern
    .split("&")
    .map((s) => s.replace(/[()]/g, "").trim())
    .filter(Boolean);
  const reps = sides.map((s) => splitTerms(s)[0]).filter((t): t is string => Boolean(t));
  const pairs: [string, string][] = [];
  for (let i = 0; i < reps.length - 1; i++) {
    const a = reps[i];
    const b = reps[i + 1];
    if (a && b) pairs.push([a, b]);
  }
  return pairs;
};

// Markdown/formatting chars are not content — strip before matching so
// `**Version:** 1.0.0` still verifies the phrase `Version: 1.0.0`.
const norm = (s: string) => s.toLowerCase().replace(/[*_`]/g, "");

export const countOcc = (text: string, term: string): number => {
  const t = text.toLowerCase();
  let n = 0;
  let i = 0;
  while ((i = t.indexOf(term, i)) !== -1) {
    n++;
    i += Math.max(term.length, 1);
  }
  return n;
};

const positions = (text: string, term: string): number[] => {
  const out: number[] = [];
  let i = 0;
  while ((i = text.indexOf(term, i)) !== -1) {
    out.push(i);
    i += Math.max(term.length, 1);
  }
  return out;
};

// Min distance between an occurrence of a and an occurrence of b (chars).
const minDist = (text: string, a: string, b: string): number => {
  let best = Infinity;
  for (const pa of positions(text, a)) {
    for (const pb of positions(text, b)) {
      const d = Math.max(0, Math.abs(pb - pa) - a.length);
      if (d < best) best = d;
    }
  }
  return best;
};

// Split on an operator at paren-depth 0.
const splitTop = (pattern: string, op: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of pattern) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === op && depth === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
};

// Terms required present / required absent within one OR group.
const parseGroup = (g: string): { terms: string[]; nots: string[] } => {
  const terms: string[] = [];
  const nots: string[] = [];
  let neg = false;
  for (const tok of g.match(/"([^"]+)"|&|\||!|\(|\)|[^\s&|!()]+/g) ?? []) {
    if (tok === "!") {
      neg = true;
      continue;
    }
    if (["&", "|", "(", ")"].includes(tok)) continue;
    const t = tok.replace(/^"|"$/g, "").toLowerCase();
    if (!t) continue;
    (neg ? nots : terms).push(t);
    neg = false;
  }
  return { terms, nots };
};

export type VerifyResult = { ok: boolean; counts: Record<string, number>; note: string };

// verify(raw, pattern, { exact, near }) → { ok, counts, note }
export const verifyRaw = (
  raw: string,
  pattern: string,
  { exact = false, near = 200 }: { exact?: boolean; near?: number } = {},
): VerifyResult => {
  if (!raw) return { ok: false, counts: {}, note: "no raw text" };
  const key = pattern.toLowerCase();
  const text = norm(raw);
  if (exact) {
    const c = countOcc(text, key);
    return c
      ? { ok: true, counts: { [key]: c }, note: "ok" }
      : { ok: false, counts: { [key]: 0 }, note: `missing "${key}"` };
  }
  let best: VerifyResult = { ok: false, counts: {}, note: "no group matched" };
  for (const g of splitTop(pattern, "|")) {
    const { terms, nots } = parseGroup(g);
    const counts: Record<string, number> = {};
    let ok = true;
    let note = "";
    for (const t of terms) {
      counts[t] = countOcc(text, t);
      if (!counts[t]) {
        ok = false;
        note = `missing "${t}"`;
        break;
      }
    }
    if (ok) {
      for (const t of nots) {
        if (countOcc(text, t) > 0) {
          ok = false;
          note = `excluded term "${t}" present`;
          break;
        }
      }
    }
    if (ok) {
      for (const [a, b] of andPairs(g)) {
        const d = minDist(text, a, b);
        if (d > near) {
          ok = false;
          note = `"${a}" and "${b}" ${d} chars apart (>${near})`;
          break;
        }
      }
    }
    if (ok) return { ok: true, counts, note: "ok" };
    if (note) best = { ok: false, counts, note };
  }
  return best;
};
