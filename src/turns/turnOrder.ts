import { fail } from "../core/errors.js";
import type { PlayerId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import { getMeta, setMeta, type GameState } from "../core/state.js";

export type TurnOrderMode =
  | "clockwise"
  | "bidInitiative"
  | "progressive"
  | "simultaneous";

export interface TurnOrderState {
  mode: TurnOrderMode;
  order: PlayerId[];
  currentIndex: number;
  simultaneousReady?: Record<PlayerId, boolean>;
}

const TURN_KEY = "turnOrder";

export interface ITurnOrderStrategy {
  readonly mode: TurnOrderMode;
  setOrder(state: GameState, players: PlayerId[], extras?: unknown): GameState;
  advance(state: GameState): OperationResult<GameState, PlayerId | PlayerId[]>;
}

function read(state: GameState): TurnOrderState {
  const t = getMeta<TurnOrderState | undefined>(state, TURN_KEY, undefined);
  if (!t) fail("TURN_ORDER_UNSET", "Call setTurnOrder first");
  return t;
}

export class ClockwiseTurnOrder implements ITurnOrderStrategy {
  readonly mode = "clockwise" as const;

  setOrder(state: GameState, players: PlayerId[]): GameState {
    return setMeta(state, TURN_KEY, {
      mode: this.mode,
      order: [...players],
      currentIndex: 0,
    } satisfies TurnOrderState);
  }

  advance(state: GameState): OperationResult<GameState, PlayerId> {
    const t = read(state);
    const nextIndex = (t.currentIndex + 1) % t.order.length;
    const next = setMeta(state, TURN_KEY, { ...t, currentIndex: nextIndex });
    const current = t.order[nextIndex]!;
    return ok(next, current, [{ type: "turn.advanced", payload: { current } }]);
  }
}

export class BidInitiativeTurnOrder implements ITurnOrderStrategy {
  readonly mode = "bidInitiative" as const;

  setOrder(state: GameState, players: PlayerId[], extras?: unknown): GameState {
    const bids = (extras as { bids?: Record<PlayerId, number> } | undefined)?.bids ?? {};
    const order = [...players].sort((a, b) => (bids[b] ?? 0) - (bids[a] ?? 0));
    return setMeta(state, TURN_KEY, {
      mode: this.mode,
      order,
      currentIndex: 0,
    } satisfies TurnOrderState);
  }

  advance(state: GameState): OperationResult<GameState, PlayerId> {
    return new ClockwiseTurnOrder().advance(state);
  }
}

export class ProgressiveTurnOrder implements ITurnOrderStrategy {
  readonly mode = "progressive" as const;

  setOrder(state: GameState, players: PlayerId[], extras?: unknown): GameState {
    const scores = (extras as { scores?: Record<PlayerId, number> } | undefined)?.scores ?? {};
    // last place goes first
    const order = [...players].sort((a, b) => (scores[a] ?? 0) - (scores[b] ?? 0));
    return setMeta(state, TURN_KEY, {
      mode: this.mode,
      order,
      currentIndex: 0,
    } satisfies TurnOrderState);
  }

  advance(state: GameState): OperationResult<GameState, PlayerId> {
    return new ClockwiseTurnOrder().advance(state);
  }
}

export class SimultaneousTurnOrder implements ITurnOrderStrategy {
  readonly mode = "simultaneous" as const;

  setOrder(state: GameState, players: PlayerId[]): GameState {
    const ready: Record<PlayerId, boolean> = {};
    for (const p of players) ready[p] = false;
    return setMeta(state, TURN_KEY, {
      mode: this.mode,
      order: [...players],
      currentIndex: 0,
      simultaneousReady: ready,
    } satisfies TurnOrderState);
  }

  advance(state: GameState): OperationResult<GameState, PlayerId[]> {
    const t = read(state);
    const ready = t.simultaneousReady ?? {};
    const allReady = t.order.every((p) => ready[p]);
    if (!allReady) fail("SIMULTANEOUS_NOT_READY", "Not all players have selected");
    const reset: Record<PlayerId, boolean> = {};
    for (const p of t.order) reset[p] = false;
    const next = setMeta(state, TURN_KEY, { ...t, simultaneousReady: reset });
    return ok(next, [...t.order], [
      { type: "turn.simultaneousResolved", payload: { players: t.order } },
    ]);
  }
}

const strategies: Record<TurnOrderMode, ITurnOrderStrategy> = {
  clockwise: new ClockwiseTurnOrder(),
  bidInitiative: new BidInitiativeTurnOrder(),
  progressive: new ProgressiveTurnOrder(),
  simultaneous: new SimultaneousTurnOrder(),
};

export function setTurnOrder(
  state: GameState,
  mode: TurnOrderMode,
  players: PlayerId[],
  extras?: unknown,
  strategy?: ITurnOrderStrategy,
): OperationResult<GameState, TurnOrderState> {
  const s = strategy ?? strategies[mode];
  const next = s.setOrder(state, players, extras);
  const value = getMeta<TurnOrderState>(next, TURN_KEY, {
    mode,
    order: players,
    currentIndex: 0,
  });
  return ok(next, value, [{ type: "turn.orderSet", payload: value }]);
}

export function advanceTurn(
  state: GameState,
  strategy?: ITurnOrderStrategy,
): OperationResult<GameState, PlayerId | PlayerId[]> {
  const t = read(state);
  const s = strategy ?? strategies[t.mode];
  return s.advance(state);
}

export function markSimultaneousReady(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const t = read(state);
  return setMeta(state, TURN_KEY, {
    ...t,
    simultaneousReady: { ...t.simultaneousReady, [playerId]: true },
  });
}

export function getCurrentPlayer(state: GameState): PlayerId {
  const t = read(state);
  return t.order[t.currentIndex]!;
}
