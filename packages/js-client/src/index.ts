import { decodeIfEncoded } from "@storyblok/utils/serialization";
import {
  asyncMap,
  createCacheKey,
  delay,
  flatMap,
  getOptionsPage,
  getRegionURL,
  isCDNUrl,
  range,
} from "./utils";
import SbFetch from "./sbFetch";
import type Method from "./constants";
import type { StoryblokContentVersionKeys } from "./constants";
import { StoryblokContentVersion } from "./constants";
import {
  createRateLimitConfig,
  determineRateLimit,
  MANAGEMENT_API_DEFAULT_RATE_LIMIT,
  parseRateLimitHeaders,
  type RateLimitConfig,
} from "./rateLimit";
import { ThrottleQueueManager } from "./throttleQueueManager";

import type {
  ICacheProvider,
  IMemoryType,
  ISbCache,
  ISbComponentType,
  ISbConfig,
  ISbContentMangmntAPI,
  ISbCustomFetch,
  ISbField,
  ISbLinksParams,
  ISbLinksResult,
  ISbLinkURLObject,
  ISbResponse,
  ISbResponseData,
  ISbResult,
  ISbStories,
  ISbStoriesParams,
  ISbStory,
  ISbStoryData,
  ISbStoryParams,
  ExcludableStoryField,
} from "./interfaces";

export * from "./interfaces";

let memory: Partial<IMemoryType> = {};

const cacheVersions = {} as CachedVersions;

/** Reports the raw `space.version`. Its responses never enter the content cache. */
const SPACES_ME_PATH = "/cdn/spaces/me";

/**
 * Invalidation state of one cache, shared by every client writing to it. See
 * `adr/0018-content-cache-invalidation-by-version-watermarks.md`.
 */
interface CacheKeyspaceState {
  /** Highest `space.version` seen per token. A change signal only, never sent as a `cv`. */
  spaceVersions: CachedVersions;
  /**
   * Bumped on every flush. A response in flight across a flush neither teaches its `cv` nor
   * gets cached: either would make the pre-publish snapshot reachable again.
   */
  flushEpoch: number;
}

/**
 * Keyed by provider object, not client instance: clients sharing a provider must share the
 * signal, which is consumed once per cache. A provider built inline per request gets a fresh
 * state each time, so build it once at module scope.
 */
const cacheKeyspaces = new WeakMap<object, CacheKeyspaceState>();

/** Stands in for the module-level {@link memory} cache, which has no provider object. */
const MEMORY_KEYSPACE = {};

/**
 * Shared by every client without a cache. Nothing is cached, so the only cost of sharing is
 * that one client's flush can stop another's in-flight response from teaching a `cv`.
 */
const NO_CACHE_KEYSPACE = {};

const keyspaceState = (keyspace: object): CacheKeyspaceState => {
  const state = cacheKeyspaces.get(keyspace);
  if (state) {
    return state;
  }

  const created: CacheKeyspaceState = { spaceVersions: {}, flushEpoch: 0 };
  cacheKeyspaces.set(keyspace, created);
  return created;
};

/**
 * Highest `cv` the API reported per token. Unlike {@link cacheVersions}, a flush never
 * clears it, so it stays the floor for stale edge reads and the baseline for a first
 * `space.version` sighting. Never sent as a `cv`.
 */
const highestCvs: CachedVersions = {};

/**
 * Normalizes leading and trailing slashes, so every spelling of a slug matches
 * {@link SPACES_ME_PATH} and builds the same cache key. Both APIs serve a trailing slash the
 * same as none.
 */
const toPath = (slug: string): string => `/${slug.replace(/^\/+/, "").replace(/\/+$/, "")}`;

interface CachedVersions {
  [key: string]: number;
}

interface LinksType {
  [key: string]: any;
}

interface RelationsType {
  [key: string]: any;
}

interface ISbFlatMapped {
  data: any;
}

const _VERSION = {
  V1: "v1",
  V2: "v2",
} as const;

type ObjectValues<T> = T[keyof T];
type Version = ObjectValues<typeof _VERSION>;

/**
 * Normalises `excluding_story_fields` to the comma-separated wire format.
 * Returns `undefined` for an empty array or a missing value so the caller
 * can omit the param entirely instead of sending an empty string.
 */
function normalizeExcludingStoryFields(
  value: ExcludableStoryField | ExcludableStoryField[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value.length > 0 ? value.join(",") : undefined;
  return value;
}

export class Storyblok {
  private client: SbFetch;
  private maxRetries: number;
  private retriesDelay: number;
  private throttleManager: ThrottleQueueManager;
  private accessToken: string;
  private cache: ISbCache;
  private resolveCounter: number;
  public relations: RelationsType;
  public links: LinksType;
  public version: StoryblokContentVersionKeys | undefined;
  private rateLimitConfig: RateLimitConfig;
  private cvMode: "auto" | "manual";
  /**
   * @deprecated This property is deprecated. Use the standalone `richTextResolver` from `@storyblok/richtext` instead.
   * @see https://github.com/storyblok/richtext
   */
  public richTextResolver: unknown;
  public resolveNestedRelations: boolean;
  private stringifiedStoriesCache: Record<string, string>;
  private inlineAssets: boolean;
  /** See {@link cacheKeyspaces}. */
  private cacheKeyspace: object;

  /**
   *
   * @param config ISbConfig interface
   * @param pEndpoint string, optional
   */
  public constructor(config: ISbConfig, pEndpoint?: string) {
    let endpoint = config.endpoint || pEndpoint;

    if (!endpoint) {
      const protocol = config.https === false ? "http" : "https";

      if (!config.oauthToken) {
        endpoint = `${protocol}://${getRegionURL(config.region)}/${"v2" as Version}`;
      } else {
        endpoint = `${protocol}://${getRegionURL(config.region)}/${"v1" as Version}`;
      }
    }

    const headers: Headers = new Headers();

    // Skip Content-Type for GET browser CDN requests to avoid CORS preflight.
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS#simple_requests
    const isBrowserCdn = !config.oauthToken && typeof window !== "undefined";
    if (!isBrowserCdn) {
      headers.set("Content-Type", "application/json");
    }

    headers.set("Accept", "application/json");

    if (config.headers) {
      const entries =
        config.headers.constructor.name === "Headers"
          ? config.headers.entries().toArray()
          : Object.entries(config.headers);

      entries.forEach(([key, value]: [string, string]) => {
        headers.set(key, value);
      });
    }

    if (config.oauthToken) {
      headers.set("Authorization", config.oauthToken);
    }

    // Create rate limit config - user's rateLimit applies only to uncached requests
    // Pass isManagementApi flag to handle Management API default rate limit
    this.rateLimitConfig = createRateLimitConfig(config.rateLimit, !!config.oauthToken);

    this.maxRetries = config.maxRetries || 10;
    this.retriesDelay = config.retriesDelay ?? 300;

    // Initialize throttle queue manager
    this.throttleManager = new ThrottleQueueManager(this.throttledRequest.bind(this), 1000);

    this.accessToken = config.accessToken || "";
    this.relations = {} as RelationsType;
    this.links = {} as LinksType;
    this.cache = config.cache || { clear: "manual" };
    // Mirrors the provider selection in `cacheProvider()`.
    this.cacheKeyspace =
      this.cache.type === "custom" && this.cache.custom
        ? this.cache.custom
        : this.cache.type === "memory"
          ? MEMORY_KEYSPACE
          : NO_CACHE_KEYSPACE;
    this.cvMode = config.cache?.cv ?? "auto";
    this.resolveCounter = 0;
    this.resolveNestedRelations = config.resolveNestedRelations || true;
    this.stringifiedStoriesCache = {} as Record<string, string>;
    this.version = config.version || StoryblokContentVersion.PUBLISHED; // the default version is published as per API documentation
    this.inlineAssets = config.inlineAssets || false;

    this.client = new SbFetch({
      baseURL: endpoint,
      timeout: config.timeout || 0,
      headers,
      responseInterceptor: config.responseInterceptor,
      fetch: config.fetch,
    });
  }

  private parseParams(params: ISbStoriesParams, url = ""): ISbStoriesParams {
    if (!params.token) {
      params.token = this.getToken();
    }

    if (url === SPACES_ME_PATH || !params.cv) {
      this.applyTrackedCv(url, params);
    }

    if (Array.isArray(params.resolve_relations)) {
      // Decode URL-encoded strings in array before joining
      params.resolve_relations = params.resolve_relations.map(decodeIfEncoded).join(",");
    } else if (typeof params.resolve_relations === "string") {
      // Decode URL-encoded strings to prevent double-encoding
      params.resolve_relations = decodeIfEncoded(params.resolve_relations);
    }

    const normalizedExcluding = normalizeExcludingStoryFields(params.excluding_story_fields);
    if (normalizedExcluding !== undefined) {
      // Cast required: the public type is a strict literal union; the wire
      // format is the joined string which does not match that union.
      params.excluding_story_fields =
        normalizedExcluding as (typeof params)["excluding_story_fields"];
    } else {
      delete params.excluding_story_fields;
    }

    if (typeof params.resolve_relations !== "undefined") {
      params.resolve_level = 2;
    }

    return params;
  }

  /**
   * Sets the tracked cv, or removes the cv when none is tracked: the sentinel `0` a flush
   * records would only cost a redirect and a cache key no read builds.
   *
   * Always removed on `/cdn/spaces/me`, where it would fragment the edge cache polling
   * relies on.
   */
  private applyTrackedCv(url: string, params: ISbStoriesParams): void {
    if (url === SPACES_ME_PATH) {
      delete params.cv;
      return;
    }
    if (this.cvMode !== "auto" || !params.token) {
      return;
    }
    const trackedCv = cacheVersions[params.token];
    if (trackedCv) {
      params.cv = trackedCv;
    } else {
      delete params.cv;
    }
  }

  private factoryParamOptions(url: string, params: ISbStoriesParams): ISbStoriesParams {
    if (isCDNUrl(url)) {
      return this.parseParams(params, url);
    }

    return params;
  }

  private makeRequest(
    url: string,
    params: ISbStoriesParams,
    per_page: number,
    page: number,
    fetchOptions?: ISbCustomFetch,
  ): Promise<ISbResult> {
    // Truthiness matches `parseParams`, which replaces a falsy cv.
    const cvPinnedByCaller = Boolean(params.cv);
    const query = this.factoryParamOptions(url, getOptionsPage(params, per_page, page));

    return this.cacheResponse(url, query, undefined, fetchOptions, cvPinnedByCaller);
  }

  public get(
    slug: "cdn/links",
    params?: ISbLinksParams,
    fetchOptions?: ISbCustomFetch,
  ): Promise<ISbLinksResult>;

  public get(
    slug: string,
    params?: ISbStoriesParams,
    fetchOptions?: ISbCustomFetch,
  ): Promise<ISbResult>;

  public get(
    slug: string,
    params: ISbStoriesParams | ISbLinksParams = {},
    fetchOptions?: ISbCustomFetch,
  ): Promise<ISbResult | ISbLinksResult> {
    // Copied so request state (version, token, cv) never leaks into a reused params object.
    const requestParams: ISbStoriesParams = { ...params };
    const url = toPath(slug);

    // Only add/keep version parameter for CDN URLs — strip it from MAPI requests
    if (isCDNUrl(url)) {
      requestParams.version = requestParams.version || this.version;
    } else if (requestParams.version) {
      delete requestParams.version;
    }

    // Read before `parseParams` sets the tracked cv. Truthiness matches its test.
    const cvPinnedByCaller = Boolean(requestParams.cv);
    const query = this.factoryParamOptions(url, requestParams);

    return this.cacheResponse(url, query, undefined, fetchOptions, cvPinnedByCaller);
  }

  public async getAll(
    slug: string,
    params: ISbStoriesParams = {},
    entity?: string,
    fetchOptions?: ISbCustomFetch,
  ): Promise<any[]> {
    const perPage = params?.per_page || 25;
    const url = toPath(slug);
    const e = entity ?? url.substring(url.lastIndexOf("/") + 1);
    // Copied for the same reason as in `get()`.
    const requestParams: ISbStoriesParams = { ...params };
    requestParams.version = requestParams.version || this.version;

    const firstPage = 1;
    const firstRes = await this.makeRequest(url, requestParams, perPage, firstPage, fetchOptions);
    const lastPage = firstRes.total ? Math.ceil(firstRes.total / (firstRes.perPage || perPage)) : 1;

    const restRes: any = await asyncMap(range(firstPage, lastPage), (i: number) => {
      return this.makeRequest(url, requestParams, perPage, i + 1, fetchOptions);
    });

    return flatMap([firstRes, ...restRes], (res: ISbFlatMapped) => Object.values(res.data[e]));
  }

  public post(
    slug: string,
    params: ISbStoriesParams | ISbContentMangmntAPI = {},
    fetchOptions?: ISbCustomFetch,
  ): Promise<ISbResponse> {
    const url = toPath(slug);

    const rateLimit = determineRateLimit(
      undefined,
      undefined,
      this.rateLimitConfig,
      MANAGEMENT_API_DEFAULT_RATE_LIMIT,
    );
    return this.throttleManager.execute(
      rateLimit,
      "post",
      url,
      params,
      fetchOptions,
    ) as Promise<ISbResponse>;
  }

  public put(
    slug: string,
    params: ISbStoriesParams | ISbContentMangmntAPI = {},
    fetchOptions?: ISbCustomFetch,
  ): Promise<ISbResponse> {
    const url = toPath(slug);

    const rateLimit = determineRateLimit(
      undefined,
      undefined,
      this.rateLimitConfig,
      MANAGEMENT_API_DEFAULT_RATE_LIMIT,
    );
    return this.throttleManager.execute(
      rateLimit,
      "put",
      url,
      params,
      fetchOptions,
    ) as Promise<ISbResponse>;
  }

  public patch(
    slug: string,
    params: ISbStoriesParams | ISbContentMangmntAPI = {},
    fetchOptions?: ISbCustomFetch,
  ): Promise<ISbResponse> {
    const url = toPath(slug);

    const rateLimit = determineRateLimit(
      undefined,
      undefined,
      this.rateLimitConfig,
      MANAGEMENT_API_DEFAULT_RATE_LIMIT,
    );
    return this.throttleManager.execute(
      rateLimit,
      "patch",
      url,
      params,
      fetchOptions,
    ) as Promise<ISbResponse>;
  }

  public delete(
    slug: string,
    params: ISbStoriesParams | ISbContentMangmntAPI = {},
    fetchOptions?: ISbCustomFetch,
  ): Promise<ISbResponse> {
    if (!params) {
      params = {} as ISbStoriesParams;
    }
    const url = toPath(slug);

    const rateLimit = determineRateLimit(
      undefined,
      undefined,
      this.rateLimitConfig,
      MANAGEMENT_API_DEFAULT_RATE_LIMIT,
    );
    return this.throttleManager.execute(
      rateLimit,
      "delete",
      url,
      params,
      fetchOptions,
    ) as Promise<ISbResponse>;
  }

  public getStories(
    params: ISbStoriesParams = {},
    fetchOptions?: ISbCustomFetch,
  ): Promise<ISbStories> {
    this._addResolveLevel(params);

    return this.get("cdn/stories", params, fetchOptions);
  }

  public getStory(
    slug: string,
    params: ISbStoryParams = {},
    fetchOptions?: ISbCustomFetch,
  ): Promise<ISbStory> {
    this._addResolveLevel(params);

    return this.get(`cdn/stories/${slug}`, params, fetchOptions);
  }

  private getToken(): string {
    return this.accessToken;
  }

  public ejectInterceptor(): void {
    this.client.eject();
  }

  private _addResolveLevel(params: ISbStoriesParams | ISbStoryParams): void {
    if (typeof params.resolve_relations !== "undefined") {
      params.resolve_level = 2;
    }
  }

  private _cleanCopy(value: LinksType): JSON {
    return JSON.parse(JSON.stringify(value));
  }

  private _insertLinks(
    jtree: ISbStoriesParams,
    treeItem: keyof ISbStoriesParams,
    resolveId: string,
  ): void {
    const node = jtree[treeItem];

    if (
      node &&
      node.fieldtype === "multilink" &&
      node.linktype === "story" &&
      typeof node.id === "string" &&
      this.links[resolveId][node.id]
    ) {
      node.story = this._cleanCopy(this.links[resolveId][node.id]);
    } else if (
      node &&
      node.linktype === "story" &&
      typeof node.uuid === "string" &&
      this.links[resolveId][node.uuid]
    ) {
      node.story = this._cleanCopy(this.links[resolveId][node.uuid]);
    }
  }

  /**
   *
   * @param resolveId A counter number as a string
   * @param uuid The uuid of the story
   * @returns string | object
   */
  private getStoryReference(resolveId: string, uuid: string): string | JSON {
    const result = this.relations[resolveId][uuid]
      ? JSON.parse(
          this.stringifiedStoriesCache[uuid] || JSON.stringify(this.relations[resolveId][uuid]),
        )
      : uuid;
    return result;
  }

  /**
   * Resolves a field's value by replacing UUIDs with their corresponding story references
   * @param jtree - The JSON tree object containing the field to resolve
   * @param treeItem - The key of the field to resolve
   * @param resolveId - The unique identifier for the current resolution context
   *
   * This method handles both single string UUIDs and arrays of UUIDs:
   * - For single strings: directly replaces the UUID with the story reference
   * - For arrays: maps through each UUID and replaces with corresponding story references
   */
  private _resolveField(
    jtree: ISbStoriesParams,
    treeItem: keyof ISbStoriesParams,
    resolveId: string,
  ): void {
    const item = jtree[treeItem];
    if (typeof item === "string") {
      jtree[treeItem] = this.getStoryReference(resolveId, item);
    } else if (Array.isArray(item)) {
      jtree[treeItem] = item.map((uuid) => this.getStoryReference(resolveId, uuid)).filter(Boolean);
    }
  }

  /**
   * Inserts relations into the JSON tree by resolving references
   * @param jtree - The JSON tree object to process
   * @param treeItem - The current field being processed
   * @param fields - The relation patterns to resolve (string or array of strings)
   * @param resolveId - The unique identifier for the current resolution context
   *
   * This method handles two types of relation patterns:
   * 1. Nested relations: matches fields that end with the current field name
   *    Example: If treeItem is "event_type", it matches patterns like "*.event_type"
   *
   * 2. Direct component relations: matches exact component.field patterns
   *    Example: "event.event_type" for component "event" and field "event_type"
   *
   * The method supports both string and array formats for the fields parameter,
   * allowing flexible specification of relation patterns.
   */
  private _insertRelations(
    jtree: ISbStoriesParams,
    treeItem: keyof ISbStoriesParams,
    fields: string | string[],
    resolveId: string,
  ): void {
    // Check for nested relations (e.g., "*.event_type" or "spots.event_type")
    const fieldPattern = Array.isArray(fields)
      ? fields.find((f) => f.endsWith(`.${treeItem}`))
      : fields.endsWith(`.${treeItem}`);

    if (fieldPattern) {
      // If we found a matching pattern, resolve this field
      this._resolveField(jtree, treeItem, resolveId);
      return;
    }

    // If no nested pattern matched, check for direct component.field pattern
    // e.g., "event.event_type" for a field within its immediate parent component
    const fieldPath = jtree.component ? `${jtree.component}.${treeItem}` : treeItem;
    // Check if this exact pattern exists in the fields to resolve
    if (Array.isArray(fields) ? fields.includes(fieldPath) : fields === fieldPath) {
      this._resolveField(jtree, treeItem, resolveId);
    }
  }

  /**
   * Recursively traverses and resolves relations in the story content tree
   * @param story - The story object containing the content to process
   * @param fields - The relation patterns to resolve
   * @param resolveId - The unique identifier for the current resolution context
   */
  private iterateTree(
    story: ISbStoryData,
    fields: string | Array<string>,
    resolveId: string,
  ): void {
    // Internal recursive function to process each node in the tree
    const enrich = (jtree: ISbStoriesParams | any, path = "") => {
      // Skip processing if node is null/undefined or marked to stop resolving
      if (!jtree || jtree._stopResolving) {
        return;
      }

      // Handle arrays by recursively processing each element
      // Maintains path context by adding array indices
      if (Array.isArray(jtree)) {
        jtree.forEach((item, index) => enrich(item, `${path}[${index}]`));
      }
      // Handle object nodes
      else if (typeof jtree === "object") {
        // Process each property in the object
        for (const key in jtree) {
          // Build the current path for the context
          const newPath = path ? `${path}.${key}` : key;

          // If this is a component (has component and _uid) or a link,
          // attempt to resolve its relations and links
          if ((jtree.component && jtree._uid) || jtree.type === "link") {
            this._insertRelations(jtree, key as keyof ISbStoriesParams, fields, resolveId);
            this._insertLinks(jtree, key as keyof ISbStoriesParams, resolveId);
          }

          // Continue traversing deeper into the tree
          // This ensures we process nested components and their relations
          enrich(jtree[key], newPath);
        }
      }
    };

    // Start the traversal from the story's content
    enrich(story.content);
  }

  private async resolveLinks(
    responseData: ISbResponseData,
    params: ISbStoriesParams,
    resolveId: string,
  ): Promise<void> {
    let links: (ISbStoryData | ISbLinkURLObject | string)[] = [];

    if (responseData.link_uuids) {
      const relSize = responseData.link_uuids.length;
      const chunks = [];
      const chunkSize = 50;

      for (let i = 0; i < relSize; i += chunkSize) {
        const end = Math.min(relSize, i + chunkSize);
        chunks.push(responseData.link_uuids.slice(i, end));
      }

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const linksRes = await this.getStories({
          per_page: chunkSize,
          language: params.language,
          version: params.version,
          starts_with: params.starts_with,
          by_uuids: chunks[chunkIndex].join(","),
          excluding_story_fields: params.excluding_story_fields,
        });

        linksRes.data.stories.forEach((rel: ISbStoryData | ISbLinkURLObject | string) => {
          links.push(rel);
        });
      }
    } else {
      links = responseData.links;
    }

    links.forEach((story: ISbStoryData | any) => {
      this.links[resolveId][story.uuid] = {
        ...story,
        _stopResolving: true,
      };
    });
  }

  private async resolveRelations(
    responseData: ISbResponseData,
    params: ISbStoriesParams,
    resolveId: string,
  ): Promise<void> {
    let relations: ISbStoryData<ISbComponentType<string> & { [index: string]: any }>[] = [];

    if (responseData.rel_uuids) {
      const relSize = responseData.rel_uuids.length;
      const chunks = [];
      const chunkSize = 50;

      for (let i = 0; i < relSize; i += chunkSize) {
        const end = Math.min(relSize, i + chunkSize);
        chunks.push(responseData.rel_uuids.slice(i, end));
      }

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const relationsRes = await this.getStories({
          per_page: chunkSize,
          language: params.language,
          version: params.version,
          starts_with: params.starts_with,
          by_uuids: chunks[chunkIndex].join(","),
          excluding_fields: params.excluding_fields,
          excluding_story_fields: params.excluding_story_fields,
        });

        relationsRes.data.stories.forEach((rel: ISbStoryData) => {
          relations.push(rel);
        });
      }

      // Replace rel_uuids with the fully resolved stories and clear it
      if (relations.length > 0) {
        responseData.rels = relations;
        delete responseData.rel_uuids;
      }
    } else {
      relations = responseData.rels;
    }

    if (relations && relations.length > 0) {
      relations.forEach((story: ISbStoryData) => {
        this.relations[resolveId][story.uuid] = {
          ...story,
          _stopResolving: true,
        };
      });
    }
  }

  /**
   *
   * @param responseData
   * @param params
   * @param resolveId
   * @description Resolves the relations and links of the stories
   * @returns Promise<void>
   *
   */
  private async resolveStories(
    responseData: ISbResponseData,
    params: ISbStoriesParams,
    resolveId: string,
  ): Promise<void> {
    let relationParams: string[] = [];

    this.links[resolveId] = {};
    this.relations[resolveId] = {};

    if (typeof params.resolve_relations !== "undefined" && params.resolve_relations.length > 0) {
      if (typeof params.resolve_relations === "string") {
        relationParams = params.resolve_relations.split(",");
      }
      await this.resolveRelations(responseData, params, resolveId);
    }

    if (
      params.resolve_links &&
      ["1", "story", "url", "link"].includes(params.resolve_links) &&
      (responseData.links?.length || responseData.link_uuids?.length)
    ) {
      await this.resolveLinks(responseData, params, resolveId);
    }

    if (this.resolveNestedRelations) {
      for (const relUuid in this.relations[resolveId]) {
        this.iterateTree(this.relations[resolveId][relUuid], relationParams, resolveId);
      }
    }

    if (responseData.story) {
      this.iterateTree(responseData.story, relationParams, resolveId);
    } else {
      responseData.stories.forEach((story: ISbStoryData) => {
        this.iterateTree(story, relationParams, resolveId);
      });
    }

    this.stringifiedStoriesCache = {};

    delete this.links[resolveId];
    delete this.relations[resolveId];
  }

  private async cacheResponse(
    url: string,
    params: ISbStoriesParams,
    retries?: number,
    fetchOptions?: ISbCustomFetch,
    // Passed in because `parseParams` has already set the tracked cv on `params`.
    cvPinnedByCaller = false,
  ): Promise<ISbResult> {
    const provider = this.cacheProvider();

    // Captured before the first await, so a flush during the cache lookup also counts.
    // Re-synced after a flush this request performs itself.
    const keyspace = keyspaceState(this.cacheKeyspace);
    let epochAtRequest = keyspace.flushEpoch;

    // Check in-memory cache first for published content
    // If cached, skip API call and rate limiting entirely
    if (params.version === "published" && url !== SPACES_ME_PATH) {
      const cache = await provider.get(createCacheKey(url, params));
      if (cache) {
        return Promise.resolve(cache);
      }
    }

    // Calculate appropriate rate limit for this request
    // For Management API requests (non-CDN URLs), use the MAPI rate limit
    const isMapi = !isCDNUrl(url) && this.rateLimitConfig.isManagementApi;
    const defaultLimit = isMapi ? MANAGEMENT_API_DEFAULT_RATE_LIMIT : undefined;
    const rateLimit = determineRateLimit(url, params, this.rateLimitConfig, defaultLimit);

    return new Promise(async (resolve, reject) => {
      try {
        // Execute through the appropriate throttle queue based on rate limit
        const res = (await this.throttleManager.execute(
          rateLimit,
          "get",
          url,
          params,
          fetchOptions,
        )) as ISbResponse;
        if (res.status !== 200) {
          return reject(res);
        }

        let response = { data: res.data, headers: res.headers } as ISbResult;

        // Parse rate limit headers and update config if present
        const rateLimitHeaders = parseRateLimitHeaders(res.headers);
        if (rateLimitHeaders?.max !== undefined) {
          // Update server rate limit for subsequent requests
          this.rateLimitConfig.serverHeadersRateLimit = rateLimitHeaders.max;
        }

        if (res.headers?.["per-page"]) {
          response = Object.assign({}, response, {
            perPage: res.headers["per-page"] ? Number.parseInt(res.headers["per-page"]) : 0,
            total: res.headers["per-page"] ? Number.parseInt(res.headers.total) : 0,
          });
        }

        if (response.data.story || response.data.stories) {
          const resolveId = (this.resolveCounter = ++this.resolveCounter % 1000);
          await this.resolveStories(response.data, params, `${resolveId}`);
          response = await this.processInlineAssets(response);
        }

        const isCacheClearable =
          (this.cache.clear === "onpreview" && params.version === "draft") ||
          this.cache.clear === "auto";

        // `space.version` is a change signal only: a Minimum Cache TTL floors the `cv` into
        // buckets, so the two are not interchangeable. Handled before the cv, so a response
        // carrying both keeps its own cv. See ADR-0018.
        // Narrowed because a non-number would never compare equal and flush on every poll.
        const rawSpaceVersion = url === SPACES_ME_PATH ? response.data.space?.version : undefined;
        const spaceVersion = typeof rawSpaceVersion === "number" ? rawSpaceVersion : undefined;

        if (params.token && spaceVersion !== undefined) {
          const lastSpaceVersion = keyspace.spaceVersions[params.token];
          // Not the tracked cv, which another instance's flush may have zeroed.
          const baselineCv = highestCvs[params.token];
          // With no previous space version, compare against the cv. Ahead of it means a
          // publish or a Minimum Cache TTL flooring the cv, which look the same, so flush
          // once. Behind it is an edge location whose 2 s cache of this endpoint lags.
          const isFirstSighting =
            lastSpaceVersion === undefined && Boolean(baselineCv) && spaceVersion > baselineCv;
          const hasSpaceVersionChanged =
            lastSpaceVersion !== undefined && spaceVersion > lastSpaceVersion;

          if (isCacheClearable && (isFirstSighting || hasSpaceVersionChanged)) {
            // `flushCache` only clears the client's own token, and `params.token` may differ.
            // The edge serves an old cv's snapshot for up to a week. Cleared before the
            // flush, so no request issued during it sends that cv.
            cacheVersions[params.token] = 0;
            epochAtRequest = await this.flushForResponse(keyspace, epochAtRequest);
          }
          // Recording from a request that could not flush (a published one under
          // `'onpreview'`) would consume the signal before a draft poll can act on it.
          if (isCacheClearable) {
            // A maximum, so a lagging edge read never becomes the baseline.
            keyspace.spaceVersions[params.token] =
              lastSpaceVersion === undefined
                ? spaceVersion
                : Math.max(lastSpaceVersion, spaceVersion);
          }
        }

        // A cv is never adopted from a response in flight across a flush, nor below the
        // highest one seen (an edge still holding an old snapshot). A stale response is not
        // cached either.
        let isStaleCvResponse = false;
        let adoptedCv: number | undefined;
        // A pinned snapshot describes the caller's choice, not the space's state. A response
        // reporting another cv was redirected to the current one, as a cache-busting
        // `cv: Date.now()` intends, and is tracked like any other.
        const isPinnedSnapshot =
          cvPinnedByCaller && (!response.data.cv || Number(params.cv) === Number(response.data.cv));
        if (
          !isPinnedSnapshot &&
          params.token &&
          response.data.cv &&
          epochAtRequest === keyspace.flushEpoch
        ) {
          const lastCv = cacheVersions[params.token];
          // Floored at {@link highestCvs}, not the tracked cv, which a flush zeroes and
          // `setCacheVersion` can set to anything.
          const token = params.token;
          const isBelowHighestCv = () => response.data.cv < (highestCvs[token] ?? 0);
          const hasTrackedCv = Boolean(lastCv);
          const isNewCv = lastCv !== response.data.cv;
          if (!isBelowHighestCv() && isCacheClearable && hasTrackedCv && isNewCv) {
            epochAtRequest = await this.flushForResponse(keyspace, epochAtRequest);
          }
          // Re-checked: a response landing during the flush may have taught a newer cv.
          if (isBelowHighestCv()) {
            isStaleCvResponse = true;
          } else if (epochAtRequest === keyspace.flushEpoch) {
            cacheVersions[params.token] = response.data.cv;
            adoptedCv = response.data.cv;
            highestCvs[params.token] = Math.max(highestCvs[params.token] ?? 0, response.data.cv);
          }
        }

        // Cached after any flush this response triggered, which would otherwise drop it.
        if (
          params.version === "published" &&
          url !== SPACES_ME_PATH &&
          !isStaleCvResponse &&
          epochAtRequest === keyspace.flushEpoch
        ) {
          // Keyed by the adopted cv, which the next read builds, else by the cv it was
          // requested with: filing older content under a newer cv would serve it as current.
          const settledParams = { ...params };
          if (!cvPinnedByCaller && this.cvMode === "auto" && adoptedCv !== undefined) {
            settledParams.cv = adoptedCv;
          }
          await provider.set(createCacheKey(url, settledParams), response);
        }

        return resolve(response);
      } catch (error: Error | any) {
        if (error.response && error.status === 429) {
          retries = typeof retries === "undefined" ? 0 : retries + 1;

          if (retries < this.maxRetries) {
            // eslint-disable-next-line no-console
            console.log(`Hit rate limit. Retrying in ${this.retriesDelay / 1000} seconds.`);
            await delay(this.retriesDelay);
            // A flush during the wait may have dropped the cv this request was built with.
            if (!cvPinnedByCaller && isCDNUrl(url)) {
              this.applyTrackedCv(url, params);
            }
            // Give `fetchOptions` to the retry. If you do not give it, the
            // retried request loses the per-request fetch configuration that
            // the caller supplied.
            return this.cacheResponse(url, params, retries, fetchOptions, cvPinnedByCaller)
              .then(resolve)
              .catch(reject);
          }
        }
        reject(error);
      }
    });
  }

  private throttledRequest(
    type: Method,
    url: string,
    params: ISbStoriesParams,
    fetchOptions?: ISbCustomFetch,
  ): Promise<unknown> {
    this.client.setFetchOptions(fetchOptions);
    return this.client[type](url, params);
  }

  public cacheVersions(): CachedVersions {
    return cacheVersions;
  }

  public cacheVersion(): number {
    return cacheVersions[this.accessToken];
  }

  public setCacheVersion(cv: number): void {
    if (this.accessToken) {
      cacheVersions[this.accessToken] = cv;
      // Not recorded in {@link highestCvs}, which is never lowered: a value too far ahead
      // would make every later response look stale.
    }
  }

  public clearCacheVersion(): void {
    if (this.accessToken) {
      cacheVersions[this.accessToken] = 0;
    }
  }

  public cacheProvider(): ICacheProvider {
    switch (this.cache.type) {
      case "memory":
        return {
          get(key: string) {
            return Promise.resolve(memory[key]);
          },
          getAll() {
            return Promise.resolve(memory as IMemoryType);
          },
          set(key: string, content: ISbResult) {
            memory[key] = content;
            return Promise.resolve(undefined);
          },
          flush() {
            memory = {};
            return Promise.resolve(undefined);
          },
        };
      case "custom":
        if (this.cache.custom) {
          return this.cache.custom;
        }
      // eslint-disable-next-line no-fallthrough
      default:
        return {
          get() {
            return Promise.resolve();
          },
          getAll() {
            return Promise.resolve(undefined);
          },
          set() {
            return Promise.resolve(undefined);
          },
          flush() {
            return Promise.resolve(undefined);
          },
        };
    }
  }

  /**
   * Returns the epoch the response may keep acting under: its pre-flush one when another
   * flush overlapped this one, which stops it from adopting its cv or being cached.
   */
  private async flushForResponse(
    keyspace: CacheKeyspaceState,
    epochAtRequest: number,
  ): Promise<number> {
    const flushing = this.flushCache();
    const ownFlushEpoch = keyspace.flushEpoch;
    await flushing;
    return keyspace.flushEpoch === ownFlushEpoch ? ownFlushEpoch : epochAtRequest;
  }

  /**
   * Empties the cache this client writes to, including other clients' entries on a shared
   * provider, and drops the tracked cv of this client's access token only.
   */
  public async flushCache(): Promise<this> {
    // Before the await, so responses and requests during the flush see the new state.
    keyspaceState(this.cacheKeyspace).flushEpoch++;
    this.clearCacheVersion();
    await this.cacheProvider().flush();
    return this;
  }

  private async processInlineAssets(response: ISbResult): Promise<ISbResult> {
    if (!this.inlineAssets) {
      return response;
    }

    const processNode = (node: ISbField): unknown => {
      if (!node || typeof node !== "object") {
        return node;
      }

      if (Array.isArray(node)) {
        return node.map((item) => processNode(item));
      }

      let processedNode = { ...node };
      if (processedNode.fieldtype === "asset" && Array.isArray(response.data.assets)) {
        // Enrich the asset with an actual asset object
        processedNode = {
          ...response.data.assets.find((asset: any) => asset.id === processedNode.id),
          ...processedNode,
        };
      }

      // Recursively process all properties
      for (const key in processedNode) {
        if (typeof processedNode[key] === "object") {
          processedNode[key] = processNode(processedNode[key] as ISbField);
        }
      }

      return processedNode;
    };

    // Process the story content
    if (response.data.story) {
      response.data.story.content = processNode(response.data.story.content);
    }

    // Process all stories if present
    if (response.data.stories) {
      response.data.stories = response.data.stories.map((story: any) => {
        story.content = processNode(story.content);
        return story;
      });
    }

    return response;
  }
}

export default Storyblok;
