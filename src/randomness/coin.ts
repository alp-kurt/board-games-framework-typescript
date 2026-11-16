import { fail } from "../core/errors.js";
import type { IRandomSource } from "../core/random.js";
import { MathRandomSource } from "../core/random.js";
import { ok, type OperationResult } from "../core/result.js";
import type { GameState } from "../core/state.js";

export interface FlipCoinInput {
  /** Probability of heads / true. Default 0.5. */
  probability?: number;
}

export function flipCoin(
  state: GameState,
  input: FlipCoinInput = {},
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, boolean> {
  const p = input.probability ?? 0.5;
  if (p < 0 || p > 1) fail("INVALID_PROBABILITY", "probability must be in [0,1]");
  const heads = random.nextFloat() < p;
  return ok(state, heads, [{ type: "coin.flipped", payload: { heads, probability: p } }]);
}
