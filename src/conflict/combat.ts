import { fail } from "../core/errors.js";
import type { PlayerId } from "../core/ids.js";
import type { IRandomSource } from "../core/random.js";
import { MathRandomSource } from "../core/random.js";
import { ok, type OperationResult } from "../core/result.js";
import type { GameState } from "../core/state.js";
import { rollDice } from "../randomness/dice.js";

export type CombatVariant = "deterministic" | "dicePool" | "rps";

export type RpsChoice = "rock" | "paper" | "scissors";

export interface CombatSide {
  playerId: PlayerId;
  strength?: number;
  diceCount?: number;
  diceSides?: number;
  rps?: RpsChoice;
}

export interface CombatResult {
  winnerId?: PlayerId;
  draw: boolean;
  details?: unknown;
}

export interface ICombatResolver {
  readonly variant: CombatVariant;
  resolve(
    state: GameState,
    a: CombatSide,
    b: CombatSide,
    random: IRandomSource,
  ): OperationResult<GameState, CombatResult>;
}

export class DeterministicCombat implements ICombatResolver {
  readonly variant = "deterministic" as const;

  resolve(
    state: GameState,
    a: CombatSide,
    b: CombatSide,
  ): OperationResult<GameState, CombatResult> {
    const sa = a.strength ?? 0;
    const sb = b.strength ?? 0;
    const diff = sa - sb;
    const value: CombatResult =
      diff === 0
        ? { draw: true }
        : { draw: false, winnerId: diff > 0 ? a.playerId : b.playerId, details: { diff } };
    return ok(state, value, [{ type: "combat.resolved", payload: value }]);
  }
}

export class DicePoolCombat implements ICombatResolver {
  readonly variant = "dicePool" as const;

  resolve(
    state: GameState,
    a: CombatSide,
    b: CombatSide,
    random: IRandomSource,
  ): OperationResult<GameState, CombatResult> {
    const ra = rollDice(
      state,
      { count: a.diceCount ?? 1, sides: (a.diceSides ?? 6) as 6 },
      random,
    );
    const rb = rollDice(
      ra.state,
      { count: b.diceCount ?? 1, sides: (b.diceSides ?? 6) as 6 },
      random,
    );
    const maxA = Math.max(...ra.value.kept.map((f) => (typeof f === "number" ? f : 0)));
    const maxB = Math.max(...rb.value.kept.map((f) => (typeof f === "number" ? f : 0)));
    const value: CombatResult =
      maxA === maxB
        ? { draw: true, details: { maxA, maxB } }
        : {
            draw: false,
            winnerId: maxA > maxB ? a.playerId : b.playerId,
            details: { maxA, maxB },
          };
    return ok(rb.state, value, [
      ...ra.events,
      ...rb.events,
      { type: "combat.resolved", payload: value },
    ]);
  }
}

const RPS_BEATS: Record<RpsChoice, RpsChoice> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

export class RpsCombat implements ICombatResolver {
  readonly variant = "rps" as const;

  resolve(
    state: GameState,
    a: CombatSide,
    b: CombatSide,
  ): OperationResult<GameState, CombatResult> {
    if (!a.rps || !b.rps) fail("RPS_REQUIRED", "Both sides need rps choice");
    let value: CombatResult;
    if (a.rps === b.rps) value = { draw: true, details: { a: a.rps, b: b.rps } };
    else if (RPS_BEATS[a.rps] === b.rps) {
      value = { draw: false, winnerId: a.playerId, details: { a: a.rps, b: b.rps } };
    } else {
      value = { draw: false, winnerId: b.playerId, details: { a: a.rps, b: b.rps } };
    }
    return ok(state, value, [{ type: "combat.resolved", payload: value }]);
  }
}

const resolvers: Record<CombatVariant, ICombatResolver> = {
  deterministic: new DeterministicCombat(),
  dicePool: new DicePoolCombat(),
  rps: new RpsCombat(),
};

export function resolveCombat(
  state: GameState,
  input: { variant: CombatVariant; a: CombatSide; b: CombatSide },
  resolver?: ICombatResolver,
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, CombatResult> {
  const r = resolver ?? resolvers[input.variant];
  return r.resolve(state, input.a, input.b, random);
}
