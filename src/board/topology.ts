import { fail } from "../core/errors.js";

export interface ITopology {
  readonly kind: "square" | "hex" | "graph" | "area";
  neighbors(cellId: string): string[];
  distance(a: string, b: string): number;
  lineOfSight(from: string, to: string, isBlocked: (cellId: string) => boolean): boolean;
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseCellKey(key: string): { x: number; y: number } {
  const [xs, ys] = key.split(",");
  return { x: Number(xs), y: Number(ys) };
}

export class SquareGrid implements ITopology {
  readonly kind = "square" as const;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly diagonal = false,
  ) {}

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  neighbors(cellId: string): string[] {
    const { x, y } = parseCellKey(cellId);
    const deltas = this.diagonal
      ? [
          [-1, -1], [0, -1], [1, -1],
          [-1, 0], [1, 0],
          [-1, 1], [0, 1], [1, 1],
        ]
      : [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const result: string[] = [];
    for (const [dx, dy] of deltas) {
      const nx = x + dx!;
      const ny = y + dy!;
      if (this.inBounds(nx, ny)) result.push(cellKey(nx, ny));
    }
    return result;
  }

  distance(a: string, b: string): number {
    const A = parseCellKey(a);
    const B = parseCellKey(b);
    const dx = Math.abs(A.x - B.x);
    const dy = Math.abs(A.y - B.y);
    return this.diagonal ? Math.max(dx, dy) : dx + dy;
  }

  lineOfSight(from: string, to: string, isBlocked: (cellId: string) => boolean): boolean {
    const A = parseCellKey(from);
    const B = parseCellKey(to);
    const dx = Math.sign(B.x - A.x);
    const dy = Math.sign(B.y - A.y);
    let x = A.x;
    let y = A.y;
    const steps = this.distance(from, to);
    for (let i = 0; i < steps - 1; i++) {
      x += dx;
      y += dy;
      const key = cellKey(x, y);
      if (isBlocked(key)) return false;
    }
    return true;
  }
}

/** Axial hex grid. */
export class HexGrid implements ITopology {
  readonly kind = "hex" as const;

  constructor(
    readonly radius: number,
  ) {}

  private inBounds(q: number, r: number): boolean {
    return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)) <= this.radius;
  }

  neighbors(cellId: string): string[] {
    const { x: q, y: r } = parseCellKey(cellId);
    const deltas = [
      [1, 0], [1, -1], [0, -1],
      [-1, 0], [-1, 1], [0, 1],
    ];
    const result: string[] = [];
    for (const [dq, dr] of deltas) {
      const nq = q + dq!;
      const nr = r + dr!;
      if (this.inBounds(nq, nr)) result.push(cellKey(nq, nr));
    }
    return result;
  }

  distance(a: string, b: string): number {
    const A = parseCellKey(a);
    const B = parseCellKey(b);
    return (
      (Math.abs(A.x - B.x) +
        Math.abs(A.x + A.y - B.x - B.y) +
        Math.abs(A.y - B.y)) /
      2
    );
  }

  lineOfSight(from: string, to: string, isBlocked: (cellId: string) => boolean): boolean {
    // cube lerp sampling along hex line
    const A = parseCellKey(from);
    const B = parseCellKey(to);
    const n = this.distance(from, to);
    if (n === 0) return true;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const q = Math.round(A.x + (B.x - A.x) * t);
      const r = Math.round(A.y + (B.y - A.y) * t);
      const key = cellKey(q, r);
      if (key !== from && key !== to && isBlocked(key)) return false;
    }
    return true;
  }
}

export class PointGraph implements ITopology {
  readonly kind = "graph" as const;

  constructor(private readonly adjacency: Record<string, string[]>) {}

  neighbors(cellId: string): string[] {
    return [...(this.adjacency[cellId] ?? [])];
  }

  distance(a: string, b: string): number {
    if (a === b) return 0;
    const queue = [a];
    const dist = new Map<string, number>([[a, 0]]);
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of this.neighbors(cur)) {
        if (dist.has(n)) continue;
        dist.set(n, (dist.get(cur) ?? 0) + 1);
        if (n === b) return dist.get(n)!;
        queue.push(n);
      }
    }
    fail("UNREACHABLE", `${a} cannot reach ${b}`);
  }

  lineOfSight(from: string, to: string, isBlocked: (cellId: string) => boolean): boolean {
    // On a graph, LoS means a path of length 1 or an unblocked shortest path of intermediate nodes
    if (this.neighbors(from).includes(to)) return true;
    try {
      const d = this.distance(from, to);
      // BFS reconstruct rough check: every neighbor step must not be blocked except endpoints
      const queue = [from];
      const prev = new Map<string, string | null>([[from, null]]);
      while (queue.length) {
        const cur = queue.shift()!;
        if (cur === to) break;
        for (const n of this.neighbors(cur)) {
          if (prev.has(n)) continue;
          if (n !== to && isBlocked(n)) continue;
          prev.set(n, cur);
          queue.push(n);
        }
      }
      if (!prev.has(to)) return false;
      let node: string | null | undefined = to;
      let hops = 0;
      while (node && node !== from) {
        hops++;
        node = prev.get(node) ?? null;
      }
      return hops === d;
    } catch {
      return false;
    }
  }
}

export class AreaMap implements ITopology {
  readonly kind = "area" as const;

  constructor(private readonly adjacency: Record<string, string[]>) {}

  neighbors(cellId: string): string[] {
    return [...(this.adjacency[cellId] ?? [])];
  }

  distance(a: string, b: string): number {
    return new PointGraph(this.adjacency).distance(a, b);
  }

  lineOfSight(from: string, to: string, isBlocked: (cellId: string) => boolean): boolean {
    return this.neighbors(from).includes(to) || (!isBlocked(from) && this.neighbors(from).some((n) => n === to));
  }
}
