import type { PlayerId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import type { GameState } from "../core/state.js";
import { getResource } from "../economy/resources.js";

export type EndTrigger =
  | { type: "emptySupply"; zoneId: string }
  | { type: "vpThreshold"; resourceId: string; threshold: number }
  | { type: "roundLimit"; roundKey: string; limit: number }
  | { type: "playerElimination"; aliveKey?: string };

export interface EndTriggerResult {
  triggered: boolean;
  reasons: EndTrigger[];
}

export function checkEndTriggers(
  state: GameState,
  triggers: EndTrigger[],
): OperationResult<GameState, EndTriggerResult> {
  const reasons: EndTrigger[] = [];
  for (const t of triggers) {
    if (t.type === "emptySupply") {
      const zone = state.zones[t.zoneId];
      if (zone && zone.cards.length === 0) reasons.push(t);
    } else if (t.type === "vpThreshold") {
      const hit = state.players.some(
        (p) => getResource(state, p, t.resourceId) >= t.threshold,
      );
      if (hit) reasons.push(t);
    } else if (t.type === "roundLimit") {
      const round = Number(state.meta[t.roundKey] ?? 0);
      if (round >= t.limit) reasons.push(t);
    } else if (t.type === "playerElimination") {
      const alive = (state.meta[t.aliveKey ?? "alive"] as PlayerId[] | undefined) ?? state.players;
      if (alive.length <= 1) reasons.push(t);
    }
  }
  const value = { triggered: reasons.length > 0, reasons };
  return ok(state, value, [{ type: "game.endChecked", payload: value }]);
}

export interface ScoreRule {
  resourceId?: string;
  /** Custom points from evaluator. */
  pointsForPlayer?: (state: GameState, playerId: PlayerId) => number;
}

export function calculateFinalScore(
  state: GameState,
  rules: ScoreRule[],
): OperationResult<GameState, Record<PlayerId, number>> {
  const scores: Record<PlayerId, number> = {};
  for (const p of state.players) {
    let total = 0;
    for (const rule of rules) {
      if (rule.resourceId) total += getResource(state, p, rule.resourceId);
      if (rule.pointsForPlayer) total += rule.pointsForPlayer(state, p);
    }
    scores[p] = total;
  }
  return ok(state, scores, [{ type: "game.scored", payload: scores }]);
}
