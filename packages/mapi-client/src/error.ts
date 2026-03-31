/**
 * Structured HTTP error thrown by the Management API client when `throwOnError: true`.
 */
export class ClientError extends Error {
  readonly response: { status: number; statusText: string; data: unknown };

  constructor(
    message: string,
    options: { status: number; statusText: string; data: unknown },
  ) {
    super(message);
    this.name = 'ClientError';
    this.response = {
      status: options.status,
      statusText: options.statusText,
      data: options.data,
    };
  }
}
