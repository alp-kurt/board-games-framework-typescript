import { describe, expect, it } from "vitest";
import { createGameState, withEntity, withZone } from "../core/state.js";
import { SeededRandomSource } from "../core/random.js";
import { shuffle, draw, moveCards } from "./zones.js";
import { acquireCard, trashCard } from "./deckBuilding.js";
import { playToTableau } from "./tableau.js";
import { draftPick } from "./draft.js";
import { evaluateTrick } from "./trick.js";
import { resolveCardMode } from "./multiUse.js";

function withCards() {
  let state = createGameState(["p1"]);
  for (const id of ["c1", "c2", "c3", "c4"]) {
    state = withEntity(state, { id, attrs: {} });
  }
  state = withZone(state, { id: "deck", cards: ["c1", "c2", "c3"] });
  state = withZone(state, { id: "hand", cards: [] });
  state = withZone(state, { id: "discard", cards: [] });
  state = withZone(state, { id: "exile", cards: [] });
  state = withZone(state, { id: "market", cards: ["c4"] });
  state = withZone(state, { id: "tableau", cards: [] });
  return state;
}

describe("cards zones", () => {
  it("shuffles and draws", () => {
    let state = withCards();
    state = shuffle(state, "deck", new SeededRandomSource(5)).state;
    const drawn = draw(state, "deck", "hand", 2, new SeededRandomSource(5));
    expect(drawn.value).toHaveLength(2);
    expect(drawn.state.zones.hand!.cards).toHaveLength(2);
  });

  it("moves to bottom", () => {
    const state = withCards();
    const r = moveCards(state, {
      sourceZone: "deck",
      targetZone: "discard",
      count: 1,
      position: "bottom",
    });
    expect(r.state.zones.discard!.cards).toEqual(["c3"]);
  });
});

describe("deck building & tableau", () => {
  it("acquires, trashes, and plays to tableau", () => {
    let state = withCards();
    state = acquireCard(state, {
      playerId: "p1",
      cardId: "c4",
      fromZone: "market",
      toZone: "discard",
    }).state;
    expect(state.zones.discard!.cards).toContain("c4");
    state = draw(state, "deck", "hand", 1).state;
    const card = state.zones.hand!.cards[0]!;
    state = playToTableau(state, {
      playerId: "p1",
      cardId: card,
      fromZone: "hand",
      tableauZone: "tableau",
    }).state;
    expect(state.zones.tableau!.faceUp).toBe(true);
    state = trashCard(state, {
      playerId: "p1",
      cardId: card,
      fromZone: "tableau",
      trashZone: "exile",
    }).state;
    expect(state.zones.exile!.cards).toContain(card);
  });
});

describe("draft & trick & modes", () => {
  it("drafts from open market", () => {
    const state = withCards();
    const r = draftPick(state, {
      playerId: "p1",
      draftType: "openMarket",
      pickCount: 1,
      cardIds: ["c4"],
      poolZone: "market",
      destinationZone: "hand",
    });
    expect(r.value).toEqual(["c4"]);
  });

  it("evaluates trump trick", () => {
    const { value } = evaluateTrick(createGameState(), {
      leadSuit: "hearts",
      trumpSuit: "spades",
      playedCards: [
        { playerId: "p1", cardId: "a", suit: "hearts", rank: 10 },
        { playerId: "p2", cardId: "b", suit: "spades", rank: 2 },
      ],
    });
    expect(value.winnerId).toBe("p2");
  });

  it("resolves discard-for-points mode", () => {
    let state = withCards();
    state = draw(state, "deck", "hand", 1).state;
    const card = state.zones.hand!.cards[0]!;
    const r = resolveCardMode(state, {
      playerId: "p1",
      cardId: card,
      mode: "discardForPoints",
      fromZone: "hand",
      discardZone: "discard",
      points: 3,
    });
    expect(r.state.resources.p1!.movement).toBe(3);
  });
});
