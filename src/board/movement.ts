import { fail } from "../core/errors.js";
import type { EntityId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import type { BoardCell, GameState } from "../core/state.js";
import type { ITopology } from "./topology.js";

export interface MoveEntityInput {
  entityId: EntityId;
  path: string[];
  movementPoints: number;
  terrainCosts?: Record<string, number>;
}

function ensureBoard(state: GameState): NonNullable<GameState["board"]> {
  if (!state.board) fail("BOARD_MISSING", "GameState.board is required");
  return state.board;
}

export function moveEntity(
  state: GameState,
  input: MoveEntityInput,
  topology: ITopology,
): OperationResult<GameState, { remainingMp: number; position: string }> {
  if (input.path.length < 1) fail("EMPTY_PATH", "path required");
  const board = ensureBoard(state);
  const start = board.entityPositions?.[input.entityId];
  if (start === undefined) fail("ENTITY_NOT_ON_BOARD", `Entity ${input.entityId} has no position`);
  if (input.path[0] !== start) fail("PATH_START_MISMATCH", "path must start at entity position");

  let cost = 0;
  for (let i = 1; i < input.path.length; i++) {
    const from = input.path[i - 1]!;
    const to = input.path[i]!;
    if (!topology.neighbors(from).includes(to)) {
      fail("INVALID_PATH", `${from} is not adjacent to ${to}`);
    }
    const cell: BoardCell | undefined = board.cells[to];
    const terrain = cell?.terrain ?? "default";
    cost += input.terrainCosts?.[terrain] ?? 1;
  }
  if (cost > input.movementPoints) {
    fail("INSUFFICIENT_MP", `Path costs ${cost}, have ${input.movementPoints}`);
  }

  const dest = input.path[input.path.length - 1]!;
  const cells = { ...board.cells };
  const startCell = cells[start] ?? { occupants: [] };
  cells[start] = {
    ...startCell,
    occupants: startCell.occupants.filter((id) => id !== input.entityId),
  };
  const destCell = cells[dest] ?? { occupants: [] };
  cells[dest] = {
    ...destCell,
    occupants: [...destCell.occupants, input.entityId],
  };

  const next: GameState = {
    ...state,
    board: {
      ...board,
      cells,
      entityPositions: {
        ...board.entityPositions,
        [input.entityId]: dest,
      },
    },
  };
  const value = { remainingMp: input.movementPoints - cost, position: dest };
  return ok(next, value, [
    { type: "board.moved", payload: { entityId: input.entityId, path: input.path, ...value } },
  ]);
}

export function getDistance(
  from: string,
  to: string,
  topology: ITopology,
): number {
  return topology.distance(from, to);
}

export function checkLineOfSight(
  state: GameState,
  from: string,
  to: string,
  topology: ITopology,
): boolean {
  const board = state.board;
  const isBlocked = (cellId: string) => board?.cells[cellId]?.blocked === true;
  return topology.lineOfSight(from, to, isBlocked);
}
