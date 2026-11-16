import type { EntityId, PlayerId, ResourceId, ZoneId } from "./ids.js";

export type EntityAttrs = Record<string, unknown>;

export interface Entity {
  id: EntityId;
  owner?: PlayerId;
  attrs: EntityAttrs;
}

export type ZonePosition = "top" | "bottom" | "random";

export interface Zone {
  id: ZoneId;
  /** Index 0 = top / front of pile. */
  cards: EntityId[];
  faceUp?: boolean;
}

export interface BoardCell {
  terrain?: string;
  tileId?: string;
  occupants: EntityId[];
  influence?: Record<PlayerId, number>;
  blocked?: boolean;
}

export interface BoardEdge {
  a: string;
  b: string;
  cost?: number;
}

export interface BoardState {
  kind: "square" | "hex" | "graph" | "area";
  cells: Record<string, BoardCell>;
  edges?: BoardEdge[];
  entityPositions?: Record<EntityId, string>;
}

export interface GameState {
  players: PlayerId[];
  entities: Record<EntityId, Entity>;
  zones: Record<ZoneId, Zone>;
  resources: Record<PlayerId, Record<ResourceId, number>>;
  board?: BoardState;
  meta: Record<string, unknown>;
}

export function createGameState(players: PlayerId[] = []): GameState {
  const resources: GameState["resources"] = {};
  for (const p of players) resources[p] = {};
  return {
    players: [...players],
    entities: {},
    zones: {},
    resources,
    meta: {},
  };
}

export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

export function ensureZone(state: GameState, zoneId: ZoneId, faceUp = false): Zone {
  const existing = state.zones[zoneId];
  if (existing) return existing;
  return { id: zoneId, cards: [], faceUp };
}

export function withZone(state: GameState, zone: Zone): GameState {
  return {
    ...state,
    zones: { ...state.zones, [zone.id]: zone },
  };
}

export function withEntity(state: GameState, entity: Entity): GameState {
  return {
    ...state,
    entities: { ...state.entities, [entity.id]: entity },
  };
}

export function getMeta<T>(state: GameState, key: string, fallback: T): T {
  const v = state.meta[key];
  return (v === undefined ? fallback : v) as T;
}

export function setMeta(state: GameState, key: string, value: unknown): GameState {
  return { ...state, meta: { ...state.meta, [key]: value } };
}
