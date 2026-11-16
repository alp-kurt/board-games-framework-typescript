import { fail } from "../core/errors.js";
import type { PlayerId } from "../core/ids.js";
import type { IRandomSource } from "../core/random.js";
import { MathRandomSource } from "../core/random.js";
import { ok, type OperationResult } from "../core/result.js";
import { getMeta, setMeta, type GameState } from "../core/state.js";

export interface SecretRole {
  roleId: string;
  team: string;
  winConditionId: string;
}

export interface HiddenRolesState {
  assignments: Record<PlayerId, SecretRole>;
  revealed: Record<PlayerId, boolean>;
}

const ROLES_KEY = "secretRoles";

export function assignSecretRoles(
  state: GameState,
  input: {
    players: PlayerId[];
    roles: SecretRole[];
  },
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, Record<PlayerId, SecretRole>> {
  if (input.roles.length < input.players.length) {
    fail("NOT_ENOUGH_ROLES", "Need at least one role per player");
  }
  const shuffled = random.shuffle(input.roles);
  const assignments: Record<PlayerId, SecretRole> = {};
  const revealed: Record<PlayerId, boolean> = {};
  input.players.forEach((p, i) => {
    assignments[p] = shuffled[i]!;
    revealed[p] = false;
  });
  const next = setMeta(state, ROLES_KEY, { assignments, revealed } satisfies HiddenRolesState);
  return ok(next, assignments, [
    { type: "roles.assigned", payload: { players: input.players } },
  ]);
}

export function checkWinCondition(
  state: GameState,
  input: {
    conditionId: string;
    evaluate: (state: GameState, assignments: Record<PlayerId, SecretRole>) => PlayerId[];
  },
): OperationResult<GameState, PlayerId[]> {
  const roles = getMeta<HiddenRolesState | undefined>(state, ROLES_KEY, undefined);
  if (!roles) fail("ROLES_UNSET", "assignSecretRoles first");
  const winners = input.evaluate(state, roles.assignments);
  return ok(state, winners, [
    {
      type: "roles.winChecked",
      payload: { conditionId: input.conditionId, winners },
    },
  ]);
}

export function getRoleForPlayer(
  state: GameState,
  playerId: PlayerId,
  viewerId: PlayerId,
): SecretRole | undefined {
  const roles = getMeta<HiddenRolesState | undefined>(state, ROLES_KEY, undefined);
  if (!roles) return undefined;
  if (playerId === viewerId || roles.revealed[playerId]) {
    return roles.assignments[playerId];
  }
  return undefined;
}
