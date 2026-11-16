import { describe, expect, it } from "vitest";
import { createGameState, withEntity, withZone } from "../core/state.js";
import { modifyResource } from "../economy/resources.js";
import { advanceTrack, defineTrack } from "./track.js";
import { evaluateSets } from "./sets.js";
import { mutateGameState } from "./legacy.js";
import { calculateFinalScore, checkEndTriggers } from "./victory.js";

describe("progression", () => {
  it("advances tracks and fires milestones", () => {
    let state = createGameState(["p1"]);
    state = defineTrack(state, {
      id: "tech",
      max: 10,
      milestones: [{ at: 3, id: "unlock-mine", unlock: "mine" }],
      playerIds: ["p1"],
    });
    const r = advanceTrack(state, { trackId: "tech", playerId: "p1", steps: 3 });
    expect(r.value.position).toBe(3);
    expect(r.value.newlyTriggered[0]?.id).toBe("unlock-mine");
  });

  it("evaluates set collection patterns", () => {
    const { value } = evaluateSets(createGameState(), {
      items: [
        { suit: "hearts", rank: 1 },
        { suit: "hearts", rank: 2 },
        { suit: "spades", rank: 3 },
      ],
      matchers: [
        { type: "nOfKind", attribute: "suit", n: 2, points: 5 },
        { type: "run", attribute: "rank", length: 3, points: 10 },
        { type: "oneOfEach", attribute: "suit", values: ["hearts", "spades"], points: 3 },
      ],
    });
    expect(value.total).toBe(18);
  });

  it("applies legacy mutations and end scoring", () => {
    let state = createGameState(["p1", "p2"]);
    state = withEntity(state, { id: "c1", attrs: { sealed: true } });
    state = mutateGameState(state, {
      setMeta: { campaign: 2 },
      setEntityAttrs: { c1: { sealed: false } },
      setResources: { p1: { vp: 7 }, p2: { vp: 4 } },
    }).state;
    expect(state.meta.campaign).toBe(2);
    expect(state.entities.c1!.attrs.sealed).toBe(false);

    state = withZone(state, { id: "supply", cards: [] });
    const end = checkEndTriggers(state, [
      { type: "emptySupply", zoneId: "supply" },
      { type: "vpThreshold", resourceId: "vp", threshold: 6 },
    ]);
    expect(end.value.triggered).toBe(true);

    state = modifyResource(state, { playerId: "p1", resourceId: "vp", delta: 0 }).state;
    const scores = calculateFinalScore(state, [{ resourceId: "vp" }]);
    expect(scores.value.p1).toBe(7);
  });
});
