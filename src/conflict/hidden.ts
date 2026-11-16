import { fail } from "../core/errors.js";
import type { EntityId, PlayerId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import { getMeta, setMeta, type Entity, type GameState } from "../core/state.js";

const HIDDEN_KEY = "hiddenAttributes";

/** entityId -> attribute keys that are hidden from non-owners */
export type HiddenAttributeMap = Record<EntityId, string[]>;

export function markHiddenAttributes(
  state: GameState,
  map: HiddenAttributeMap,
): GameState {
  const existing = getMeta<HiddenAttributeMap>(state, HIDDEN_KEY, {});
  return setMeta(state, HIDDEN_KEY, { ...existing, ...map });
}

export function revealHiddenState(
  state: GameState,
  input: {
    entityId: EntityId;
    attributes?: string[];
    /** If omitted, reveal all hidden attrs for entity. */
  },
): OperationResult<GameState, string[]> {
  const hidden = { ...getMeta<HiddenAttributeMap>(state, HIDDEN_KEY, {}) };
  const current = hidden[input.entityId] ?? [];
  if (!state.entities[input.entityId]) {
    fail("ENTITY_MISSING", `Entity ${input.entityId} not found`);
  }
  const toReveal = input.attributes ?? current;
  hidden[input.entityId] = current.filter((a) => !toReveal.includes(a));
  const next = setMeta(state, HIDDEN_KEY, hidden);
  return ok(next, toReveal, [
    {
      type: "hidden.revealed",
      payload: { entityId: input.entityId, attributes: toReveal },
    },
  ]);
}

export function viewEntityFor(
  state: GameState,
  entityId: EntityId,
  viewerId: PlayerId,
): Entity | undefined {
  const entity = state.entities[entityId];
  if (!entity) return undefined;
  const hidden = getMeta<HiddenAttributeMap>(state, HIDDEN_KEY, {});
  const secrets = hidden[entityId] ?? [];
  if (entity.owner === viewerId || secrets.length === 0) return entity;
  const attrs = { ...entity.attrs };
  for (const key of secrets) delete attrs[key];
  return { ...entity, attrs };
}
