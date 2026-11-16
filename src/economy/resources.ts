import { fail } from "../core/errors.js";
import type { PlayerId, ResourceId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import type { GameState } from "../core/state.js";

export interface ModifyResourceInput {
  playerId: PlayerId;
  resourceId: ResourceId;
  delta: number;
  min?: number;
  max?: number;
}

export function modifyResource(
  state: GameState,
  input: ModifyResourceInput,
): OperationResult<GameState, number> {
  if (!state.players.includes(input.playerId) && !(input.playerId in state.resources)) {
    // allow unknown players that already have a ledger, else fail soft by creating
  }
  const ledger = { ...(state.resources[input.playerId] ?? {}) };
  const current = ledger[input.resourceId] ?? 0;
  let nextVal = current + input.delta;
  if (input.min !== undefined) nextVal = Math.max(input.min, nextVal);
  if (input.max !== undefined) nextVal = Math.min(input.max, nextVal);
  if (nextVal < (input.min ?? -Infinity)) {
    fail("RESOURCE_CLAMP", "result below min");
  }
  ledger[input.resourceId] = nextVal;
  const next: GameState = {
    ...state,
    resources: { ...state.resources, [input.playerId]: ledger },
  };
  return ok(next, nextVal, [
    {
      type: "resource.modified",
      payload: {
        playerId: input.playerId,
        resourceId: input.resourceId,
        delta: input.delta,
        value: nextVal,
      },
    },
  ]);
}

export function getResource(
  state: GameState,
  playerId: PlayerId,
  resourceId: ResourceId,
): number {
  return state.resources[playerId]?.[resourceId] ?? 0;
}
