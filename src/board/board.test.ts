import { describe, expect, it } from "vitest";
import { createGameState, withEntity } from "../core/state.js";
import { SquareGrid, cellKey } from "./topology.js";
import { checkLineOfSight, getDistance, moveEntity } from "./movement.js";
import { placeTile } from "./tiles.js";
import { calculateAreaControl } from "./areaControl.js";
import { checkEnclosure } from "./enclosure.js";

describe("board", () => {
  it("moves on square grid with terrain costs", () => {
    const topo = new SquareGrid(3, 3);
    let state = createGameState(["p1"]);
    state = withEntity(state, { id: "e1", owner: "p1", attrs: {} });
    state = {
      ...state,
      board: {
        kind: "square",
        cells: {
          "0,0": { occupants: ["e1"], terrain: "plain" },
          "1,0": { occupants: [], terrain: "forest" },
          "2,0": { occupants: [], terrain: "plain" },
        },
        entityPositions: { e1: "0,0" },
      },
    };
    const r = moveEntity(
      state,
      {
        entityId: "e1",
        path: ["0,0", "1,0", "2,0"],
        movementPoints: 3,
        terrainCosts: { plain: 1, forest: 2 },
      },
      topo,
    );
    expect(r.value.position).toBe("2,0");
    expect(r.value.remainingMp).toBe(0);
  });

  it("places tiles with edge matching", () => {
    let state = createGameState();
    state = {
      ...state,
      board: { kind: "square", cells: {}, entityPositions: {} },
    };
    state = placeTile(state, {
      tileId: "t1",
      coordinates: { x: 0, y: 0 },
      rotation: 0,
      tile: { edges: ["road", "city", "road", "field"] },
    }).state;
    expect(state.board!.cells[cellKey(0, 0)]!.tileId).toBe("t1");
  });

  it("calculates area control and LoS", () => {
    const topo = new SquareGrid(3, 1, false);
    let state = createGameState(["p1", "p2"]);
    state = {
      ...state,
      board: {
        kind: "square",
        cells: {
          "0,0": { occupants: [], influence: { p1: 2, p2: 1 } },
          "1,0": { occupants: [], blocked: true },
          "2,0": { occupants: [] },
        },
      },
    };
    const ctrl = calculateAreaControl(state, "0,0");
    expect(ctrl.value.controller).toBe("p1");
    expect(getDistance("0,0", "2,0", topo)).toBe(2);
    expect(checkLineOfSight(state, "0,0", "2,0", topo)).toBe(false);
  });

  it("detects enclosure via flood fill", () => {
    const topo = new SquareGrid(3, 3);
    let state = createGameState(["p1"]);
    // walls around center
    const walls = new Set(["0,1", "1,0", "1,2", "2,1"]);
    state = {
      ...state,
      board: {
        kind: "square",
        cells: Object.fromEntries(
          [...Array(9)].map((_, i) => {
            const x = i % 3;
            const y = Math.floor(i / 3);
            return [cellKey(x, y), { occupants: [] }];
          }),
        ),
      },
    };
    const r = checkEnclosure(
      state,
      {
        seedCellId: "1,1",
        playerId: "p1",
        isWall: (id) => walls.has(id),
      },
      topo,
    );
    expect(r.value.enclosed).toBe(true);
  });
});
