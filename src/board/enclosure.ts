import { fail } from "../core/errors.js";
import type { PlayerId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import type { GameState } from "../core/state.js";
import type { ITopology } from "./topology.js";

export interface EnclosureResult {
  enclosed: boolean;
  regionCells: string[];
}

/**
 * Flood-fill from seed; a region is enclosed if every frontier neighbor is
 * owned/controlled by `playerId` (or blocked) and the interior is not.
 */
export function checkEnclosure(
  state: GameState,
  input: {
    seedCellId: string;
    playerId: PlayerId;
    isWall: (cellId: string, playerId: PlayerId, state: GameState) => boolean;
  },
  topology: ITopology,
): OperationResult<GameState, EnclosureResult> {
  if (!state.board) fail("BOARD_MISSING", "GameState.board is required");
  if (input.isWall(input.seedCellId, input.playerId, state)) {
    return ok(state, { enclosed: false, regionCells: [] }, [
      { type: "board.enclosure", payload: { enclosed: false } },
    ]);
  }

  const visited = new Set<string>();
  const queue = [input.seedCellId];
  let openBorder = false;

  while (queue.length) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const n of topology.neighbors(cur)) {
      if (input.isWall(n, input.playerId, state)) continue;
      if (!state.board.cells[n] && topology.kind !== "graph") {
        // treat missing cell as map edge => not enclosed
        openBorder = true;
        continue;
      }
      if (!visited.has(n)) queue.push(n);
    }
  }

  // If flood can escape to missing/edge cells, not enclosed
  const enclosed = !openBorder && visited.size > 0;
  // Additional check: every neighbor outside the region must be a wall
  if (enclosed) {
    for (const cell of visited) {
      for (const n of topology.neighbors(cell)) {
        if (visited.has(n)) continue;
        if (!input.isWall(n, input.playerId, state)) {
          return ok(state, { enclosed: false, regionCells: [...visited] }, [
            { type: "board.enclosure", payload: { enclosed: false } },
          ]);
        }
      }
    }
  }

  const value: EnclosureResult = {
    enclosed,
    regionCells: [...visited],
  };
  return ok(state, value, [{ type: "board.enclosure", payload: value }]);
}
