import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { ClientError, createManagementApiClient, PaginationError } from "../index";

const SPACE_URL = "https://mapi.storyblok.com/v1/spaces/:space_id";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

type MockListOptions = {
  path: string;
  key: string;
  itemCount: number;
  failPage?: { page: number; status: number };
};

/** Serves `itemCount` items, paginated like the Management API. */
const mockList = ({ path, key, itemCount, failPage }: MockListOptions) => {
  const requests: { spaceId: string; params: URLSearchParams }[] = [];
  server.use(
    http.get(`${SPACE_URL}/${path}`, ({ request, params: pathParams }) => {
      const params = new URL(request.url).searchParams;
      requests.push({ spaceId: String(pathParams.space_id), params });
      const page = Number(params.get("page") ?? 1);
      const perPage = Number(params.get("per_page") ?? 25);

      if (failPage?.page === page) {
        return HttpResponse.json({ error: "Failed" }, { status: failPage.status });
      }

      const items = Array.from({ length: itemCount }, (_, index) => ({
        id: index + 1,
        name: `Item ${index + 1}`,
      })).slice((page - 1) * perPage, page * perPage);
      return HttpResponse.json(
        { [key]: items },
        { headers: { total: String(itemCount), "per-page": String(perPage) } },
      );
    }),
  );
  return requests;
};

const collect = async <T>(iterable: AsyncIterable<T>): Promise<T[]> => {
  const items: T[] = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
};

const createClient = (config: { throwOnError?: boolean } = {}) =>
  createManagementApiClient({
    personalAccessToken: "token",
    spaceId: 123,
    rateLimit: false,
    retry: { limit: 0 },
    ...config,
  });

describe("stories.iterate()", () => {
  it("should yield every story across all pages", async () => {
    const requests = mockList({ path: "stories", key: "stories", itemCount: 5 });
    const client = createClient();

    const stories = await collect(client.stories.iterate({ query: { per_page: 2 } }));

    expect(stories.map((story) => story.id)).toEqual([1, 2, 3, 4, 5]);
    expect(requests.map(({ params }) => params.get("page"))).toEqual(["1", "2", "3"]);
  });

  it("should walk the space given as a path override", async () => {
    const requests = mockList({ path: "stories", key: "stories", itemCount: 3 });
    const client = createClient();

    await collect(client.stories.iterate({ query: { per_page: 2 }, path: { space_id: 456 } }));

    expect(requests.map(({ spaceId }) => spaceId)).toEqual(["456", "456"]);
  });

  it("should throw a PaginationError that resumes the walk at the failed page", async () => {
    mockList({
      path: "stories",
      key: "stories",
      itemCount: 6,
      failPage: { page: 2, status: 401 },
    });
    const client = createClient();
    const received: number[] = [];

    const error = await (async () => {
      for await (const story of client.stories.iterate({ query: { per_page: 2 } })) {
        received.push(story.id);
      }
    })().catch((error: unknown) => error);

    expect(received).toEqual([1, 2]);
    expect(error).toBeInstanceOf(PaginationError);
    expect(error).toBeInstanceOf(ClientError);
    expect(error).toMatchObject({ page: 2, response: { status: 401 } });
    expect((error as PaginationError).message).toMatch(/^Page 2 failed: /);

    mockList({ path: "stories", key: "stories", itemCount: 6 });
    const { page } = error as PaginationError;
    const resumed = await collect(client.stories.iterate({ query: { per_page: 2, page } }));
    expect(resumed.map((story) => story.id)).toEqual([3, 4, 5, 6]);
  });

  it("should throw the original error when the caller's signal aborts", async () => {
    mockList({ path: "stories", key: "stories", itemCount: 6 });
    const client = createClient();
    const controller = new AbortController();

    const error = await (async () => {
      for await (const _story of client.stories.iterate({
        query: { per_page: 2 },
        signal: controller.signal,
      })) {
        controller.abort();
      }
    })().catch((error: unknown) => error);

    expect(error).not.toBeInstanceOf(ClientError);
    expect(error).toMatchObject({ name: "AbortError" });
  });

  it("should throw a PaginationError with the failed page when a request gets no response", async () => {
    server.use(
      http.get(`${SPACE_URL}/stories`, ({ request }) => {
        if (new URL(request.url).searchParams.get("page") === "2") {
          return HttpResponse.error();
        }
        return HttpResponse.json(
          { stories: [{ id: 1 }, { id: 2 }] },
          { headers: { total: "4", "per-page": "2" } },
        );
      }),
    );
    const client = createClient();

    const error = await collect(client.stories.iterate({ query: { per_page: 2 } })).catch(
      (error: unknown) => error,
    );

    expect(error).toBeInstanceOf(PaginationError);
    expect(error).toMatchObject({ page: 2, response: { status: 0 } });
  });

  it("should abort the prefetched request when the loop breaks", async () => {
    let prefetchStarted = false;
    let prefetchAborted: Promise<void> | undefined;
    server.use(
      http.get(`${SPACE_URL}/stories`, ({ request }) => {
        const page = new URL(request.url).searchParams.get("page");
        if (page === "1") {
          return HttpResponse.json(
            { stories: [{ id: 1, name: "Item 1" }] },
            { headers: { total: "2", "per-page": "1" } },
          );
        }
        prefetchStarted = true;
        prefetchAborted = new Promise((resolve) => {
          request.signal.addEventListener("abort", () => resolve());
        });
        return new Promise(() => {});
      }),
    );
    const client = createClient();

    for await (const story of client.stories.iterate({ query: { per_page: 1 } })) {
      expect(story.id).toBe(1);
      await expect.poll(() => prefetchStarted).toBe(true);
      break;
    }

    await expect(prefetchAborted).resolves.toBeUndefined();
  });
});

describe("stories.pages()", () => {
  it("should yield one envelope per page with its position in the walk", async () => {
    mockList({ path: "stories", key: "stories", itemCount: 3 });
    const client = createClient();

    const pages = await collect(client.stories.pages({ query: { per_page: 2 } }));

    expect(pages.map(({ page, perPage, total }) => ({ page, perPage, total }))).toEqual([
      { page: 1, perPage: 2, total: 3 },
      { page: 2, perPage: 2, total: 3 },
    ]);
  });

  it("should end with the failed page's envelope", async () => {
    mockList({
      path: "stories",
      key: "stories",
      itemCount: 6,
      failPage: { page: 2, status: 401 },
    });
    const client = createClient();

    const pages = await collect(client.stories.pages({ query: { per_page: 2 } }));

    expect(pages).toHaveLength(2);
    expect(pages[1]?.page).toBe(2);
    expect(pages[1]?.data).toBeUndefined();
    expect(pages[1]?.error).toBeInstanceOf(ClientError);
  });

  it("should throw a PaginationError for a failed page with throwOnError", async () => {
    mockList({
      path: "stories",
      key: "stories",
      itemCount: 6,
      failPage: { page: 2, status: 401 },
    });
    const client = createClient({ throwOnError: true });

    await expect(collect(client.stories.pages({ query: { per_page: 2 } }))).rejects.toMatchObject({
      name: "PaginationError",
      page: 2,
    });
  });
});

describe.each([
  { resource: "assets", path: "assets", key: "assets" },
  { resource: "datasources", path: "datasources", key: "datasources" },
  { resource: "datasourceEntries", path: "datasource_entries", key: "datasource_entries" },
  { resource: "internalTags", path: "internal_tags", key: "internal_tags" },
  { resource: "sharedAssets", path: "shared_assets", key: "assets" },
  { resource: "experiments", path: "experiments", key: "experiments" },
] as const)("$resource.iterate()", ({ resource, path, key }) => {
  it("should yield each item across pages", async () => {
    mockList({ path, key, itemCount: 3 });
    const client = createClient();

    const iterable: AsyncIterable<{ id?: number | string }> = client[resource].iterate({
      query: { per_page: 2 },
    });
    const items = await collect(iterable);

    expect(items.map((item) => item.id)).toEqual([1, 2, 3]);
  });
});

describe("datasourceEntries.iterate()", () => {
  it("should page through entries of a data source given by slug", async () => {
    const entryCount = 30;
    // Filtering by slug paginates only when `per_page` is sent; otherwise every entry
    // comes back on every page, without pagination headers.
    server.use(
      http.get(`${SPACE_URL}/datasource_entries`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        const entries = Array.from({ length: entryCount }, (_, index) => ({ id: index + 1 }));
        if (!params.has("per_page")) {
          return HttpResponse.json({ datasource_entries: entries });
        }
        const page = Number(params.get("page") ?? 1);
        const perPage = Number(params.get("per_page"));
        return HttpResponse.json(
          { datasource_entries: entries.slice((page - 1) * perPage, page * perPage) },
          { headers: { total: String(entryCount), "per-page": String(perPage) } },
        );
      }),
    );
    const client = createClient();

    const entries = await collect(
      client.datasourceEntries.iterate({ query: { datasource_slug: "colors" } }),
    );

    expect(entries.map((entry) => entry.id)).toEqual(
      Array.from({ length: entryCount }, (_, index) => index + 1),
    );
  });
});

describe("sharedInternalTags.iterate()", () => {
  it("should yield each shared internal tag across pages", async () => {
    mockList({ path: "shared_internal_tags", key: "internal_tags", itemCount: 3 });
    const client = createClient();

    const tags = await collect(
      client.sharedInternalTags.iterate({ query: { asset_folder_id: 1, per_page: 2 } }),
    );

    expect(tags.map((tag) => tag.id)).toEqual([1, 2, 3]);
  });
});
