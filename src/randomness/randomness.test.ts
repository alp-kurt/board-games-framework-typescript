import { describe, expect, it } from "vitest";
import { createGameState } from "../core/state.js";
import { SeededRandomSource } from "../core/random.js";
import { explodeOnMax, rollDice } from "./dice.js";
import { drawFromPool, ensurePool } from "./pool.js";
import { spinWheel } from "./spinner.js";
import { flipCoin } from "./coin.js";

describe("rollDice", () => {
  it("rolls and totals numeric faces", () => {
    const rng = new SeededRandomSource(42);
    const { value } = rollDice(createGameState(), { count: 2, sides: 6 }, rng);
    expect(value.rolls).toHaveLength(2);
    expect(value.numericTotal).toBeGreaterThan(0);
  });

  it("keeps highest and drops lowest", () => {
    const rng = new SeededRandomSource(7);
    const { value } = rollDice(
      createGameState(),
      { count: 4, sides: 6, dropLowest: 1, keepHighest: 2 },
      rng,
    );
    expect(value.kept).toHaveLength(2);
  });

  it("supports exploding dice", () => {
    const rng = new SeededRandomSource(1);
    const { value } = rollDice(
      createGameState(),
      { count: 1, sides: 6, rerollPolicy: explodeOnMax(6) },
      rng,
    );
    expect(value.rolls.length).toBeGreaterThanOrEqual(1);
  });
});

describe("drawFromPool", () => {
  it("draws without replacement and can reshuffle", () => {
    let state = createGameState();
    state = ensurePool(state, {
      id: "bag",
      tokens: ["a", "b"],
      discard: [],
      reshuffleWhenEmpty: true,
    });
    const rng = new SeededRandomSource(3);
    const r1 = drawFromPool(state, { poolId: "bag", drawCount: 2 }, rng);
    expect(r1.value).toHaveLength(2);
    const r2 = drawFromPool(r1.state, { poolId: "bag", drawCount: 1 }, rng);
    expect(r2.value).toHaveLength(1);
  });
});

describe("spinWheel", () => {
  it("picks weighted outcome", () => {
    const { value } = spinWheel(
      createGameState(),
      { segments: [{ outcome: "rare", weight: 1 }, { outcome: "common", weight: 99 }] },
      new SeededRandomSource(99),
    );
    expect(["rare", "common"]).toContain(value);
  });
});

describe("flipCoin", () => {
  it("respects probability bounds", () => {
    expect(() => flipCoin(createGameState(), { probability: 2 })).toThrow();
    const { value } = flipCoin(createGameState(), { probability: 1 }, new SeededRandomSource(1));
    expect(value).toBe(true);
  });
});
