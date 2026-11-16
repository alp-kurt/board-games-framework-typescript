import { fail } from "../core/errors.js";
import type { PlayerId } from "../core/ids.js";
import type { IRandomSource } from "../core/random.js";
import { MathRandomSource } from "../core/random.js";
import { ok, type OperationResult } from "../core/result.js";
import type { GameState } from "../core/state.js";

export type AuctionVariant = "english" | "sealed" | "dutch" | "onceAround";

export interface Bid {
  playerId: PlayerId;
  amount: number;
}

export interface AuctionResult {
  winnerId?: PlayerId;
  price: number;
  variant: AuctionVariant;
}

export interface IAuctionStrategy {
  readonly variant: AuctionVariant;
  resolve(
    state: GameState,
    input: RunAuctionInput,
    random: IRandomSource,
  ): OperationResult<GameState, AuctionResult>;
}

export interface RunAuctionInput {
  variant: AuctionVariant;
  bids: Bid[];
  /** Dutch: starting price and decrement. */
  dutchStart?: number;
  dutchDecrement?: number;
  dutchClaimant?: PlayerId;
  /** Once-around: ordered players. */
  order?: PlayerId[];
  itemId?: string;
}

export class EnglishAuction implements IAuctionStrategy {
  readonly variant = "english" as const;

  resolve(
    state: GameState,
    input: RunAuctionInput,
  ): OperationResult<GameState, AuctionResult> {
    if (input.bids.length === 0) {
      return ok(state, { price: 0, variant: this.variant }, [
        { type: "auction.resolved", payload: { winnerId: undefined } },
      ]);
    }
    const winner = [...input.bids].sort((a, b) => b.amount - a.amount)[0]!;
    const value = { winnerId: winner.playerId, price: winner.amount, variant: this.variant };
    return ok(state, value, [{ type: "auction.resolved", payload: value }]);
  }
}

export class SealedBidAuction implements IAuctionStrategy {
  readonly variant = "sealed" as const;

  resolve(
    state: GameState,
    input: RunAuctionInput,
    random: IRandomSource,
  ): OperationResult<GameState, AuctionResult> {
    if (input.bids.length === 0) fail("NO_BIDS", "sealed auction needs bids");
    const sorted = [...input.bids].sort((a, b) => b.amount - a.amount);
    const top = sorted[0]!.amount;
    const tied = sorted.filter((b) => b.amount === top);
    const winner = tied.length === 1 ? tied[0]! : random.pick(tied);
    const value = { winnerId: winner.playerId, price: winner.amount, variant: this.variant };
    return ok(state, value, [{ type: "auction.resolved", payload: value }]);
  }
}

export class DutchAuction implements IAuctionStrategy {
  readonly variant = "dutch" as const;

  resolve(
    state: GameState,
    input: RunAuctionInput,
  ): OperationResult<GameState, AuctionResult> {
    if (!input.dutchClaimant) fail("DUTCH_NO_CLAIMANT", "dutchClaimant required");
    const price = input.dutchStart ?? 0;
    const value = {
      winnerId: input.dutchClaimant,
      price,
      variant: this.variant,
    };
    return ok(state, value, [
      {
        type: "auction.resolved",
        payload: { ...value, decrement: input.dutchDecrement },
      },
    ]);
  }
}

export class OnceAroundAuction implements IAuctionStrategy {
  readonly variant = "onceAround" as const;

  resolve(
    state: GameState,
    input: RunAuctionInput,
  ): OperationResult<GameState, AuctionResult> {
    const order = input.order ?? input.bids.map((b) => b.playerId);
    let best: Bid | undefined;
    for (const pid of order) {
      const bid = input.bids.find((b) => b.playerId === pid);
      if (!bid) continue;
      if (!best || bid.amount > best.amount) best = bid;
    }
    const value: AuctionResult = {
      winnerId: best?.playerId,
      price: best?.amount ?? 0,
      variant: this.variant,
    };
    return ok(state, value, [{ type: "auction.resolved", payload: value }]);
  }
}

const strategies: Record<AuctionVariant, IAuctionStrategy> = {
  english: new EnglishAuction(),
  sealed: new SealedBidAuction(),
  dutch: new DutchAuction(),
  onceAround: new OnceAroundAuction(),
};

export function runAuction(
  state: GameState,
  input: RunAuctionInput,
  strategy?: IAuctionStrategy,
  random: IRandomSource = new MathRandomSource(),
): OperationResult<GameState, AuctionResult> {
  const s = strategy ?? strategies[input.variant];
  return s.resolve(state, input, random);
}
