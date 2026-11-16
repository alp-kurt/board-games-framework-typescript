import { fail } from "../core/errors.js";
import type { EntityId, PlayerId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import type { GameState } from "../core/state.js";

export interface PlayedCard {
  playerId: PlayerId;
  cardId: EntityId;
  suit: string;
  rank: number;
}

export interface IRankOrder {
  compare(a: PlayedCard, b: PlayedCard, leadSuit: string, trumpSuit?: string): number;
}

export class StandardTrumpRankOrder implements IRankOrder {
  compare(a: PlayedCard, b: PlayedCard, leadSuit: string, trumpSuit?: string): number {
    const score = (c: PlayedCard) => {
      const isTrump = trumpSuit !== undefined && c.suit === trumpSuit;
      const isLead = c.suit === leadSuit;
      if (isTrump) return 2000 + c.rank;
      if (isLead) return 1000 + c.rank;
      return c.rank;
    };
    return score(a) - score(b);
  }
}

export interface EvaluateTrickInput {
  leadSuit: string;
  trumpSuit?: string;
  playedCards: PlayedCard[];
}

export function evaluateTrick(
  state: GameState,
  input: EvaluateTrickInput,
  rankOrder: IRankOrder = new StandardTrumpRankOrder(),
): OperationResult<GameState, { winnerId: PlayerId; winningCardId: EntityId }> {
  if (input.playedCards.length === 0) fail("EMPTY_TRICK", "playedCards required");
  let best = input.playedCards[0]!;
  for (let i = 1; i < input.playedCards.length; i++) {
    const c = input.playedCards[i]!;
    if (rankOrder.compare(c, best, input.leadSuit, input.trumpSuit) > 0) best = c;
  }
  const value = { winnerId: best.playerId, winningCardId: best.cardId };
  return ok(state, value, [{ type: "trick.evaluated", payload: value }]);
}
