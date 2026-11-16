import { fail } from "../core/errors.js";
import type { PoolId } from "../core/ids.js";
import type { IRandomSource } from "../core/random.js";
import { MathRandomSource } from "../core/random.js";
import { ok, type OperationResult } from "../core/result.js";
import {
  getMeta,
  setMeta,
  type GameState,
} from "../core/state.js";

export interface TokenPool {
  id: PoolId;
  tokens: string[];
  discard: string[];
  reshuffleWhenEmpty?: boolean;
}

export interface DrawFromPoolInput {
  poolId: PoolId;
  drawCount: number;
  replaceAfterDraw?: boolean;
}

const POOLS_KEY = "tokenPools";

export function ensurePool(
  state: GameState,
  pool: TokenPool,
): GameState {
  const pools = getMeta<Record<PoolId, TokenPool>>(state, POOLS_KEY, {});
  return setMeta(state, POOLS_KEY, { ...pools, [pool.id]: { ...pool, discard: [...pool.discard], tokens: [...pool.tokens] } });
}

export function getPool(state: GameState, poolId: PoolId): TokenPool {
  const pools = getMeta<Record<PoolId, TokenPool>>(state, POOLS_KEY, {});
  const pool = pools[poolId];
  if (!pool) fail("POOL_NOT_FOUND", `Pool ${poolId} not found`);
  return pool;
}

export function drawFromPool(
  state: GameState,
  input: DrawFromPoolInput,
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, string[]> {
  if (input.drawCount < 1) fail("INVALID_DRAW_COUNT", "drawCount must be >= 1");

  let pools = { ...getMeta<Record<PoolId, TokenPool>>(state, POOLS_KEY, {}) };
  let pool = pools[input.poolId];
  if (!pool) fail("POOL_NOT_FOUND", `Pool ${input.poolId} not found`);

  let tokens = [...pool.tokens];
  let discard = [...pool.discard];
  const drawn: string[] = [];

  for (let i = 0; i < input.drawCount; i++) {
    if (tokens.length === 0) {
      if (pool.reshuffleWhenEmpty && discard.length > 0) {
        tokens = random.shuffle(discard);
        discard = [];
      } else {
        fail("POOL_EMPTY", `Pool ${input.poolId} has no tokens left`);
      }
    }
    const idx = random.nextInt(0, tokens.length);
    const token = tokens.splice(idx, 1)[0]!;
    drawn.push(token);
    if (input.replaceAfterDraw) {
      tokens.push(token);
    } else {
      discard.push(token);
    }
  }

  pools = {
    ...pools,
    [input.poolId]: { ...pool, tokens, discard },
  };
  const next = setMeta(state, POOLS_KEY, pools);
  return ok(next, drawn, [{ type: "pool.drawn", payload: { poolId: input.poolId, drawn } }]);
}
