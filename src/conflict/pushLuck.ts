import { fail } from "../core/errors.js";
import type { PlayerId } from "../core/ids.js";
import type { IRandomSource } from "../core/random.js";
import { MathRandomSource } from "../core/random.js";
import { ok, type OperationResult } from "../core/result.js";
import { getMeta, setMeta, type GameState } from "../core/state.js";

export interface PushLuckState {
  playerId: PlayerId;
  pot: number;
  busted: boolean;
  banked: number;
}

const PUSH_KEY = "pushLuck";

export type PushLuckAction = "continue" | "bank";

export interface PushLuckStepInput {
  playerId: PlayerId;
  action: PushLuckAction;
  /** Called when continuing; return gain and whether this step busts. */
  resolveStep?: (random: IRandomSource) => { gain: number; bust: boolean };
}

function defaultStep(random: IRandomSource): { gain: number; bust: boolean } {
  const roll = random.nextInt(1, 7);
  return { gain: roll, bust: roll === 1 };
}

export function startPushLuck(state: GameState, playerId: PlayerId): GameState {
  return setMeta(state, PUSH_KEY, {
    playerId,
    pot: 0,
    busted: false,
    banked: 0,
  } satisfies PushLuckState);
}

export function pushLuckStep(
  state: GameState,
  input: PushLuckStepInput,
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, PushLuckState> {
  const cur = getMeta<PushLuckState | undefined>(state, PUSH_KEY, undefined);
  if (!cur || cur.playerId !== input.playerId) {
    fail("PUSH_LUCK_INACTIVE", "Start push luck for this player first");
  }
  if (cur.busted) fail("ALREADY_BUSTED", "Pot already busted");

  if (input.action === "bank") {
    const next: PushLuckState = {
      ...cur,
      banked: cur.banked + cur.pot,
      pot: 0,
    };
    return ok(setMeta(state, PUSH_KEY, next), next, [
      { type: "pushLuck.banked", payload: next },
    ]);
  }

  const step = (input.resolveStep ?? defaultStep)(random);
  if (step.bust) {
    const next: PushLuckState = { ...cur, pot: 0, busted: true };
    return ok(setMeta(state, PUSH_KEY, next), next, [
      { type: "pushLuck.bust", payload: next },
    ]);
  }
  const next: PushLuckState = { ...cur, pot: cur.pot + step.gain };
  return ok(setMeta(state, PUSH_KEY, next), next, [
    { type: "pushLuck.continued", payload: { ...next, gain: step.gain } },
  ]);
}
