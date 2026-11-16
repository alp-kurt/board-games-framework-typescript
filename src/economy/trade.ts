import { fail } from "../core/errors.js";
import type { PlayerId, ResourceId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import { getMeta, setMeta, type GameState } from "../core/state.js";
import { getResource, modifyResource } from "./resources.js";

export interface TradeOffer {
  from: PlayerId;
  to: PlayerId;
  give: Record<ResourceId, number>;
  receive: Record<ResourceId, number>;
}

export interface PendingTrade extends TradeOffer {
  id: string;
  confirmations: Record<PlayerId, boolean>;
}

const TRADES_KEY = "pendingTrades";

export function proposeTrade(
  state: GameState,
  offer: TradeOffer & { id: string },
): OperationResult<GameState, string> {
  const pending = getMeta<Record<string, PendingTrade>>(state, TRADES_KEY, {});
  const trade: PendingTrade = {
    ...offer,
    confirmations: { [offer.from]: true, [offer.to]: false },
  };
  const next = setMeta(state, TRADES_KEY, { ...pending, [offer.id]: trade });
  return ok(next, offer.id, [{ type: "trade.proposed", payload: trade }]);
}

export function confirmTrade(
  state: GameState,
  tradeId: string,
  playerId: PlayerId,
  accepted: boolean,
): OperationResult<GameState, PendingTrade> {
  const pending = { ...getMeta<Record<string, PendingTrade>>(state, TRADES_KEY, {}) };
  const trade = pending[tradeId];
  if (!trade) fail("TRADE_NOT_FOUND", `Trade ${tradeId} not found`);
  if (playerId !== trade.from && playerId !== trade.to) {
    fail("TRADE_PARTY_INVALID", "Player is not part of this trade");
  }
  const updated: PendingTrade = {
    ...trade,
    confirmations: { ...trade.confirmations, [playerId]: accepted },
  };
  pending[tradeId] = updated;
  return ok(setMeta(state, TRADES_KEY, pending), updated, [
    { type: "trade.confirmed", payload: { tradeId, playerId, accepted } },
  ]);
}

export function executeTrade(
  state: GameState,
  tradeId: string,
): OperationResult<GameState, void> {
  const pending = { ...getMeta<Record<string, PendingTrade>>(state, TRADES_KEY, {}) };
  const trade = pending[tradeId];
  if (!trade) fail("TRADE_NOT_FOUND", `Trade ${tradeId} not found`);
  if (!trade.confirmations[trade.from] || !trade.confirmations[trade.to]) {
    fail("TRADE_NOT_CONFIRMED", "Both parties must confirm");
  }

  for (const [res, amt] of Object.entries(trade.give)) {
    if (getResource(state, trade.from, res) < amt) {
      fail("INSUFFICIENT_RESOURCES", `${trade.from} lacks ${res}`);
    }
  }
  for (const [res, amt] of Object.entries(trade.receive)) {
    if (getResource(state, trade.to, res) < amt) {
      fail("INSUFFICIENT_RESOURCES", `${trade.to} lacks ${res}`);
    }
  }

  let next = state;
  for (const [res, amt] of Object.entries(trade.give)) {
    next = modifyResource(next, { playerId: trade.from, resourceId: res, delta: -amt, min: 0 }).state;
    next = modifyResource(next, { playerId: trade.to, resourceId: res, delta: amt, min: 0 }).state;
  }
  for (const [res, amt] of Object.entries(trade.receive)) {
    next = modifyResource(next, { playerId: trade.to, resourceId: res, delta: -amt, min: 0 }).state;
    next = modifyResource(next, { playerId: trade.from, resourceId: res, delta: amt, min: 0 }).state;
  }
  delete pending[tradeId];
  next = setMeta(next, TRADES_KEY, pending);
  return ok(next, undefined, [{ type: "trade.executed", payload: { tradeId } }]);
}
