// Pure comparison of a draft against the live ranking, for the review screen.
export type Slotted = { personId: string; slot: number; value: number };
export type Moved = { personId: string; from: number; to: number; delta: number };
export type RankDiff = { entered: { personId: string; to: number }[]; left: { personId: string; from: number }[]; moved: Moved[]; valueChanged: number; unchanged: number };

export function diffRankings(live: Slotted[] | null, draft: Slotted[]): RankDiff {
  const liveBy = new Map((live ?? []).map(e => [e.personId, e]));
  const draftBy = new Map(draft.map(e => [e.personId, e]));
  const entered = draft.filter(e => !liveBy.has(e.personId)).map(e => ({ personId: e.personId, to: e.slot }));
  const left = (live ?? []).filter(e => !draftBy.has(e.personId)).map(e => ({ personId: e.personId, from: e.slot }));
  const moved: Moved[] = []; let valueChanged = 0, unchanged = 0;
  for (const e of draft) {
    const l = liveBy.get(e.personId); if (!l) continue;
    if (l.value !== e.value) valueChanged++;
    if (l.slot !== e.slot) moved.push({ personId: e.personId, from: l.slot, to: e.slot, delta: l.slot - e.slot }); else if (l.value === e.value) unchanged++;
  }
  moved.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || (a.personId < b.personId ? -1 : 1));
  entered.sort((a, b) => a.to - b.to); left.sort((a, b) => a.from - b.from);
  return { entered, left, moved, valueChanged, unchanged };
}
