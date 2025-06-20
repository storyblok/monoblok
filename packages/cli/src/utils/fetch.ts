export class FetchError extends Error {
  response: {
    status: number;
    statusText: string;
    data?: Record<string, unknown> | null;
  };

  constructor(message: string, response: { status: number; statusText: string; data?: Record<string, unknown> | null }) {
    super(message);
    this.name = 'FetchError';
    this.response = response;
  }
}

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface FetchOptions {
  headers?: Record<string, string>;
  method?: string;
  body?: any;
  maxRetries?: number;
  baseDelay?: number;
}

export async function customFetch<T>(url: string, options: FetchOptions = {}): Promise<T & { perPage: number; total: number }> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelay ?? 500; // 500ms base delay
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      // Handle JSON body
      const fetchOptions: FetchOptions = {
        ...options,
        headers,
      };

      if (options.body) {
        fetchOptions.body = typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body);
      }

      const response = await fetch(url, fetchOptions);
      let data;
      try {
        // We try to parse the response as JSON
        data = await response.json();
      }
      catch {
        // If it fails, we throw an error
        throw new FetchError(`Non-JSON response`, {
          status: response.status,
          statusText: response.statusText,
          data: null,
        });
      }

      if (!response.ok) {
        // If we hit rate limit and have retries left
        if ((response.status === 429) && (attempt < maxRetries)) {
          const waitTime = baseDelay * 2 ** attempt;
          await delay(waitTime);
          attempt++;
          continue;
        }

        throw new FetchError(`HTTP error! status: ${response.status}`, {
          status: response.status,
          statusText: response.statusText,
          data,
        });
      }

      return {
        ...data,
        perPage: Number(response.headers.get('Per-Page')),
        total: Number(response.headers.get('Total')),
      };
    }
    catch (error) {
      if (error instanceof FetchError) {
        throw error;
      }
      // For network errors or other non-HTTP errors, create a FetchError
      throw new FetchError(error instanceof Error ? error.message : String(error), {
        status: 0,
        statusText: 'Network Error',
        data: null,
      });
    }
  }

  throw new FetchError('Max retries exceeded', {
    status: 429,
    statusText: 'Rate Limit Exceeded',
    data: null,
  });
}
