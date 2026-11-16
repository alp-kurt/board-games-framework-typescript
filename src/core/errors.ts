export class FrameworkError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "FrameworkError";
    this.code = code;
  }
}

export function fail(code: string, message: string): never {
  throw new FrameworkError(code, message);
}
