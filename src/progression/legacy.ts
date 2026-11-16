import { ok, type OperationResult } from "../core/result.js";
import type { GameState } from "../core/state.js";

export interface LegacyPatch {
  /** JSON-patch-like shallow ops for serializable persistence across sessions. */
  setMeta?: Record<string, unknown>;
  removeMeta?: string[];
  setEntityAttrs?: Record<string, Record<string, unknown>>;
  setResources?: Record<string, Record<string, number>>;
}

export function mutateGameState(
  state: GameState,
  patch: LegacyPatch,
): OperationResult<GameState, LegacyPatch> {
  let next: GameState = {
    ...state,
    meta: { ...state.meta },
    entities: { ...state.entities },
    resources: { ...state.resources },
  };
  if (patch.setMeta) {
    next = { ...next, meta: { ...next.meta, ...patch.setMeta } };
  }
  if (patch.removeMeta) {
    const meta = { ...next.meta };
    for (const k of patch.removeMeta) delete meta[k];
    next = { ...next, meta };
  }
  if (patch.setEntityAttrs) {
    const entities = { ...next.entities };
    for (const [id, attrs] of Object.entries(patch.setEntityAttrs)) {
      const e = entities[id];
      if (!e) continue;
      entities[id] = { ...e, attrs: { ...e.attrs, ...attrs } };
    }
    next = { ...next, entities };
  }
  if (patch.setResources) {
    const resources = { ...next.resources };
    for (const [pid, ledger] of Object.entries(patch.setResources)) {
      resources[pid] = { ...(resources[pid] ?? {}), ...ledger };
    }
    next = { ...next, resources };
  }
  return ok(next, patch, [{ type: "legacy.mutated", payload: patch }]);
}
