import { fail } from "../core/errors.js";
import type { PlayerId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import type { GameState } from "../core/state.js";

export interface AreaControlResult {
  regionId: string;
  ranking: Array<{ playerId: PlayerId; influence: number; place: number }>;
  controller?: PlayerId;
}

export function calculateAreaControl(
  state: GameState,
  regionId: string,
): OperationResult<GameState, AreaControlResult> {
  if (!state.board) fail("BOARD_MISSING", "GameState.board is required");
  const cell = state.board.cells[regionId];
  if (!cell) fail("REGION_MISSING", `Region ${regionId} not found`);

  const influence = { ...(cell.influence ?? {}) };
  // also count occupants owned by players
  for (const eid of cell.occupants) {
    const owner = state.entities[eid]?.owner;
    if (owner) influence[owner] = (influence[owner] ?? 0) + 1;
  }

  const ranking = Object.entries(influence)
    .map(([playerId, inf]) => ({ playerId, influence: inf }))
    .sort((a, b) => b.influence - a.influence)
    .map((row, idx) => ({ ...row, place: idx + 1 }));

  const value: AreaControlResult = {
    regionId,
    ranking,
    controller: ranking[0]?.influence ? ranking[0].playerId : undefined,
  };
  return ok(state, value, [{ type: "board.areaControl", payload: value }]);
}
