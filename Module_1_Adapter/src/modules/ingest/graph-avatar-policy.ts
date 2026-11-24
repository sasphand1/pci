/** Database-backed limits shared by manual and scheduled official Meta avatar fills. */
export const GRAPH_AVATAR_RUN_LIMIT = 5;
export const GRAPH_AVATAR_REFRESH_GAP_MINUTES = 60;
export const GRAPH_AVATAR_LIMIT_GAP_MINUTES = 360;
export const GRAPH_AVATAR_ACCOUNT_RETRY_HOURS = 24;

export type GraphAvatarGate = {
  last_refresh: string | Date | null;
  last_graph: string | Date | null;
  last_limited: string | Date | null;
};

export function graphAvatarNextAllowedAt(gate: GraphAvatarGate, nowMs: number): string | null {
  const deadlines: number[] = [];
  for (const [value, minutes] of [
    [gate.last_refresh, GRAPH_AVATAR_REFRESH_GAP_MINUTES],
    [gate.last_graph, GRAPH_AVATAR_REFRESH_GAP_MINUTES],
    [gate.last_limited, GRAPH_AVATAR_LIMIT_GAP_MINUTES],
  ] as const) {
    if (!value) continue;
    const timestamp = new Date(value).getTime();
    if (Number.isFinite(timestamp) && timestamp <= nowMs) deadlines.push(timestamp + minutes * 60_000);
  }
  const until = Math.max(0, ...deadlines);
  return until > nowMs ? new Date(until).toISOString() : null;
}
