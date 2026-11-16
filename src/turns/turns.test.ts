import { describe, expect, it } from "vitest";
import { createGameState } from "../core/state.js";
import { modifyResource } from "../economy/resources.js";
import {
  advanceTurn,
  getCurrentPlayer,
  markSimultaneousReady,
  setTurnOrder,
} from "./turnOrder.js";
import { setActionPoints, spendActionPoints } from "./actionPoints.js";
import { placeWorker, recallWorkers, registerWorkers } from "./workers.js";
import { selectRole, setRolePool } from "./roles.js";
import { advanceRondel, setRondel } from "./rondel.js";

describe("turns", () => {
  it("advances clockwise turn order", () => {
    let state = createGameState(["a", "b", "c"]);
    state = setTurnOrder(state, "clockwise", ["a", "b", "c"]).state;
    expect(getCurrentPlayer(state)).toBe("a");
    state = advanceTurn(state).state;
    expect(getCurrentPlayer(state)).toBe("b");
  });

  it("orders by bid initiative", () => {
    let state = createGameState(["a", "b"]);
    state = setTurnOrder(state, "bidInitiative", ["a", "b"], {
      bids: { a: 1, b: 5 },
    }).state;
    expect(getCurrentPlayer(state)).toBe("b");
  });

  it("resolves simultaneous when all ready", () => {
    let state = createGameState(["a", "b"]);
    state = setTurnOrder(state, "simultaneous", ["a", "b"]).state;
    state = markSimultaneousReady(state, "a");
    state = markSimultaneousReady(state, "b");
    const r = advanceTurn(state);
    expect(r.value).toEqual(["a", "b"]);
  });

  it("spends action points", () => {
    let state = createGameState(["p1"]);
    state = setActionPoints(state, { p1: 3 });
    state = spendActionPoints(state, {
      playerId: "p1",
      actionId: "build",
      menu: [{ actionId: "build", cost: 2 }],
    }).state;
    expect(() =>
      spendActionPoints(state, {
        playerId: "p1",
        actionId: "build",
        menu: [{ actionId: "build", cost: 2 }],
      }),
    ).toThrow();
  });

  it("places and recalls workers", () => {
    let state = createGameState(["p1"]);
    state = registerWorkers(state, [
      { id: "w1", playerId: "p1", type: "default" },
    ]);
    state = placeWorker(state, { workerId: "w1", nodeId: "mine" }).state;
    expect(() =>
      placeWorker(state, { workerId: "w1", nodeId: "farm" }),
    ).toThrow();
    const recalled = recallWorkers(state, "p1");
    expect(recalled.value).toContain("w1");
  });

  it("selects roles and advances rondel", () => {
    let state = createGameState(["p1"]);
    state = setRolePool(state, [{ id: "trader", name: "Trader" }]);
    const role = selectRole(state, { playerId: "p1", roleId: "trader" });
    expect(role.value.role.id).toBe("trader");

    state = modifyResource(role.state, {
      playerId: "p1",
      resourceId: "gold",
      delta: 5,
    }).state;
    state = setRondel(state, {
      actions: ["mine", "trade", "build", "sail"],
      freeSteps: 3,
      overshootCost: { resourceId: "gold", perStep: 1 },
      playerIds: ["p1"],
    });
    const r = advanceRondel(state, { playerId: "p1", steps: 5 });
    expect(r.value.action).toBe("trade");
    expect(r.value.paid).toBe(2);
  });
});
