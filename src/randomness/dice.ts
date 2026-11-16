import { fail } from "../core/errors.js";
import type { IRandomSource } from "../core/random.js";
import { MathRandomSource } from "../core/random.js";
import { ok, type OperationResult } from "../core/result.js";
import type { GameState } from "../core/state.js";

export type StandardSides = 4 | 6 | 8 | 10 | 12 | 20 | 100;

export interface IRerollPolicy {
  /** Return true to add another roll (e.g. explode on max). */
  shouldReroll(face: number | string, rollIndex: number): boolean;
  /** Cap on extra rolls to prevent infinite explode. */
  maxExtraRolls?: number;
}

export interface RollDiceInput {
  count: number;
  sides?: StandardSides;
  customFaces?: Array<number | string>;
  dropLowest?: number;
  keepHighest?: number;
  rerollPolicy?: IRerollPolicy;
}

export interface DiceRollResult {
  rolls: Array<number | string>;
  kept: Array<number | string>;
  numericTotal: number;
}

export function explodeOnMax(sides: number): IRerollPolicy {
  return {
    shouldReroll: (face) => face === sides,
    maxExtraRolls: 20,
  };
}

function faceToNumber(face: number | string): number {
  return typeof face === "number" ? face : 0;
}

export function rollDice(
  state: GameState,
  input: RollDiceInput,
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, DiceRollResult> {
  if (input.count < 1) fail("INVALID_DICE_COUNT", "count must be >= 1");

  const faces: Array<number | string> =
    input.customFaces ??
    Array.from({ length: input.sides ?? 6 }, (_, i) => i + 1);

  if (faces.length < 1) fail("INVALID_FACES", "dice must have at least one face");

  const rolls: Array<number | string> = [];
  const policy = input.rerollPolicy;

  for (let i = 0; i < input.count; i++) {
    let extras = 0;
    let face = random.pick(faces);
    rolls.push(face);
    while (
      policy &&
      policy.shouldReroll(face, i) &&
      extras < (policy.maxExtraRolls ?? 20)
    ) {
      face = random.pick(faces);
      rolls.push(face);
      extras++;
    }
  }

  let kept = [...rolls];
  if (input.dropLowest && input.dropLowest > 0) {
    const sorted = [...kept].sort((a, b) => faceToNumber(a) - faceToNumber(b));
    kept = sorted.slice(input.dropLowest);
  }
  if (input.keepHighest && input.keepHighest > 0) {
    const sorted = [...kept].sort((a, b) => faceToNumber(b) - faceToNumber(a));
    kept = sorted.slice(0, input.keepHighest);
  }

  const numericTotal = kept.reduce<number>((sum, f) => sum + faceToNumber(f), 0);
  const value: DiceRollResult = { rolls, kept, numericTotal };

  return ok(state, value, [{ type: "dice.rolled", payload: value }]);
}
