import { fail } from "../core/errors.js";
import type { PlayerId, TrackId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import { getMeta, setMeta, type GameState } from "../core/state.js";

export interface TrackMilestone {
  at: number;
  id: string;
  unlock?: string;
  incomeBonus?: Record<string, number>;
}

export interface ProgressTrack {
  id: TrackId;
  max: number;
  positions: Record<PlayerId, number>;
  milestones: TrackMilestone[];
  triggered: Record<PlayerId, string[]>;
}

const TRACKS_KEY = "progressTracks";

export function defineTrack(
  state: GameState,
  track: Omit<ProgressTrack, "positions" | "triggered"> & {
    playerIds: PlayerId[];
  },
): GameState {
  const positions: Record<PlayerId, number> = {};
  const triggered: Record<PlayerId, string[]> = {};
  for (const p of track.playerIds) {
    positions[p] = 0;
    triggered[p] = [];
  }
  const tracks = getMeta<Record<TrackId, ProgressTrack>>(state, TRACKS_KEY, {});
  const { playerIds: _, ...rest } = track;
  return setMeta(state, TRACKS_KEY, {
    ...tracks,
    [track.id]: { ...rest, positions, triggered },
  });
}

export function advanceTrack(
  state: GameState,
  input: {
    trackId: TrackId;
    playerId: PlayerId;
    steps: number;
  },
): OperationResult<
  GameState,
  { position: number; newlyTriggered: TrackMilestone[] }
> {
  const tracks = { ...getMeta<Record<TrackId, ProgressTrack>>(state, TRACKS_KEY, {}) };
  const track = tracks[input.trackId];
  if (!track) fail("TRACK_MISSING", `Track ${input.trackId} not found`);
  const prev = track.positions[input.playerId] ?? 0;
  const position = Math.min(track.max, prev + input.steps);
  const already = new Set(track.triggered[input.playerId] ?? []);
  const newlyTriggered = track.milestones.filter(
    (m) => m.at > prev && m.at <= position && !already.has(m.id),
  );
  const triggered = {
    ...track.triggered,
    [input.playerId]: [
      ...(track.triggered[input.playerId] ?? []),
      ...newlyTriggered.map((m) => m.id),
    ],
  };
  tracks[input.trackId] = {
    ...track,
    positions: { ...track.positions, [input.playerId]: position },
    triggered,
  };
  return ok(
    setMeta(state, TRACKS_KEY, tracks),
    { position, newlyTriggered },
    [
      {
        type: "track.advanced",
        payload: {
          trackId: input.trackId,
          playerId: input.playerId,
          position,
          newlyTriggered: newlyTriggered.map((m) => m.id),
        },
      },
    ],
  );
}
