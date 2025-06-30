import type { FetchOptions, GetResponse, StoryblokManagementClient, StoryblokManagementClientOptions, StoryblokManagementClientState } from './types';
import { getManagementApiUrl } from './utils/region';

// Singleton instance for managementClient function
let singletonInstance: StoryblokManagementClient | null = null;

/**
 * Creates a new management client instance every time it's called
 *
 * Use this function when you need multiple client instances with different configurations
 * or when you want to ensure you get a fresh instance each time.
 *
 * @param clientOptions - Configuration options for the client
 * @returns A new StoryblokManagementClient instance with unique UUID
 *
 * @example
 * ```typescript
 * // Create different instances for different spaces/tokens
 * const client1 = createManagementClient({
 *   token: 'token-for-space-1',
 *   region: 'eu',
 *   verbose: true
 * });
 *
 * const client2 = createManagementClient({
 *   token: 'token-for-space-2',
 *   region: 'us'
 * });
 *
 * console.log(client1.uuid !== client2.uuid); // true
 * ```
 *
 * @throws {Error} When token is missing or invalid
 */
export const createManagementClient = (clientOptions: StoryblokManagementClientOptions): StoryblokManagementClient => {
  if (!clientOptions?.token) {
    throw new Error('Management API Client requires an access token for initialization');
  }

  const state: StoryblokManagementClientState = {
    token: null,
    headers: {},
    url: getManagementApiUrl(clientOptions.region || 'eu'),
    region: clientOptions.region || 'eu',
  };

  /**
   * Make a generic HTTP request to the Storyblok Management API
   *
   * This is the core method that all other HTTP methods (get, post, put) use internally.
   * It handles authentication, headers, and response parsing automatically.
   *
   * @template T - Expected type of the response data
   * @param path - API endpoint path (relative to the base URL)
   * @param fetchOptions - Optional configuration for the request
   * @returns Promise resolving to response data with metadata
   *
   * @example
   * ```typescript
   * // GET request
   * const space = await client.request<Space>('spaces/123456');
   *
   * // POST request
   * const newStory = await client.request<Story>('spaces/123456/stories', {
   *   method: 'POST',
   *   body: JSON.stringify({
   *     story: {
   *       name: 'My New Story',
   *       slug: 'my-new-story'
   *     }
   *   })
   * });
   *
   * // Custom headers
   * const response = await client.request('spaces/123456/stories', {
   *   headers: {
   *     'X-Custom-Header': 'value'
   *   }
   * });
   * ```
   *
   * @throws {Error} When the response is not valid JSON
   * @throws {Error} When the request fails (non-2xx status code)
   */
  const request = async <T>(path: string, fetchOptions?: FetchOptions): Promise<GetResponse<T>> => {
    const { headers, method, body } = fetchOptions || {};

    const requestData = {
      path,
      method: method || 'GET',
      headers: {
        ...state.headers,
        ...headers,
      },
      body,
    };

    const res = await fetch(`${state.url}/${path}`, {
      ...fetchOptions,
      headers: requestData.headers as HeadersInit,
    });

    let data;
    try {
      data = await res.json();
    }
    catch {
      throw new Error('Non-JSON response');
    }

    if (res.ok) {
      if (clientOptions?.verbose) {
        // eslint-disable-next-line no-console
        console.log(`✅ ${path}`);
      }
      return {
        data,
        attempt: 1,
      };
    }
    else {
      throw new Error('Request failed');
    }
  };

  /**
   * Make a GET request to the Storyblok Management API
   *
   * Convenience method for GET requests. This is equivalent to calling
   * `request()` without specifying a method.
   *
   * @template T - Expected type of the response data
   * @param path - API endpoint path
   * @param fetchOptions - Optional configuration (method will be ignored)
   * @returns Promise resolving to response data with metadata
   *
   * @example
   * ```typescript
   * // Get a space
   * const space = await client.get<Space>('spaces/123456');
   *
   * // Get stories with custom headers
   * const stories = await client.get<StoriesResponse>('spaces/123456/stories', {
   *   headers: {
   *     'X-Custom-Header': 'value'
   *   }
   * });
   * ```
   */
  const get = async <T>(path: string, fetchOptions?: FetchOptions): Promise<GetResponse<T>> => {
    return request<T>(path, fetchOptions);
  };

  /**
   * Make a POST request to the Storyblok Management API
   *
   * Convenience method for POST requests. The method is automatically set to 'POST'.
   *
   * @template T - Expected type of the response data
   * @param path - API endpoint path
   * @param fetchOptions - Optional configuration (method will be overridden to 'POST')
   * @returns Promise resolving to response data with metadata
   *
   * @example
   * ```typescript
   * // Create a new story
   * const newStory = await client.post<Story>('spaces/123456/stories', {
   *   body: JSON.stringify({
   *     story: {
   *       name: 'My New Story',
   *       slug: 'my-new-story',
   *       content: {
   *         component: 'page',
   *         body: []
   *       }
   *     }
   *   })
   * });
   *
   * // Create with custom headers
   * const response = await client.post('spaces/123456/stories', {
   *   headers: {
   *     'X-Source': 'my-app'
   *   },
   *   body: JSON.stringify({ story: {...} })
   * });
   * ```
   */
  const post = async <T>(path: string, fetchOptions?: FetchOptions): Promise<GetResponse<T>> => {
    return request<T>(path, { ...fetchOptions, method: 'POST' });
  };

  /**
   * Make a PUT request to the Storyblok Management API
   *
   * Convenience method for PUT requests. The method is automatically set to 'PUT'.
   * Typically used for updating existing resources.
   *
   * @template T - Expected type of the response data
   * @param path - API endpoint path
   * @param fetchOptions - Optional configuration (method will be overridden to 'PUT')
   * @returns Promise resolving to response data with metadata
   *
   * @example
   * ```typescript
   * // Update an existing story
   * const updatedStory = await client.put<Story>('spaces/123456/stories/789', {
   *   body: JSON.stringify({
   *     story: {
   *       name: 'Updated Story Name',
   *       content: {
   *         component: 'page',
   *         body: [...]
   *       }
   *     }
   *   })
   * });
   *
   * // Update space settings
   * const space = await client.put<Space>('spaces/123456', {
   *   body: JSON.stringify({
   *     space: {
   *       name: 'Updated Space Name'
   *     }
   *   })
   * });
   * ```
   */
  const put = async <T>(path: string, fetchOptions?: FetchOptions): Promise<GetResponse<T>> => {
    return request<T>(path, { ...fetchOptions, method: 'PUT' });
  };

  /**
   * Re-initialize the client with new configuration options
   *
   * This method allows you to change the client's configuration after creation,
   * such as updating the token, region, or verbose setting.
   *
   * @param clientOptions - New configuration options
   *
   * @example
   * ```typescript
   * const client = createManagementClient({
   *   token: 'old-token',
   *   region: 'eu'
   * });
   *
   * // Later, update the configuration
   * client.init({
   *   token: 'new-token',
   *   region: 'us',
   *   verbose: true
   * });
   * ```
   */
  const init = (clientOptions: StoryblokManagementClientOptions) => {
    state.token = clientOptions.token;
    state.region = clientOptions.region;
    state.verbose = clientOptions.verbose || false;
    const baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': clientOptions.token,
    };

    state.headers = baseHeaders;
  };

  // Always create a new instance
  const instance: StoryblokManagementClient = {
    uuid: `management-client-${Math.random().toString(36).substring(2, 15)}`,
    init,
    request,
    get,
    post,
    put,
  };

  // Initialize the instance immediately
  init(clientOptions);

  return instance;
};

/**
 * Returns a singleton management client instance
 *
 * Use this function when you want a single, reusable client instance throughout your application.
 * The instance is created once on the first call and reused on subsequent calls.
 *
 * @param clientOptions - Configuration options (only required on first call)
 * @returns The singleton StoryblokManagementClient instance
 *
 * @example
 * ```typescript
 * // First call - requires configuration
 * const client1 = managementClient({
 *   token: 'your-management-token',
 *   region: 'eu',
 *   verbose: true
 * });
 *
 * // Subsequent calls - returns the same instance
 * const client2 = managementClient(); // No configuration needed
 * const client3 = managementClient(); // Still the same instance
 *
 * console.log(client1 === client2); // true
 * console.log(client2 === client3); // true
 * console.log(client1.uuid === client2.uuid); // true
 * ```
 *
 * @throws {Error} When called for the first time without providing a token
 */
export const managementClient = (clientOptions?: StoryblokManagementClientOptions): StoryblokManagementClient => {
  if (!singletonInstance) {
    if (!clientOptions?.token) {
      throw new Error('Management API Client requires an access token for initialization on first call');
    }
    singletonInstance = createManagementClient(clientOptions);
  }

  return singletonInstance;
};
