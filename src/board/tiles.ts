import { fail } from "../core/errors.js";
import type { TileId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import type { BoardCell, GameState } from "../core/state.js";
import { cellKey } from "./topology.js";

export type RotationDeg = 0 | 60 | 90 | 120 | 180 | 240 | 270;

export interface TileEdges {
  /** Edges in order starting north, clockwise. */
  edges: string[];
}

export interface IEdgeMatchValidator {
  canPlace(
    state: GameState,
    tileId: TileId,
    coordinates: { x: number; y: number },
    rotation: RotationDeg,
    tile: TileEdges,
    neighborEdges: Record<string, string | undefined>,
  ): boolean;
}

export class DefaultEdgeMatchValidator implements IEdgeMatchValidator {
  canPlace(
    _state: GameState,
    _tileId: TileId,
    _coordinates: { x: number; y: number },
    _rotation: RotationDeg,
    tile: TileEdges,
    neighborEdges: Record<string, string | undefined>,
  ): boolean {
    // neighborEdges keys: N E S W (or 6 hex dirs); values are neighboring edge types
    const dirs = Object.keys(neighborEdges);
    const rotated = rotateEdges(tile.edges, _rotation);
    for (let i = 0; i < dirs.length; i++) {
      const dir = dirs[i]!;
      const neighbor = neighborEdges[dir];
      if (neighbor === undefined) continue;
      const mine = rotated[i % rotated.length];
      if (mine !== neighbor) return false;
    }
    return true;
  }
}

export function rotateEdges(edges: string[], rotation: RotationDeg): string[] {
  const step =
    edges.length === 6
      ? rotation / 60
      : rotation / 90;
  const n = ((step % edges.length) + edges.length) % edges.length;
  return [...edges.slice(n), ...edges.slice(0, n)];
}

export interface PlaceTileInput {
  tileId: TileId;
  coordinates: { x: number; y: number };
  rotation: RotationDeg;
  tile: TileEdges;
  neighborEdges?: Record<string, string | undefined>;
  terrain?: string;
}

export function placeTile(
  state: GameState,
  input: PlaceTileInput,
  validator: IEdgeMatchValidator = new DefaultEdgeMatchValidator(),
): OperationResult<GameState, string> {
  if (!state.board) fail("BOARD_MISSING", "GameState.board is required");
  const key = cellKey(input.coordinates.x, input.coordinates.y);
  if (state.board.cells[key]?.tileId) {
    fail("CELL_OCCUPIED", `Cell ${key} already has a tile`);
  }
  const okPlace = validator.canPlace(
    state,
    input.tileId,
    input.coordinates,
    input.rotation,
    input.tile,
    input.neighborEdges ?? {},
  );
  if (!okPlace) fail("EDGE_MISMATCH", "Tile edges do not match neighbors");

  const cell: BoardCell = {
    ...(state.board.cells[key] ?? { occupants: [] }),
    tileId: input.tileId,
    terrain: input.terrain,
  };
  const next: GameState = {
    ...state,
    board: {
      ...state.board,
      cells: { ...state.board.cells, [key]: cell },
    },
  };
  return ok(next, key, [
    {
      type: "board.tilePlaced",
      payload: {
        tileId: input.tileId,
        coordinates: input.coordinates,
        rotation: input.rotation,
        cellId: key,
      },
    },
  ]);
}
