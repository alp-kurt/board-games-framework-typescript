import { describe, expect, it } from "vitest";
import {
  createGameState,
  SeededRandomSource,
  withEntity,
  withZone,
  shuffle,
  draw,
  setActionPoints,
  spendActionPoints,
  modifyResource,
  checkEndTriggers,
} from "./index.js";

describe("composition smoke", () => {
  it("shuffle → draw → spend AP → modifyResource → checkEndTriggers", () => {
    const rng = new SeededRandomSource(11);
    let state = createGameState(["p1"]);
    for (const id of ["c1", "c2", "c3"]) {
      state = withEntity(state, { id, attrs: {} });
    }
    state = withZone(state, { id: "deck", cards: ["c1", "c2", "c3"] });
    state = withZone(state, { id: "hand", cards: [] });
    state = shuffle(state, "deck", rng).state;
    state = draw(state, "deck", "hand", 1, rng).state;
    state = setActionPoints(state, { p1: 2 });
    state = spendActionPoints(state, {
      playerId: "p1",
      actionId: "play",
      menu: [{ actionId: "play", cost: 1 }],
    }).state;
    state = modifyResource(state, {
      playerId: "p1",
      resourceId: "vp",
      delta: 10,
      min: 0,
    }).state;
    const end = checkEndTriggers(state, [
      { type: "vpThreshold", resourceId: "vp", threshold: 10 },
    ]);
    expect(end.value.triggered).toBe(true);
    expect(state.zones.hand!.cards).toHaveLength(1);
  });
});
