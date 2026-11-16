import { fail } from "../core/errors.js";
import type { EntityId, PlayerId, ZoneId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import { ensureZone, getMeta, setMeta, type GameState, withZone } from "../core/state.js";

export type DraftType = "openMarket" | "passLeft" | "passRight";

export interface IDraftStrategy {
  readonly type: DraftType;
  pick(
    state: GameState,
    input: DraftPickInput,
  ): OperationResult<GameState, EntityId[]>;
}

export interface DraftPickInput {
  playerId: PlayerId;
  draftType: DraftType;
  pickCount: number;
  cardIds: EntityId[];
  /** Shared market or current pack zone. */
  poolZone: ZoneId;
  /** Where picked cards go. */
  destinationZone: ZoneId;
  /** For pass drafts: zone holding the remainder for next player. */
  passZone?: ZoneId;
}

const DRAFT_DIR_KEY = "draftPassDirection";

export class OpenMarketDraft implements IDraftStrategy {
  readonly type = "openMarket" as const;

  pick(state: GameState, input: DraftPickInput): OperationResult<GameState, EntityId[]> {
    if (input.pickCount !== input.cardIds.length) {
      fail("DRAFT_COUNT_MISMATCH", "pickCount must equal cardIds length");
    }
    const pool = ensureZone(state, input.poolZone);
    const dest = ensureZone(state, input.destinationZone);
    const pickSet = new Set(input.cardIds);
    const remaining = pool.cards.filter((id) => !pickSet.has(id));
    const taken = pool.cards.filter((id) => pickSet.has(id));
    if (taken.length !== input.cardIds.length) {
      fail("DRAFT_CARD_MISSING", "Some picked cards are not in the pool");
    }
    let next = withZone(state, { ...pool, cards: remaining });
    next = withZone(next, { ...dest, cards: [...dest.cards, ...taken] });
    return ok(next, taken, [
      { type: "draft.picked", payload: { playerId: input.playerId, cards: taken, draftType: this.type } },
    ]);
  }
}

export class PassDirectionDraft implements IDraftStrategy {
  constructor(readonly type: "passLeft" | "passRight") {}

  pick(state: GameState, input: DraftPickInput): OperationResult<GameState, EntityId[]> {
    if (!input.passZone) fail("PASS_ZONE_REQUIRED", "passZone required for pass drafts");
    if (input.pickCount !== input.cardIds.length) {
      fail("DRAFT_COUNT_MISMATCH", "pickCount must equal cardIds length");
    }
    const pool = ensureZone(state, input.poolZone);
    const dest = ensureZone(state, input.destinationZone);
    const pickSet = new Set(input.cardIds);
    const taken = pool.cards.filter((id) => pickSet.has(id));
    const remainder = pool.cards.filter((id) => !pickSet.has(id));
    if (taken.length !== input.cardIds.length) {
      fail("DRAFT_CARD_MISSING", "Some picked cards are not in the pack");
    }
    let next = withZone(state, { ...pool, cards: [] });
    next = withZone(next, { ...dest, cards: [...dest.cards, ...taken] });
    next = withZone(next, { id: input.passZone!, cards: remainder });
    next = setMeta(next, DRAFT_DIR_KEY, this.type);
    return ok(next, taken, [
      {
        type: "draft.picked",
        payload: {
          playerId: input.playerId,
          cards: taken,
          draftType: this.type,
          passed: remainder,
        },
      },
    ]);
  }
}

const strategies: Record<DraftType, IDraftStrategy> = {
  openMarket: new OpenMarketDraft(),
  passLeft: new PassDirectionDraft("passLeft"),
  passRight: new PassDirectionDraft("passRight"),
};

export function draftPick(
  state: GameState,
  input: DraftPickInput,
  strategy?: IDraftStrategy,
): OperationResult<GameState, EntityId[]> {
  const s = strategy ?? strategies[input.draftType];
  return s.pick(state, input);
}

export function getDraftPassDirection(state: GameState): DraftType | undefined {
  return getMeta<DraftType | undefined>(state, DRAFT_DIR_KEY, undefined);
}
