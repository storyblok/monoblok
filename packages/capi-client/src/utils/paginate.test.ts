import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { ClientError, createApiClient, PaginationError } from "../index";

const STORIES_URL = "https://api.storyblok.com/v2/cdn/stories";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const makeStory = (id: number) => ({
  id,
  uuid: `uuid-${id}`,
  name: `Story ${id}`,
  slug: `story-${id}`,
  full_slug: `story-${id}`,
  content: { _uid: `uid-${id}`, component: "page" },
});

type MockSpaceOptions = {
  storyCount: number;
  cv?: number;
  /** Omits the `Total` header, as some proxies strip it. */
  omitTotal?: boolean;
  failPage?: { page: number; status: number };
};

/** Serves `storyCount` stories, paginated like the Content Delivery API. */
const mockStories = ({ storyCount, cv = 100, omitTotal = false, failPage }: MockSpaceOptions) => {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get(STORIES_URL, ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      const page = Number(params.get("page") ?? 1);
      const perPage = Number(params.get("per_page") ?? 25);

      if (failPage?.page === page) {
        return HttpResponse.json({ error: "Failed" }, { status: failPage.status });
      }

      const stories = Array.from({ length: storyCount }, (_, index) => makeStory(index + 1)).slice(
        (page - 1) * perPage,
        page * perPage,
      );
      const headers: Record<string, string> = { "per-page": String(perPage) };
      if (!omitTotal) {
        headers.total = String(storyCount);
      }
      return HttpResponse.json({ stories, cv: Number(params.get("cv") ?? cv) }, { headers });
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

const createClient = (config: Parameters<typeof createApiClient>[0] = { accessToken: "token" }) =>
  createApiClient({ retry: { limit: 0 }, ...config });

describe("stories.iterate()", () => {
  it("should yield every story across all pages", async () => {
    const requests = mockStories({ storyCount: 5 });
    const client = createClient();

    const stories = await collect(client.stories.iterate({ query: { per_page: 2 } }));

    expect(stories.map((story) => story.id)).toEqual([1, 2, 3, 4, 5]);
    expect(requests.map((params) => params.get("page"))).toEqual(["1", "2", "3"]);
  });

  it("should stop at a short page when the API reports no total", async () => {
    const requests = mockStories({ storyCount: 5, omitTotal: true });
    const client = createClient();

    const stories = await collect(client.stories.iterate({ query: { per_page: 2 } }));

    expect(stories).toHaveLength(5);
    expect(requests).toHaveLength(3);
  });

  it("should request one extra empty page when the last page is full and no total is reported", async () => {
    const requests = mockStories({ storyCount: 4, omitTotal: true });
    const client = createClient();

    const stories = await collect(client.stories.iterate({ query: { per_page: 2 } }));

    expect(stories).toHaveLength(4);
    expect(requests).toHaveLength(3);
  });

  it("should start at the page given in the query", async () => {
    mockStories({ storyCount: 5 });
    const client = createClient();

    const stories = await collect(client.stories.iterate({ query: { per_page: 2, page: 2 } }));

    expect(stories.map((story) => story.id)).toEqual([3, 4, 5]);
  });

  it("should yield nothing for an empty space", async () => {
    const requests = mockStories({ storyCount: 0 });
    const client = createClient();

    const stories = await collect(client.stories.iterate());

    expect(stories).toEqual([]);
    expect(requests).toHaveLength(1);
  });

  it("should pin later pages to the cv of the first page", async () => {
    const requests = mockStories({ storyCount: 6, cv: 100 });
    // A publish observed mid-walk moves the client's tracked cv.
    server.use(
      http.get(`${STORIES_URL}/other`, () => HttpResponse.json({ story: makeStory(99), cv: 200 })),
    );
    const client = createClient();

    const walk = client.stories.iterate({ query: { per_page: 2 } });
    await walk.next();
    await client.stories.get("other");
    await collect(walk);

    expect(requests.map((params) => params.get("page"))).toEqual(["1", "2", "3"]);
    expect(requests[requests.length - 1]?.get("cv")).toBe("100");
  });

  it("should not pin draft pages to a cv", async () => {
    const requests = mockStories({ storyCount: 4 });
    const client = createClient();

    await collect(client.stories.iterate({ query: { per_page: 2, version: "draft" } }));

    expect(requests.every((params) => !params.has("cv"))).toBe(true);
  });

  it("should not pin pages to a cv when cv handling is manual", async () => {
    const requests = mockStories({ storyCount: 4 });
    const client = createClient({ accessToken: "token", cache: { cv: "manual" } });

    await collect(client.stories.iterate({ query: { per_page: 2 } }));

    expect(requests.every((params) => !params.has("cv"))).toBe(true);
  });

  it("should throw a PaginationError that resumes the walk at the failed page", async () => {
    mockStories({ storyCount: 6, cv: 100, failPage: { page: 2, status: 401 } });
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
    expect(error).toMatchObject({ page: 2, cv: 100, response: { status: 401 } });

    mockStories({ storyCount: 6, cv: 100 });
    const { page, cv } = error as PaginationError;
    const resumed = await collect(client.stories.iterate({ query: { per_page: 2, page, cv } }));
    expect(resumed.map((story) => story.id)).toEqual([3, 4, 5, 6]);
  });

  it("should fetch the next page while the current one is consumed", async () => {
    const requests = mockStories({ storyCount: 4 });
    const client = createClient();

    const walk = client.stories.iterate({ query: { per_page: 2 } });
    await walk.next();
    await expect.poll(() => requests.length).toBe(2);
    await walk.return();
  });

  it("should abort the prefetched request when the loop breaks", async () => {
    let prefetchStarted = false;
    let prefetchAborted: Promise<void> | undefined;
    server.use(
      http.get(STORIES_URL, ({ request }) => {
        const page = new URL(request.url).searchParams.get("page");
        if (page === "1") {
          return HttpResponse.json(
            { stories: [makeStory(1)], cv: 100 },
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
    mockStories({ storyCount: 3 });
    const client = createClient();

    const pages = await collect(client.stories.pages({ query: { per_page: 2 } }));

    expect(pages.map(({ page, perPage, total }) => ({ page, perPage, total }))).toEqual([
      { page: 1, perPage: 2, total: 3 },
      { page: 2, perPage: 2, total: 3 },
    ]);
    expect(pages.map((page) => page.data?.stories.map((story) => story.id))).toEqual([[1, 2], [3]]);
    expect(pages[0]?.response.status).toBe(200);
  });

  it("should end with the failed page's envelope", async () => {
    mockStories({ storyCount: 6, failPage: { page: 2, status: 401 } });
    const client = createClient();

    const pages = await collect(client.stories.pages({ query: { per_page: 2 } }));

    expect(pages).toHaveLength(2);
    expect(pages[1]).toMatchObject({ page: 2, response: { status: 401 } });
    expect(pages[1]?.data).toBeUndefined();
    expect(pages[1]?.error).toBeInstanceOf(ClientError);
  });

  it("should throw a PaginationError for a failed page with throwOnError", async () => {
    mockStories({ storyCount: 6, failPage: { page: 2, status: 401 } });
    const client = createClient({ accessToken: "token", throwOnError: true });
    const pageNumbers: number[] = [];

    const error = await (async () => {
      for await (const page of client.stories.pages({ query: { per_page: 2 } })) {
        pageNumbers.push(page.page);
      }
    })().catch((error: unknown) => error);

    expect(pageNumbers).toEqual([1]);
    expect(error).toBeInstanceOf(PaginationError);
    expect(error).toMatchObject({ page: 2 });
  });

  it("should not fetch a page before it is requested", async () => {
    const requests = mockStories({ storyCount: 4 });
    const client = createClient();

    const walk = client.stories.pages({ query: { per_page: 2 } });
    await walk.next();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(requests).toHaveLength(1);
    await walk.return();
  });

  it("should stop when the caller's signal aborts", async () => {
    mockStories({ storyCount: 4 });
    const client = createClient();
    const controller = new AbortController();

    const walk = client.stories.pages({ query: { per_page: 2 }, signal: controller.signal });
    const first = await walk.next();
    controller.abort();
    const pages = await collect(walk);

    expect(first.value?.error).toBeUndefined();
    expect(pages).toHaveLength(1);
    expect(pages[0]?.error).toBeInstanceOf(ClientError);
  });
});

describe("links.iterate()", () => {
  it("should switch on pagination and yield each link", async () => {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", ({ request }) => {
        const params = new URL(request.url).searchParams;
        requests.push(params);
        const uuid = `link-${params.get("page")}`;
        return HttpResponse.json(
          { links: { [uuid]: { id: Number(params.get("page")), uuid } } },
          { headers: { total: "2", "per-page": "1" } },
        );
      }),
    );
    const client = createClient();

    const links = await collect(client.links.iterate({ query: { per_page: 1 } }));

    expect(links.map((link) => link.uuid)).toEqual(["link-1", "link-2"]);
    expect(requests.every((params) => params.get("paginated") === "1")).toBe(true);
  });
});

describe("datasources.iterate()", () => {
  it("should yield each datasource across pages", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/datasources", ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        return HttpResponse.json(
          { datasources: [{ id: page, name: `Datasource ${page}`, slug: `ds-${page}` }] },
          { headers: { total: "2", "per-page": "1" } },
        );
      }),
    );
    const client = createClient();

    const datasources = await collect(client.datasources.iterate({ query: { per_page: 1 } }));

    expect(datasources.map((datasource) => datasource.id)).toEqual([1, 2]);
  });
});

describe("datasourceEntries.iterate()", () => {
  it("should yield each datasource entry across pages", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/datasource_entries", ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        return HttpResponse.json(
          { datasource_entries: [{ id: page, name: `entry-${page}`, value: `${page}` }] },
          { headers: { total: "2", "per-page": "1" } },
        );
      }),
    );
    const client = createClient();

    const entries = await collect(
      client.datasourceEntries.iterate({ query: { datasource: "colors", per_page: 1 } }),
    );

    expect(entries.map((entry) => entry.id)).toEqual([1, 2]);
  });
});
