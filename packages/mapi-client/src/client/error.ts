export class ClientError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly data: unknown;
  readonly response: { status: number; statusText: string; data: unknown };

  constructor(message: string, options: {
    status: number;
    statusText: string;
    data: unknown;
  }) {
    super(message);
    this.name = 'ClientError';
    this.status = options.status;
    this.statusText = options.statusText;
    this.data = options.data;
    this.response = { status: options.status, statusText: options.statusText, data: options.data };
  }
}
