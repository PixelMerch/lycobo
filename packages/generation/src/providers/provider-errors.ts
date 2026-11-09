/** Shared outcome semantics across image gateways; never includes an upstream response body. */
export class ImageProviderError extends Error {
  constructor(
    readonly code: string,
    readonly unknownOutcome: boolean,
    readonly requestId?: string | undefined,
  ) {
    super(code);
  }
}
