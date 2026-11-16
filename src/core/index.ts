export type {
  EntityId,
  PlayerId,
  ZoneId,
  ResourceId,
  NodeId,
  TileId,
  PoolId,
  TrackId,
  RoleId,
  WorkerId,
} from "./ids.js";

export { FrameworkError, fail } from "./errors.js";
export type { GameEvent, OperationResult } from "./result.js";
export { ok, okVoid } from "./result.js";
export type { IRandomSource } from "./random.js";
export { MathRandomSource, SeededRandomSource } from "./random.js";
export type {
  Entity,
  EntityAttrs,
  Zone,
  ZonePosition,
  BoardCell,
  BoardEdge,
  BoardState,
  GameState,
} from "./state.js";
export {
  createGameState,
  cloneState,
  ensureZone,
  withZone,
  withEntity,
  getMeta,
  setMeta,
} from "./state.js";
