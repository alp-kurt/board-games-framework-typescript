export interface GameEvent {
  type: string;
  payload?: unknown;
}

export interface OperationResult<TState, TValue = void> {
  state: TState;
  events: GameEvent[];
  value: TValue;
}

export function ok<TState, TValue = void>(
  state: TState,
  value: TValue,
  events: GameEvent[] = [],
): OperationResult<TState, TValue> {
  return { state, events, value };
}

export function okVoid<TState>(
  state: TState,
  events: GameEvent[] = [],
): OperationResult<TState, void> {
  return { state, events, value: undefined };
}
