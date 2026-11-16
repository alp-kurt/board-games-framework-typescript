import { fail } from "../core/errors.js";
import type { NodeId, PlayerId, WorkerId } from "../core/ids.js";
import { ok, type OperationResult } from "../core/result.js";
import { getMeta, setMeta, type GameState } from "../core/state.js";

export interface WorkerToken {
  id: WorkerId;
  playerId: PlayerId;
  type: string;
  nodeId?: NodeId;
}

export interface WorkerBoardState {
  workers: Record<WorkerId, WorkerToken>;
  nodes: Record<NodeId, WorkerId[]>;
}

const WORKERS_KEY = "workerPlacement";

function read(state: GameState): WorkerBoardState {
  return getMeta(state, WORKERS_KEY, { workers: {}, nodes: {} });
}

export function registerWorkers(
  state: GameState,
  workers: WorkerToken[],
): GameState {
  const board = read(state);
  const nextWorkers = { ...board.workers };
  for (const w of workers) nextWorkers[w.id] = { ...w };
  return setMeta(state, WORKERS_KEY, { ...board, workers: nextWorkers });
}

export function placeWorker(
  state: GameState,
  input: {
    workerId: WorkerId;
    nodeId: NodeId;
    allowSharedSpace?: boolean;
  },
): OperationResult<GameState, WorkerToken> {
  const board = read(state);
  const worker = board.workers[input.workerId];
  if (!worker) fail("WORKER_NOT_FOUND", `Worker ${input.workerId} missing`);
  if (worker.nodeId) fail("WORKER_ALREADY_PLACED", "Recall before placing again");

  const occupants = board.nodes[input.nodeId] ?? [];
  if (!input.allowSharedSpace && occupants.length > 0) {
    fail("NODE_OCCUPIED", `Node ${input.nodeId} is occupied`);
  }

  const updated: WorkerToken = { ...worker, nodeId: input.nodeId };
  const next: WorkerBoardState = {
    workers: { ...board.workers, [input.workerId]: updated },
    nodes: {
      ...board.nodes,
      [input.nodeId]: [...occupants, input.workerId],
    },
  };
  return ok(setMeta(state, WORKERS_KEY, next), updated, [
    {
      type: "worker.placed",
      payload: { workerId: input.workerId, nodeId: input.nodeId, type: worker.type },
    },
  ]);
}

export function recallWorkers(
  state: GameState,
  playerId?: PlayerId,
): OperationResult<GameState, WorkerId[]> {
  const board = read(state);
  const recalled: WorkerId[] = [];
  const workers: Record<WorkerId, WorkerToken> = {};
  for (const [id, w] of Object.entries(board.workers)) {
    if (playerId && w.playerId !== playerId) {
      workers[id] = w;
      continue;
    }
    if (w.nodeId) recalled.push(id);
    workers[id] = { ...w, nodeId: undefined };
  }
  const nodes: Record<NodeId, WorkerId[]> = {};
  for (const [nodeId, list] of Object.entries(board.nodes)) {
    const remaining = list.filter((id) => workers[id]?.nodeId === nodeId);
    if (remaining.length) nodes[nodeId] = remaining;
  }
  return ok(setMeta(state, WORKERS_KEY, { workers, nodes }), recalled, [
    { type: "worker.recalled", payload: { recalled, playerId } },
  ]);
}
