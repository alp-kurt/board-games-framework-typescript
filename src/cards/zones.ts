import { fail } from "../core/errors.js";
import type { EntityId, ZoneId } from "../core/ids.js";
import type { IRandomSource } from "../core/random.js";
import { MathRandomSource } from "../core/random.js";
import { ok, okVoid, type OperationResult } from "../core/result.js";
import {
  ensureZone,
  type GameState,
  type ZonePosition,
  withZone,
} from "../core/state.js";

export interface MoveCardsInput {
  sourceZone: ZoneId;
  targetZone: ZoneId;
  count: number;
  position?: ZonePosition;
  /** If set, move these specific ids (must be in source). */
  cardIds?: EntityId[];
}

function takeFromSource(
  cards: EntityId[],
  count: number,
  position: ZonePosition,
  random: IRandomSource,
  cardIds?: EntityId[],
): { taken: EntityId[]; remaining: EntityId[] } {
  if (cardIds) {
    const set = new Set(cardIds);
    const taken: EntityId[] = [];
    const remaining: EntityId[] = [];
    for (const id of cards) {
      if (set.has(id) && taken.length < count) taken.push(id);
      else remaining.push(id);
    }
    if (taken.length < cardIds.length && taken.length < count) {
      fail("CARD_NOT_IN_ZONE", "Some cardIds not found in source zone");
    }
    return { taken, remaining };
  }

  if (cards.length < count) fail("INSUFFICIENT_CARDS", `Need ${count}, have ${cards.length}`);

  if (position === "bottom") {
    return {
      taken: cards.slice(-count),
      remaining: cards.slice(0, -count),
    };
  }
  if (position === "random") {
    const remaining = [...cards];
    const taken: EntityId[] = [];
    for (let i = 0; i < count; i++) {
      const idx = random.nextInt(0, remaining.length);
      taken.push(remaining.splice(idx, 1)[0]!);
    }
    return { taken, remaining };
  }
  // top
  return { taken: cards.slice(0, count), remaining: cards.slice(count) };
}

function insertAt(
  target: EntityId[],
  cards: EntityId[],
  position: ZonePosition,
  random: IRandomSource,
): EntityId[] {
  if (position === "bottom") return [...target, ...cards];
  if (position === "random") {
    const result = [...target];
    for (const c of cards) {
      const idx = random.nextInt(0, result.length + 1);
      result.splice(idx, 0, c);
    }
    return result;
  }
  return [...cards, ...target];
}

export function moveCards(
  state: GameState,
  input: MoveCardsInput,
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, EntityId[]> {
  if (input.count < 1 && !input.cardIds?.length) {
    fail("INVALID_COUNT", "count must be >= 1");
  }
  const count = input.cardIds?.length ?? input.count;
  const fromPos = input.position ?? "top";
  const toPos = input.position ?? "top";

  const source = ensureZone(state, input.sourceZone);
  const target = ensureZone(state, input.targetZone);
  const { taken, remaining } = takeFromSource(
    source.cards,
    count,
    fromPos,
    random,
    input.cardIds,
  );
  const nextTargetCards = insertAt(target.cards, taken, toPos, random);

  let next = withZone(state, { ...source, cards: remaining });
  next = withZone(next, { ...target, id: input.targetZone, cards: nextTargetCards });

  return ok(next, taken, [
    {
      type: "cards.moved",
      payload: {
        sourceZone: input.sourceZone,
        targetZone: input.targetZone,
        cards: taken,
      },
    },
  ]);
}

export function shuffle(
  state: GameState,
  zoneId: ZoneId,
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, void> {
  const zone = ensureZone(state, zoneId);
  const next = withZone(state, { ...zone, cards: random.shuffle(zone.cards) });
  return okVoid(next, [{ type: "cards.shuffled", payload: { zoneId } }]);
}

export function draw(
  state: GameState,
  sourceZone: ZoneId,
  handZone: ZoneId,
  count = 1,
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, EntityId[]> {
  return moveCards(state, { sourceZone, targetZone: handZone, count, position: "top" }, random);
}

export function discard(
  state: GameState,
  handZone: ZoneId,
  discardZone: ZoneId,
  count = 1,
  cardIds?: EntityId[],
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, EntityId[]> {
  return moveCards(
    state,
    { sourceZone: handZone, targetZone: discardZone, count, position: "top", cardIds },
    random,
  );
}

export function mill(
  state: GameState,
  drawZone: ZoneId,
  discardZone: ZoneId,
  count = 1,
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, EntityId[]> {
  return moveCards(
    state,
    { sourceZone: drawZone, targetZone: discardZone, count, position: "top" },
    random,
  );
}

export function exile(
  state: GameState,
  sourceZone: ZoneId,
  exileZone: ZoneId,
  count = 1,
  cardIds?: EntityId[],
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, EntityId[]> {
  return moveCards(
    state,
    { sourceZone, targetZone: exileZone, count, position: "top", cardIds },
    random,
  );
}
