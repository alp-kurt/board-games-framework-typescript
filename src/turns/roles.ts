import { fail } from "../core/errors.js";
import type { PlayerId, RoleId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import { getMeta, setMeta, type GameState } from "../core/state.js";

export interface RoleCard {
  id: RoleId;
  name: string;
}

export interface RoleSelectionState {
  pool: RoleCard[];
  selected: Record<PlayerId, RoleId>;
  followerStrength: "full" | "weak";
}

const ROLES_KEY = "roleSelection";

export function setRolePool(state: GameState, pool: RoleCard[]): GameState {
  return setMeta(state, ROLES_KEY, {
    pool: [...pool],
    selected: {},
    followerStrength: "weak",
  } satisfies RoleSelectionState);
}

export function selectRole(
  state: GameState,
  input: {
    playerId: PlayerId;
    roleId: RoleId;
    /** If true, other players may follow with weaker effect. */
    enableFollow?: boolean;
  },
): OperationResult<GameState, { role: RoleCard; followAllowed: boolean }> {
  const rs = getMeta<RoleSelectionState | undefined>(state, ROLES_KEY, undefined);
  if (!rs) fail("ROLE_POOL_UNSET", "Call setRolePool first");
  const idx = rs.pool.findIndex((r) => r.id === input.roleId);
  if (idx < 0) fail("ROLE_UNAVAILABLE", `Role ${input.roleId} not in pool`);
  const role = rs.pool[idx]!;
  const pool = rs.pool.filter((_, i) => i !== idx);
  const next: RoleSelectionState = {
    ...rs,
    pool,
    selected: { ...rs.selected, [input.playerId]: role.id },
    followerStrength: input.enableFollow === false ? "full" : "weak",
  };
  return ok(setMeta(state, ROLES_KEY, next), {
    role,
    followAllowed: input.enableFollow !== false,
  }, [
    {
      type: "role.selected",
      payload: {
        playerId: input.playerId,
        roleId: role.id,
        followAllowed: input.enableFollow !== false,
      },
    },
  ]);
}
