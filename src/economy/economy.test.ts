import { describe, expect, it } from "vitest";
import { createGameState } from "../core/state.js";
import { modifyResource } from "./resources.js";
import { executeRecipe } from "./recipe.js";
import { buyFromMarket, sellToMarket, setMarketTracks } from "./market.js";
import { confirmTrade, executeTrade, proposeTrade } from "./trade.js";

describe("economy", () => {
  it("modifies resources with clamp", () => {
    let state = createGameState(["p1"]);
    state = modifyResource(state, {
      playerId: "p1",
      resourceId: "gold",
      delta: 5,
      min: 0,
      max: 10,
    }).state;
    state = modifyResource(state, {
      playerId: "p1",
      resourceId: "gold",
      delta: 100,
      min: 0,
      max: 10,
    }).state;
    expect(state.resources.p1!.gold).toBe(10);
  });

  it("executes recipes", () => {
    let state = createGameState(["p1"]);
    state = modifyResource(state, { playerId: "p1", resourceId: "wheat", delta: 2 }).state;
    state = modifyResource(state, { playerId: "p1", resourceId: "ore", delta: 1 }).state;
    state = executeRecipe(state, {
      playerId: "p1",
      inputs: [
        { resourceId: "wheat", amount: 2 },
        { resourceId: "ore", amount: 1 },
      ],
      outputs: [{ resourceId: "vp", amount: 1 }],
    }).state;
    expect(state.resources.p1!.vp).toBe(1);
    expect(state.resources.p1!.wheat).toBe(0);
  });

  it("buys and sells on market tracks", () => {
    let state = createGameState(["p1"]);
    state = modifyResource(state, { playerId: "p1", resourceId: "gold", delta: 20 }).state;
    state = setMarketTracks(state, [
      {
        itemId: "wood",
        price: 3,
        minPrice: 1,
        maxPrice: 8,
        step: 1,
        currency: "gold",
      },
    ]);
    state = buyFromMarket(state, { playerId: "p1", itemId: "wood", quantity: 2 }).state;
    expect(state.resources.p1!.wood).toBe(2);
    state = sellToMarket(state, { playerId: "p1", itemId: "wood", quantity: 1 }).state;
    expect(state.resources.p1!.wood).toBe(1);
  });

  it("executes confirmed trades atomically", () => {
    let state = createGameState(["p1", "p2"]);
    state = modifyResource(state, { playerId: "p1", resourceId: "gold", delta: 5 }).state;
    state = modifyResource(state, { playerId: "p2", resourceId: "wood", delta: 2 }).state;
    state = proposeTrade(state, {
      id: "t1",
      from: "p1",
      to: "p2",
      give: { gold: 3 },
      receive: { wood: 2 },
    }).state;
    state = confirmTrade(state, "t1", "p2", true).state;
    state = executeTrade(state, "t1").state;
    expect(state.resources.p1!.gold).toBe(2);
    expect(state.resources.p1!.wood).toBe(2);
    expect(state.resources.p2!.gold).toBe(3);
  });
});
