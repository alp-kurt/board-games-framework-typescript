import { fail } from "../core/errors.js";
import type { PlayerId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import { getMeta, setMeta, type GameState } from "../core/state.js";

const AP_KEY = "actionPoints";

export interface ActionMenuItem {
  actionId: string;
  cost: number;
}

export function setActionPoints(
  state: GameState,
  budgets: Record<PlayerId, number>,
): GameState {
  return setMeta(state, AP_KEY, { ...budgets });
}

export function spendActionPoints(
  state: GameState,
  input: {
    playerId: PlayerId;
    actionId: string;
    menu: ActionMenuItem[];
  },
): OperationResult<GameState, number> {
  const budgets = { ...getMeta<Record<PlayerId, number>>(state, AP_KEY, {}) };
  const item = input.menu.find((m) => m.actionId === input.actionId);
  if (!item) fail("UNKNOWN_ACTION", `Action ${input.actionId} not in menu`);
  const current = budgets[input.playerId] ?? 0;
  if (current < item.cost) fail("INSUFFICIENT_AP", `Need ${item.cost}, have ${current}`);
  budgets[input.playerId] = current - item.cost;
  const next = setMeta(state, AP_KEY, budgets);
  return ok(next, budgets[input.playerId]!, [
    {
      type: "ap.spent",
      payload: {
        playerId: input.playerId,
        actionId: input.actionId,
        cost: item.cost,
        remaining: budgets[input.playerId],
      },
    },
  ]);
}
