import { fail } from "../core/errors.js";
import type { PlayerId, ResourceId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import type { GameState } from "../core/state.js";
import { getResource, modifyResource } from "./resources.js";

export interface RecipeIO {
  resourceId: ResourceId;
  amount: number;
}

export interface ExecuteRecipeInput {
  playerId: PlayerId;
  inputs: RecipeIO[];
  outputs: RecipeIO[];
}

export function executeRecipe(
  state: GameState,
  input: ExecuteRecipeInput,
): OperationResult<GameState, void> {
  for (const req of input.inputs) {
    if (getResource(state, input.playerId, req.resourceId) < req.amount) {
      fail(
        "INSUFFICIENT_RESOURCES",
        `Need ${req.amount} ${req.resourceId}`,
      );
    }
  }
  let next = state;
  for (const req of input.inputs) {
    next = modifyResource(next, {
      playerId: input.playerId,
      resourceId: req.resourceId,
      delta: -req.amount,
      min: 0,
    }).state;
  }
  for (const out of input.outputs) {
    next = modifyResource(next, {
      playerId: input.playerId,
      resourceId: out.resourceId,
      delta: out.amount,
      min: 0,
    }).state;
  }
  return ok(next, undefined, [
    {
      type: "recipe.executed",
      payload: {
        playerId: input.playerId,
        inputs: input.inputs,
        outputs: input.outputs,
      },
    },
  ]);
}
