import { fail } from "../core/errors.js";
import type { EntityId, PlayerId, ZoneId } from "../core/ids.js";
import type { IRandomSource } from "../core/random.js";
import { MathRandomSource } from "../core/random.js";
import { ok, type OperationResult } from "../core/result.js";
import type { GameState } from "../core/state.js";
import { moveCards } from "./zones.js";

export type CardMode = "event" | "tuck" | "discardForPoints";

export interface ICardModeHandler {
  readonly mode: CardMode;
  resolve(
    state: GameState,
    input: ResolveCardModeInput,
    random: IRandomSource,
  ): OperationResult<GameState, unknown>;
}

export interface ResolveCardModeInput {
  playerId: PlayerId;
  cardId: EntityId;
  mode: CardMode;
  fromZone: ZoneId;
  /** Where event/tuck/discard destinations live. */
  eventZone?: ZoneId;
  tuckZone?: ZoneId;
  discardZone?: ZoneId;
  points?: number;
}

export class EventModeHandler implements ICardModeHandler {
  readonly mode = "event" as const;

  resolve(
    state: GameState,
    input: ResolveCardModeInput,
    random: IRandomSource,
  ): OperationResult<GameState, EntityId[]> {
    if (!input.eventZone) fail("EVENT_ZONE_REQUIRED", "eventZone required");
    const moved = moveCards(
      state,
      {
        sourceZone: input.fromZone,
        targetZone: input.eventZone,
        count: 1,
        cardIds: [input.cardId],
      },
      random,
    );
    return {
      ...moved,
      events: [
        ...moved.events,
        { type: "card.mode.event", payload: { cardId: input.cardId, playerId: input.playerId } },
      ],
    };
  }
}

export class TuckModeHandler implements ICardModeHandler {
  readonly mode = "tuck" as const;

  resolve(
    state: GameState,
    input: ResolveCardModeInput,
    random: IRandomSource,
  ): OperationResult<GameState, EntityId[]> {
    if (!input.tuckZone) fail("TUCK_ZONE_REQUIRED", "tuckZone required");
    const moved = moveCards(
      state,
      {
        sourceZone: input.fromZone,
        targetZone: input.tuckZone,
        count: 1,
        cardIds: [input.cardId],
        position: "bottom",
      },
      random,
    );
    return {
      ...moved,
      events: [
        ...moved.events,
        { type: "card.mode.tuck", payload: { cardId: input.cardId, playerId: input.playerId } },
      ],
    };
  }
}

export class DiscardForPointsHandler implements ICardModeHandler {
  readonly mode = "discardForPoints" as const;

  resolve(
    state: GameState,
    input: ResolveCardModeInput,
    random: IRandomSource,
  ): OperationResult<GameState, { cards: EntityId[]; points: number }> {
    if (!input.discardZone) fail("DISCARD_ZONE_REQUIRED", "discardZone required");
    const points = input.points ?? 1;
    const moved = moveCards(
      state,
      {
        sourceZone: input.fromZone,
        targetZone: input.discardZone,
        count: 1,
        cardIds: [input.cardId],
      },
      random,
    );
    const resources = {
      ...moved.state.resources,
      [input.playerId]: {
        ...(moved.state.resources[input.playerId] ?? {}),
        movement: ((moved.state.resources[input.playerId] ?? {}).movement ?? 0) + points,
      },
    };
    const next = { ...moved.state, resources };
    return ok(
      next,
      { cards: moved.value, points },
      [
        ...moved.events,
        {
          type: "card.mode.discardForPoints",
          payload: { cardId: input.cardId, playerId: input.playerId, points },
        },
      ],
    );
  }
}

const defaultHandlers: Record<CardMode, ICardModeHandler> = {
  event: new EventModeHandler(),
  tuck: new TuckModeHandler(),
  discardForPoints: new DiscardForPointsHandler(),
};

export function resolveCardMode(
  state: GameState,
  input: ResolveCardModeInput,
  handler?: ICardModeHandler,
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, unknown> {
  const h = handler ?? defaultHandlers[input.mode];
  return h.resolve(state, input, random);
}
