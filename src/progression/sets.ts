import { ok, type OperationResult } from "../core/result.js";
import type { GameState } from "../core/state.js";

export type SetMatcher =
  | { type: "nOfKind"; attribute: string; n: number; points: number }
  | { type: "run"; attribute: string; length: number; points: number }
  | { type: "oneOfEach"; attribute: string; values: string[]; points: number };

export interface EvaluateSetsInput {
  items: Array<Record<string, unknown>>;
  matchers: SetMatcher[];
}

export interface SetScore {
  matcher: SetMatcher;
  matched: boolean;
  points: number;
}

export function evaluateSets(
  state: GameState,
  input: EvaluateSetsInput,
): OperationResult<GameState, { scores: SetScore[]; total: number }> {
  const scores: SetScore[] = input.matchers.map((matcher) => {
    if (matcher.type === "nOfKind") {
      const counts = new Map<string, number>();
      for (const item of input.items) {
        const v = String(item[matcher.attribute] ?? "");
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      const matched = [...counts.values()].some((c) => c >= matcher.n);
      return { matcher, matched, points: matched ? matcher.points : 0 };
    }
    if (matcher.type === "run") {
      const nums = input.items
        .map((i) => Number(i[matcher.attribute]))
        .filter((n) => !Number.isNaN(n))
        .sort((a, b) => a - b);
      const uniq = [...new Set(nums)];
      let best = 1;
      let cur = 1;
      for (let i = 1; i < uniq.length; i++) {
        if (uniq[i] === uniq[i - 1]! + 1) {
          cur++;
          best = Math.max(best, cur);
        } else cur = 1;
      }
      const matched = best >= matcher.length;
      return { matcher, matched, points: matched ? matcher.points : 0 };
    }
    // oneOfEach
    const have = new Set(input.items.map((i) => String(i[matcher.attribute] ?? "")));
    const matched = matcher.values.every((v) => have.has(v));
    return { matcher, matched, points: matched ? matcher.points : 0 };
  });
  const total = scores.reduce((s, x) => s + x.points, 0);
  return ok(state, { scores, total }, [
    { type: "sets.evaluated", payload: { total, scores } },
  ]);
}
