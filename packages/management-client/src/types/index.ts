import type { RegionCode } from '../utils/region';

/**
 * Configuration options for creating a Storyblok Management Client instance
 */
export interface StoryblokManagementClientOptions {
  /**
   * Your Storyblok Management API token
   * @example "sb-12345-abcdef..."
   */
  token: string;

  /**
   * Storyblok region for API requests
   * @default "eu"
   * @example "us" | "eu" | "cn" | "ca" | "ap"
   */
  region?: RegionCode;

  /**
   * Enable verbose logging for successful requests
   * @default false
   */
  verbose?: boolean;
}

/**
 * Internal state management for the Management Client instance
 * @internal
 */
export interface StoryblokManagementClientState {
  /** Current authentication token */
  token: string | null;

  /** Default headers for all requests */
  headers: Record<string, string>;

  /** Current region setting */
  region?: RegionCode;

  /** Base URL for the current region */
  url: string;

  /** Whether verbose logging is enabled */
  verbose?: boolean;
}

/**
 * Storyblok Management Client instance with all available methods
 */
export interface StoryblokManagementClient {
  /**
   * Unique identifier for this client instance
   * @example "management-client-abc123def456"
   */
  uuid: string;

  /**
   * Re-initialize the client with new options
   * @param clientOptions - New configuration options
   */
  init: (clientOptions: StoryblokManagementClientOptions) => void;

  /**
   * Make a generic HTTP request to the Management API
   * @template T - Expected response data type
   * @param path - API endpoint path (without base URL)
   * @param fetchOptions - Optional fetch configuration
   * @returns Promise with response data and metadata
   * @example
   * ```typescript
   * const response = await client.request<Space>('spaces/12345');
   * console.log(response.data.name);
   * ```
   */
  request: <T>(path: string, fetchOptions?: FetchOptions) => Promise<GetResponse<T>>;

  /**
   * Make a GET request to the Management API
   * @template T - Expected response data type
   * @param path - API endpoint path
   * @param fetchOptions - Optional fetch configuration
   * @returns Promise with response data and metadata
   * @example
   * ```typescript
   * const space = await client.get<Space>('spaces/12345');
   * ```
   */
  get: <T>(path: string, fetchOptions?: FetchOptions) => Promise<GetResponse<T>>;

  /**
   * Make a POST request to the Management API
   * @template T - Expected response data type
   * @param path - API endpoint path
   * @param fetchOptions - Optional fetch configuration
   * @returns Promise with response data and metadata
   * @example
   * ```typescript
   * const newStory = await client.post<Story>('spaces/12345/stories', {
   *   body: JSON.stringify({ story: { name: 'New Story' } })
   * });
   * ```
   */
  post: <T>(path: string, fetchOptions?: FetchOptions) => Promise<GetResponse<T>>;

  /**
   * Make a PUT request to the Management API
   * @template T - Expected response data type
   * @param path - API endpoint path
   * @param fetchOptions - Optional fetch configuration
   * @returns Promise with response data and metadata
   * @example
   * ```typescript
   * const updatedStory = await client.put<Story>('spaces/12345/stories/67890', {
   *   body: JSON.stringify({ story: { name: 'Updated Story' } })
   * });
   * ```
   */
  put: <T>(path: string, fetchOptions?: FetchOptions) => Promise<GetResponse<T>>;
}

/**
 * Response wrapper for Management API requests
 * @template T - Type of the response data
 */
export interface GetResponse<T> {
  /** The actual response data from the API */
  data: T;

  /** Number of attempts made for this request (for retry logic) */
  attempt: number;
}

/**
 * Options for customizing HTTP requests to the Management API
 */
export interface FetchOptions {
  /**
   * Additional headers to include in the request
   * These will be merged with the default headers (Authorization, Content-Type)
   * @example { "X-Custom-Header": "value" }
   */
  headers?: Record<string, string>;

  /**
   * HTTP method for the request
   * @default "GET"
   * @example "POST" | "PUT" | "DELETE"
   */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';

  /**
   * Request body data
   * Usually a JSON string for POST/PUT requests
   * @example JSON.stringify({ story: { name: "My Story" } })
   */
  body?: any;

  /**
   * Maximum number of retry attempts on failure
   * @default 1
   * @deprecated Not yet implemented
   */
  maxRetries?: number;

  /**
   * Base delay in milliseconds between retries
   * @default 1000
   * @deprecated Not yet implemented
   */
  baseDelay?: number;
}
