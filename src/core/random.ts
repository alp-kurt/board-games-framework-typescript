export interface IRandomSource {
  nextFloat(): number;
  nextInt(minInclusive: number, maxExclusive: number): number;
  shuffle<T>(items: readonly T[]): T[];
  pick<T>(items: readonly T[]): T;
}

export class MathRandomSource implements IRandomSource {
  nextFloat(): number {
    return Math.random();
  }

  nextInt(minInclusive: number, maxExclusive: number): number {
    if (maxExclusive <= minInclusive) {
      throw new RangeError("maxExclusive must be greater than minInclusive");
    }
    return minInclusive + Math.floor(this.nextFloat() * (maxExclusive - minInclusive));
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      const tmp = result[i]!;
      result[i] = result[j]!;
      result[j] = tmp;
    }
    return result;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("Cannot pick from empty array");
    return items[this.nextInt(0, items.length)]!;
  }
}

/** Deterministic LCG for tests. */
export class SeededRandomSource implements IRandomSource {
  private state: number;

  constructor(seed = 1) {
    this.state = seed >>> 0 || 1;
  }

  nextFloat(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(minInclusive: number, maxExclusive: number): number {
    if (maxExclusive <= minInclusive) {
      throw new RangeError("maxExclusive must be greater than minInclusive");
    }
    return minInclusive + Math.floor(this.nextFloat() * (maxExclusive - minInclusive));
  }

  shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      const tmp = result[i]!;
      result[i] = result[j]!;
      result[j] = tmp;
    }
    return result;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("Cannot pick from empty array");
    return items[this.nextInt(0, items.length)]!;
  }
}
