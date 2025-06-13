import { ContentVersion, type RegionCode, contentVersions, getCapiUrl, serializeParams, camelToSnakeCase } from './utils';
import { StoryblokBaseResponse, StoryblokLinksResponse, StoryblokLink } from './types';

/**
 * Configuration options for the Content API Client
 */
export type StoryblokContentClientOptions = {
  /**
   * Access token for authentication
   */
  accessToken: string;
  /**
   * Region code for the Content API Client
   * @default 'eu'
   * @see {@link RegionCode}
   */
  region: RegionCode;
  /**
   * Content version to use for the request
   * @default ContentVersion.DRAFT
   * @see {@link ContentVersion}
   */
  version?: ContentVersion;
  /**
   * Endpoint to use for the request
   * @default 'https://api.storyblok.com'
   */
  endpoint?: string;
};

/**
 * Internal state type for the Content API Client
 */
type StoryblokContentClientState = {
  accessToken: string;
  endpoint?: string;
  version?: ContentVersion;
  headers: Headers;
};

/**
 * Type definition for the Content API Client instance
 */
export type StoryblokContentClient = {
  endpoint?: string;
  getClientName: () => string;
  /**
   * Fetches data from the API
   * @param url - The URL path to fetch from
   * @returns Promise with the JSON response wrapped in StoryblokBaseResponse
   */
  get: <T = unknown>(url: string, params: StoryblokContentClientGetParams) => Promise<StoryblokBaseResponse<T>>;
  /**
   * Fetches links from the Storyblok /cdn/links endpoint
   * @param params - Query parameters for the request
   * @returns Promise with the links response
   */
  getLinks: (params?: StoryblokContentClientGetParams) => Promise<StoryblokLinksResponse>;
  /**
   * Fetches all links from the Storyblok /cdn/links endpoint, handling pagination automatically
   * @param params - Query parameters for the request
   * @returns Promise with all links merged into a single object
   */
  getAllLinks: (params?: StoryblokContentClientGetParams) => Promise<StoryblokLinksResponse>;
};

export type StoryblokContentClientGetParams = {
  /**
   * Version of the content to retrieve
   */
  version?: ContentVersion;
  
  /**
   * Used to access a particular cached version of a published story by providing a Unix timestamp
   */
  cv?: number;
  
  /**
   * Filter by full_slug. Used to retrieve all stories in a specific folder
   */
  startsWith?: string;
  
  /**
   * Performs a full-text search by passing a search query
   */
  searchTerm?: string;
  
  /**
   * Sort stories in ascending or descending order by a specific property
   */
  sortBy?: string;
  
  /**
   * Number of stories per page (default: 25, max: 100)
   */
  perPage?: number;
  
  /**
   * Page number (default: 1)
   */
  page?: number;
  
  /**
   * Retrieve stories by comma-separated full_slug
   */
  bySlugs?: string;
  
  /**
   * Exclude stories by specifying comma-separated values of full_slug
   */
  excludingSlugs?: string;
  
  /**
   * Retrieve stories published after the specified date (Format: yyyy-MM-dd HH:mm)
   */
  publishedAtGt?: string;
  
  /**
   * Retrieve stories published before the specified date (Format: yyyy-MM-dd HH:mm)
   */
  publishedAtLt?: string;
  
  /**
   * Retrieve stories first published after the specified date (Format: yyyy-MM-dd HH:mm)
   */
  firstPublishedAtGt?: string;
  
  /**
   * Retrieve stories first published before the specified date (Format: yyyy-MM-dd HH:mm)
   */
  firstPublishedAtLt?: string;
  
  /**
   * Retrieve stories updated after the specified date (Format: yyyy-MM-dd HH:mm)
   */
  updatedAtGt?: string;
  
  /**
   * Retrieve stories updated before the specified date (Format: yyyy-MM-dd HH:mm)
   */
  updatedAtLt?: string;
  
  /**
   * Retrieve stories that are in a particular workflow stage by providing a comma-separated list of workflow stage IDs
   */
  inWorkflowStages?: string;
  
  /**
   * Retrieve stories of a specific content type
   */
  contentType?: string;
  
  /**
   * Retrieve stories located in the specified folder level
   */
  level?: number;
  
  /**
   * Used to resolve relations to other stories established via a multi-option or single-option field
   */
  resolveRelations?: string;
  
  /**
   * Exclude specific stories by providing their IDs as a comma-separated string
   */
  excludingIds?: string;
  
  /**
   * Retrieve specific stories by providing their UUIDs as a comma-separated string
   */
  byUuids?: string;
  
  /**
   * Retrieve specific stories by providing their UUIDs as a comma-separated string with order preserved
   */
  byUuidsOrdered?: string;
};

/**
 * Creates a singleton instance of the Content API Client
 * Using a closure to maintain private state
 */
export const createContentClient = (() => {
  let instance: StoryblokContentClient | null = null;
  
  const state: StoryblokContentClientState = {
    accessToken: '',
    version: contentVersions.DRAFT,
    headers: new Headers(),
  };

  async function get<T = unknown>(
    url: string, 
    params?: StoryblokContentClientGetParams
  ): Promise<StoryblokBaseResponse<T>> {
    if (!state.endpoint) {
      throw new Error('Content API Client endpoint is not initialized');
    }

    // Transform params to snake_case for the API
    const transformedParams = params ? camelToSnakeCase(params) : {};
    
    const queryParams = {
      token: state.accessToken,
      version: params?.version ?? state.version,
      ...transformedParams
    };
    
    const queryString = serializeParams(queryParams);
    const urlWithParams = `${state.endpoint}${url}${url.includes('?') ? '&' : '?'}${queryString}`;

    try {
      const response = await fetch(urlWithParams, {
        headers: state.headers
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText} (${response.status})`);
      }

      return response.json() as Promise<StoryblokBaseResponse<T>>;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Content API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetches links from the Storyblok /cdn/links endpoint
   * @param params - Query parameters for the request
   * @returns Promise with the links response
   */
  async function getLinks(
    params?: StoryblokContentClientGetParams
  ): Promise<StoryblokLinksResponse> {
    if (!state.endpoint) {
      throw new Error('Content API Client endpoint is not initialized');
    }
    // Transform params to snake_case for the API
    const transformedParams = params ? camelToSnakeCase(params) : {};
    const queryParams = {
      token: state.accessToken,
      version: params?.version ?? state.version,
      ...transformedParams
    };
    const queryString = serializeParams(queryParams);
    const urlWithParams = `${state.endpoint}/links?${queryString}`;
    try {
      // We use fetch directly here because the links endpoint response does not match StoryblokBaseResponse
      const response = await fetch(urlWithParams, {
        headers: state.headers
      });
      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText} (${response.status})`);
      }
      return response.json() as Promise<StoryblokLinksResponse>;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Content API request failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Fetches all links from the Storyblok /cdn/links endpoint, handling pagination automatically
   * @param params - Query parameters for the request
   * @returns Promise with all links merged into a single object
   */
  async function getAllLinks(
    params?: StoryblokContentClientGetParams
  ): Promise<StoryblokLinksResponse> {
    const perPage = params?.perPage ?? 1000; // Max allowed by API
    let page = 1;
    let allLinks: Record<string, StoryblokLink> = {};
    let hasMore = true;

    while (hasMore) {
      // Fetch a page of links
      const response = await getLinks({ ...params, perPage, page });
      // Merge links into the accumulator
      allLinks = { ...allLinks, ...response.links };
      // If less than perPage returned, we're done
      hasMore = Object.keys(response.links).length === perPage;
      page++;
    }

    return { links: allLinks };
  }

  const initialize = (clientOptions: StoryblokContentClientOptions): StoryblokContentClient => {
    state.accessToken = clientOptions.accessToken;
    state.endpoint = getCapiUrl(clientOptions.region);
    state.version = clientOptions.version;
    state.headers.set('Content-Type', 'application/json');
    state.headers.set('Accept', 'application/json');
    return {
      endpoint: state.endpoint,
      getClientName: () => 'content-client',
      get,
      getLinks,
      getAllLinks,
    }
  };

  return (clientOptions?: StoryblokContentClientOptions): StoryblokContentClient => {
    if (!instance) {
      if (!clientOptions?.accessToken) {
        throw new Error('Content API Client requires an access token for initialization');
      }
      instance = initialize(clientOptions);
    }
    return instance;
  };
})();

// Export a default function to get the singleton instance
export const contentClient = createContentClient;
