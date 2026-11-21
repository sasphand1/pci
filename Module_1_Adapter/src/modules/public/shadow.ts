// Pure comparison of the old YouTube ranking with the newly published one. No database imports.
export type Row = { key: string; name: string };
export type Shadow = {
  topN: number; legacyCount: number; newCount: number; overlap: number; overlapPct: number; sameOrder: boolean;
  onlyLegacy: Row[]; onlyNew: Row[]; moved: { key: string; name: string; legacy: number; published: number }[];
};

/** Both lists are in rank order, best first. Positions are 1-based within the first `topN`. */
export function compareRows(legacy: Row[], published: Row[], topN = 15): Shadow {
  const a = legacy.slice(0, topN), b = published.slice(0, topN);
  const ai = new Map(a.map((r, i) => [r.key, i + 1])), bi = new Map(b.map((r, i) => [r.key, i + 1]));
  const both = a.filter(r => bi.has(r.key));
  const moved = both.filter(r => ai.get(r.key) !== bi.get(r.key)).map(r => ({ key: r.key, name: r.name, legacy: ai.get(r.key)!, published: bi.get(r.key)! }));
  const denom = Math.max(a.length, b.length);
  return { topN, legacyCount: a.length, newCount: b.length, overlap: both.length, overlapPct: denom ? Math.round(both.length / denom * 100) : 100,
    sameOrder: moved.length === 0 && a.length === b.length && both.length === a.length,
    onlyLegacy: a.filter(r => !bi.has(r.key)), onlyNew: b.filter(r => !ai.has(r.key)), moved };
}
