import { fail } from "../core/errors.js";
import type { IRandomSource } from "../core/random.js";
import { MathRandomSource } from "../core/random.js";
import { ok, type OperationResult } from "../core/result.js";
import type { GameState } from "../core/state.js";

export interface WheelSegment<T = string> {
  outcome: T;
  weight: number;
}

export interface SpinWheelInput<T = string> {
  segments: WheelSegment<T>[];
}

export function spinWheel<T = string>(
  state: GameState,
  input: SpinWheelInput<T>,
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, T> {
  if (input.segments.length === 0) fail("EMPTY_WHEEL", "segments required");
  const total = input.segments.reduce((s, seg) => s + seg.weight, 0);
  if (total <= 0) fail("INVALID_WEIGHTS", "total weight must be > 0");

  let r = random.nextFloat() * total;
  for (const seg of input.segments) {
    r -= seg.weight;
    if (r < 0) {
      return ok(state, seg.outcome, [
        { type: "wheel.spun", payload: { outcome: seg.outcome } },
      ]);
    }
  }
  const last = input.segments[input.segments.length - 1]!;
  return ok(state, last.outcome, [
    { type: "wheel.spun", payload: { outcome: last.outcome } },
  ]);
}
