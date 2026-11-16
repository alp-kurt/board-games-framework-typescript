import type { EntityId, PlayerId, ZoneId } from "../core/ids.js";
import type { IRandomSource } from "../core/random.js";
import { MathRandomSource } from "../core/random.js";
import type { OperationResult } from "../core/result.js";
import { ensureZone, type GameState, withZone } from "../core/state.js";
import { moveCards } from "./zones.js";

export function playToTableau(
  state: GameState,
  input: {
    playerId: PlayerId;
    cardId: EntityId;
    fromZone: ZoneId;
    tableauZone: ZoneId;
  },
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, EntityId[]> {
  const result = moveCards(
    state,
    {
      sourceZone: input.fromZone,
      targetZone: input.tableauZone,
      count: 1,
      cardIds: [input.cardId],
      position: "bottom",
    },
    random,
  );
  const tableau = ensureZone(result.state, input.tableauZone, true);
  return {
    ...result,
    state: withZone(result.state, { ...tableau, faceUp: true }),
    events: [
      ...result.events,
      {
        type: "cards.playedToTableau",
        payload: { playerId: input.playerId, cardId: input.cardId },
      },
    ],
  };
}
