import type { EntityId, PlayerId, ZoneId } from "../core/ids.js";
import type { IRandomSource } from "../core/random.js";
import { MathRandomSource } from "../core/random.js";
import type { OperationResult } from "../core/result.js";
import type { GameState } from "../core/state.js";
import { moveCards } from "./zones.js";

/** Permanently add a card into the player's deck cycle (typically discard). */
export function acquireCard(
  state: GameState,
  input: {
    playerId: PlayerId;
    cardId: EntityId;
    fromZone: ZoneId;
    toZone: ZoneId;
  },
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, EntityId[]> {
  return moveCards(
    state,
    {
      sourceZone: input.fromZone,
      targetZone: input.toZone,
      count: 1,
      cardIds: [input.cardId],
      position: "bottom",
    },
    random,
  );
}

/** Permanently remove a card from the player's deck cycle. */
export function trashCard(
  state: GameState,
  input: {
    playerId: PlayerId;
    cardId: EntityId;
    fromZone: ZoneId;
    trashZone: ZoneId;
  },
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, EntityId[]> {
  return moveCards(
    state,
    {
      sourceZone: input.fromZone,
      targetZone: input.trashZone,
      count: 1,
      cardIds: [input.cardId],
    },
    random,
  );
}
