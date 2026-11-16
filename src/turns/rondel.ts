import { fail } from "../core/errors.js";
import type { PlayerId, ResourceId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import { getMeta, setMeta, type GameState } from "../core/state.js";
import { getResource, modifyResource } from "../economy/resources.js";

export interface RondelState {
  actions: string[];
  positions: Record<PlayerId, number>;
  freeSteps: number;
  overshootCost: { resourceId: ResourceId; perStep: number };
}

const RONDEL_KEY = "rondel";

export function setRondel(
  state: GameState,
  config: Omit<RondelState, "positions"> & { playerIds: PlayerId[] },
): GameState {
  const positions: Record<PlayerId, number> = {};
  for (const p of config.playerIds) positions[p] = 0;
  const { playerIds: _, ...rest } = config;
  return setMeta(state, RONDEL_KEY, { ...rest, positions } satisfies RondelState);
}

export function advanceRondel(
  state: GameState,
  input: {
    playerId: PlayerId;
    steps: number;
  },
): OperationResult<GameState, { action: string; paid: number }> {
  if (input.steps < 1) fail("INVALID_STEPS", "steps must be >= 1");
  const rondel = getMeta<RondelState | undefined>(state, RONDEL_KEY, undefined);
  if (!rondel) fail("RONDEL_UNSET", "Call setRondel first");

  const current = rondel.positions[input.playerId] ?? 0;
  const overshoot = Math.max(0, input.steps - rondel.freeSteps);
  const cost = overshoot * rondel.overshootCost.perStep;
  let next = state;
  if (cost > 0) {
    if (
      getResource(next, input.playerId, rondel.overshootCost.resourceId) < cost
    ) {
      fail("INSUFFICIENT_RESOURCES", "Cannot pay rondel overshoot");
    }
    next = modifyResource(next, {
      playerId: input.playerId,
      resourceId: rondel.overshootCost.resourceId,
      delta: -cost,
      min: 0,
    }).state;
  }
  const pos = (current + input.steps) % rondel.actions.length;
  const action = rondel.actions[pos]!;
  next = setMeta(next, RONDEL_KEY, {
    ...rondel,
    positions: { ...rondel.positions, [input.playerId]: pos },
  });
  return ok(next, { action, paid: cost }, [
    {
      type: "rondel.advanced",
      payload: { playerId: input.playerId, steps: input.steps, action, paid: cost },
    },
  ]);
}
