import { fail } from "../core/errors.js";
import type { PlayerId, ResourceId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import { getMeta, setMeta, type GameState } from "../core/state.js";
import { getResource, modifyResource } from "./resources.js";

export interface MarketTrack {
  itemId: string;
  price: number;
  minPrice: number;
  maxPrice: number;
  step: number;
  currency: ResourceId;
}

const MARKET_KEY = "marketTracks";

export function setMarketTracks(
  state: GameState,
  tracks: MarketTrack[],
): GameState {
  const map: Record<string, MarketTrack> = {};
  for (const t of tracks) map[t.itemId] = t;
  return setMeta(state, MARKET_KEY, map);
}

function getTracks(state: GameState): Record<string, MarketTrack> {
  return getMeta(state, MARKET_KEY, {});
}

export interface MarketTradeInput {
  playerId: PlayerId;
  itemId: string;
  quantity?: number;
}

export function buyFromMarket(
  state: GameState,
  input: MarketTradeInput,
): OperationResult<GameState, number> {
  const qty = input.quantity ?? 1;
  const tracks = { ...getTracks(state) };
  const track = tracks[input.itemId];
  if (!track) fail("MARKET_ITEM_MISSING", `Unknown item ${input.itemId}`);

  let next = state;
  let paid = 0;
  let price = track.price;
  for (let i = 0; i < qty; i++) {
    if (getResource(next, input.playerId, track.currency) < price) {
      fail("INSUFFICIENT_FUNDS", `Cannot afford ${input.itemId} at ${price}`);
    }
    next = modifyResource(next, {
      playerId: input.playerId,
      resourceId: track.currency,
      delta: -price,
      min: 0,
    }).state;
    next = modifyResource(next, {
      playerId: input.playerId,
      resourceId: input.itemId,
      delta: 1,
      min: 0,
    }).state;
    paid += price;
    price = Math.min(track.maxPrice, price + track.step);
  }
  tracks[input.itemId] = { ...track, price };
  next = setMeta(next, MARKET_KEY, tracks);
  return ok(next, paid, [
    {
      type: "market.bought",
      payload: { playerId: input.playerId, itemId: input.itemId, quantity: qty, paid },
    },
  ]);
}

export function sellToMarket(
  state: GameState,
  input: MarketTradeInput,
): OperationResult<GameState, number> {
  const qty = input.quantity ?? 1;
  const tracks = { ...getTracks(state) };
  const track = tracks[input.itemId];
  if (!track) fail("MARKET_ITEM_MISSING", `Unknown item ${input.itemId}`);

  let next = state;
  let earned = 0;
  let price = track.price;
  for (let i = 0; i < qty; i++) {
    if (getResource(next, input.playerId, input.itemId) < 1) {
      fail("INSUFFICIENT_ITEMS", `No ${input.itemId} to sell`);
    }
    next = modifyResource(next, {
      playerId: input.playerId,
      resourceId: input.itemId,
      delta: -1,
      min: 0,
    }).state;
    next = modifyResource(next, {
      playerId: input.playerId,
      resourceId: track.currency,
      delta: price,
      min: 0,
    }).state;
    earned += price;
    price = Math.max(track.minPrice, price - track.step);
  }
  tracks[input.itemId] = { ...track, price };
  next = setMeta(next, MARKET_KEY, tracks);
  return ok(next, earned, [
    {
      type: "market.sold",
      payload: { playerId: input.playerId, itemId: input.itemId, quantity: qty, earned },
    },
  ]);
}
