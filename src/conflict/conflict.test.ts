import { describe, expect, it } from "vitest";
import { createGameState, withEntity } from "../core/state.js";
import { SeededRandomSource } from "../core/random.js";
import { runAuction } from "./auction.js";
import { resolveCombat } from "./combat.js";
import { pushLuckStep, startPushLuck } from "./pushLuck.js";
import { assignSecretRoles, checkWinCondition, getRoleForPlayer } from "./roles.js";
import { markHiddenAttributes, revealHiddenState, viewEntityFor } from "./hidden.js";

describe("conflict", () => {
  it("resolves english and sealed auctions", () => {
    const state = createGameState(["a", "b"]);
    const eng = runAuction(state, {
      variant: "english",
      bids: [
        { playerId: "a", amount: 3 },
        { playerId: "b", amount: 5 },
      ],
    });
    expect(eng.value.winnerId).toBe("b");
    const sealed = runAuction(
      state,
      {
        variant: "sealed",
        bids: [
          { playerId: "a", amount: 5 },
          { playerId: "b", amount: 5 },
        ],
      },
      undefined,
      new SeededRandomSource(2),
    );
    expect(["a", "b"]).toContain(sealed.value.winnerId);
  });

  it("resolves combat variants", () => {
    const state = createGameState(["a", "b"]);
    const det = resolveCombat(state, {
      variant: "deterministic",
      a: { playerId: "a", strength: 5 },
      b: { playerId: "b", strength: 3 },
    });
    expect(det.value.winnerId).toBe("a");
    const rps = resolveCombat(state, {
      variant: "rps",
      a: { playerId: "a", rps: "rock" },
      b: { playerId: "b", rps: "scissors" },
    });
    expect(rps.value.winnerId).toBe("a");
  });

  it("handles push-your-luck bank and bust", () => {
    let state = startPushLuck(createGameState(["p1"]), "p1");
    state = pushLuckStep(
      state,
      {
        playerId: "p1",
        action: "continue",
        resolveStep: () => ({ gain: 4, bust: false }),
      },
    ).state;
    const banked = pushLuckStep(state, { playerId: "p1", action: "bank" });
    expect(banked.value.banked).toBe(4);
  });

  it("assigns secret roles and filters hidden attrs", () => {
    let state = createGameState(["a", "b"]);
    state = assignSecretRoles(
      state,
      {
        players: ["a", "b"],
        roles: [
          { roleId: "spy", team: "red", winConditionId: "redWins" },
          { roleId: "agent", team: "blue", winConditionId: "blueWins" },
        ],
      },
      new SeededRandomSource(1),
    ).state;
    expect(getRoleForPlayer(state, "a", "b")).toBeUndefined();
    expect(getRoleForPlayer(state, "a", "a")).toBeDefined();

    const winners = checkWinCondition(state, {
      conditionId: "redWins",
      evaluate: (_s, assignments) =>
        Object.entries(assignments)
          .filter(([, r]) => r.team === "red")
          .map(([pid]) => pid),
    });
    expect(winners.value.length).toBe(1);

    state = withEntity(state, {
      id: "card1",
      owner: "a",
      attrs: { strength: 10, bluff: true },
    });
    state = markHiddenAttributes(state, { card1: ["strength"] });
    expect(viewEntityFor(state, "card1", "b")?.attrs.strength).toBeUndefined();
    state = revealHiddenState(state, { entityId: "card1" }).state;
    expect(viewEntityFor(state, "card1", "b")?.attrs.strength).toBe(10);
  });
});
