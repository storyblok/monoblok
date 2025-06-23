/**
 * Interface representing an HTTP response error
 */
export interface ResponseError extends Error {
  response?: {
    status: number;
    statusText: string;
    data?: any;
  };
}
