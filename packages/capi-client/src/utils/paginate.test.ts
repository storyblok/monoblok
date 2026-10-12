import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { setupServer } from "msw/node";
import { delay, http, HttpResponse } from "msw";
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
    expect(error).toMatchObject({
      reason: "request",
      page: 2,
      cv: 100,
      response: { status: 401 },
    });
    expect((error as PaginationError).message).toMatch(/^Page 2 failed: /);
    expect((error as PaginationError).cause).toBeInstanceOf(ClientError);

    mockStories({ storyCount: 6, cv: 100 });
    const { page, cv } = error as PaginationError;
    const resumed = await collect(client.stories.iterate({ query: { per_page: 2, page, cv } }));
    expect(resumed.map((story) => story.id)).toEqual([3, 4, 5, 6]);
  });

  it("should send the default page size when the query sets none", async () => {
    const requests = mockStories({ storyCount: 3 });
    const client = createClient();

    await collect(client.stories.iterate());

    expect(requests[0]?.get("per_page")).toBe("25");
  });

  it("should fail with a restart from the first page when a later page leaves the pinned cv", async () => {
    // The edge redirects a `cv` it no longer holds to the current one.
    server.use(
      http.get(STORIES_URL, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        return HttpResponse.json(
          { stories: [makeStory(page)], cv: page === 1 ? 100 : 200 },
          { headers: { total: "3", "per-page": "1" } },
        );
      }),
    );
    const client = createClient();
    const received: number[] = [];

    const error = await (async () => {
      for await (const story of client.stories.iterate({ query: { per_page: 1 } })) {
        received.push(story.id);
      }
    })().catch((error: unknown) => error);

    expect(received).toEqual([1]);
    expect(error).toBeInstanceOf(PaginationError);
    expect(error).toMatchObject({ reason: "snapshot-changed", page: 1, cv: undefined });
    expect((error as PaginationError).message).toMatch(/^Page 2 failed: /);
  });

  it("should throw the original error when the caller's signal aborts", async () => {
    mockStories({ storyCount: 6 });
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

  it("should stop when the caller's signal aborts while pages come from the cache", async () => {
    mockStories({ storyCount: 6 });
    const client = createClient();
    await collect(client.stories.iterate({ query: { per_page: 2 } }));
    const controller = new AbortController();
    const received: number[] = [];

    const error = await (async () => {
      for await (const story of client.stories.iterate({
        query: { per_page: 2 },
        signal: controller.signal,
      })) {
        received.push(story.id);
        controller.abort();
      }
    })().catch((error: unknown) => error);

    expect(received).toEqual([1]);
    expect(error).toMatchObject({ name: "AbortError" });
  });

  it("should throw a PaginationError with the failed page when a request gets no response", async () => {
    server.use(
      http.get(STORIES_URL, ({ request }) => {
        const page = new URL(request.url).searchParams.get("page");
        if (page === "2") {
          return HttpResponse.error();
        }
        return HttpResponse.json(
          { stories: [makeStory(1), makeStory(2)], cv: 100 },
          { headers: { total: "4", "per-page": "2" } },
        );
      }),
    );
    const client = createClient();

    const error = await collect(client.stories.iterate({ query: { per_page: 2 } })).catch(
      (error: unknown) => error,
    );

    expect(error).toBeInstanceOf(PaginationError);
    expect(error).toMatchObject({ reason: "request", page: 2, cv: 100, response: { status: 0 } });
    expect((error as PaginationError).cause).toMatchObject({ cause: expect.any(Error) });
  });

  it("should restart from page 1 when a resumed walk's cv is no longer served", async () => {
    // The edge redirects a `cv` it no longer holds to the current one.
    server.use(
      http.get(STORIES_URL, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        return HttpResponse.json(
          { stories: [makeStory(page)], cv: 200 },
          { headers: { total: "4", "per-page": "1" } },
        );
      }),
    );
    const client = createClient();

    const error = await collect(
      client.stories.iterate({ query: { per_page: 1, page: 3, cv: 100 } }),
    ).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(PaginationError);
    expect(error).toMatchObject({ page: 1, cv: undefined });
  });

  it("should let a stale-while-revalidate cache refresh the pages it walked", async () => {
    const requests = mockStories({ storyCount: 4 });
    server.use(
      http.get(STORIES_URL, async () => {
        if (requests.length >= 2) {
          // Outlasts the walk, so revalidation is still in flight when it ends.
          await delay(50);
        }
        return undefined;
      }),
    );
    const onRevalidationError = vi.fn();
    const client = createClient({
      accessToken: "token",
      cache: { strategy: "swr", onRevalidationError },
    });

    await collect(client.stories.iterate({ query: { per_page: 2 } }));
    await collect(client.stories.iterate({ query: { per_page: 2 } }));

    await vi.waitFor(() => expect(requests).toHaveLength(4));
    await delay(100);
    expect(onRevalidationError).not.toHaveBeenCalled();
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

  it("should keep the resumed cv when the resumed walk's first page fails", async () => {
    mockStories({ storyCount: 6, cv: 100, failPage: { page: 3, status: 500 } });
    const client = createClient();

    const error = await collect(
      client.stories.iterate({ query: { per_page: 1, page: 3, cv: 100 } }),
    ).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(PaginationError);
    expect(error).toMatchObject({ reason: "request", page: 3, cv: 100 });
  });

  it("should pin the served cv when a walk from page 1 is given a cv the API doesn't serve", async () => {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get(STORIES_URL, ({ request }) => {
        const params = new URL(request.url).searchParams;
        requests.push(params);
        const page = Number(params.get("page"));
        // Served as if redirected to the current cv, whatever cv was requested.
        return HttpResponse.json(
          { stories: [makeStory(page)], cv: 200 },
          { headers: { total: "2", "per-page": "1" } },
        );
      }),
    );
    const client = createClient();

    const stories = await collect(
      client.stories.iterate({ query: { per_page: 1, cv: 1791792409312 } }),
    );

    expect(stories.map((story) => story.id)).toEqual([1, 2]);
    expect(requests[1]?.get("cv")).toBe("200");
  });

  it("should keep walking when the API caps the page size below the requested per_page", async () => {
    const API_PAGE_SIZE_LIMIT = 2;
    server.use(
      http.get(STORIES_URL, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page"));
        const stories = [1, 2, 3, 4, 5]
          .slice((page - 1) * API_PAGE_SIZE_LIMIT, page * API_PAGE_SIZE_LIMIT)
          .map(makeStory);
        return HttpResponse.json({ stories, cv: 100 }, { headers: { total: "5" } });
      }),
    );
    const client = createClient();

    const stories = await collect(client.stories.iterate({ query: { per_page: 10 } }));

    expect(stories.map((story) => story.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("should fail with a PaginationError when a page has no items", async () => {
    server.use(http.get(STORIES_URL, () => HttpResponse.json({ cv: 100 })));
    const client = createClient();

    const error = await collect(client.stories.iterate()).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(PaginationError);
    expect(error).toMatchObject({ reason: "invalid-response", page: 1 });
  });

  it("should fail with a PaginationError when a page isn't valid JSON", async () => {
    server.use(
      http.get(
        STORIES_URL,
        () =>
          new HttpResponse("<html></html>", { headers: { "content-type": "application/json" } }),
      ),
    );
    const client = createClient();

    const error = await collect(client.stories.iterate()).catch((error: unknown) => error);

    expect(error).toBeInstanceOf(PaginationError);
    expect(error).toMatchObject({ reason: "invalid-response", page: 1 });
  });

  it("should fail with a PaginationError when a page repeats the previous one", async () => {
    // An endpoint that ignores `page` and reports no total would otherwise never end.
    const requests: URLSearchParams[] = [];
    server.use(
      http.get(STORIES_URL, ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        return HttpResponse.json({ stories: [makeStory(1), makeStory(2)], cv: 100 });
      }),
    );
    const client = createClient();

    const error = await collect(client.stories.iterate({ query: { per_page: 2 } })).catch(
      (error: unknown) => error,
    );

    expect(error).toBeInstanceOf(PaginationError);
    expect(error).toMatchObject({ reason: "invalid-response", page: 2 });
    expect(requests).toHaveLength(2);
  });

  it("should throw a TypeError for resolve_links, which only pages() exposes", () => {
    const client = createClient();

    expect(() =>
      // @ts-expect-error `resolve_links` is excluded from `iterate()`.
      client.stories.iterate({ query: { resolve_links: "url" } }),
    ).toThrow(TypeError);
  });

  it("should throw a TypeError for resolve_relations without inlineRelations", () => {
    const client = createClient();

    expect(() =>
      // @ts-expect-error `resolve_relations` needs `inlineRelations`.
      client.stories.iterate({ query: { resolve_relations: "page.author" } }),
    ).toThrow(TypeError);
  });

  it("should not abort the revalidation of a cached page when the loop breaks", async () => {
    const requests = mockStories({ storyCount: 2 });
    server.use(
      http.get(STORIES_URL, async () => {
        if (requests.length > 2) {
          await delay(20);
        }
        return undefined;
      }),
    );
    const onRevalidationError = vi.fn();
    const client = createClient({
      accessToken: "token",
      cache: { strategy: "swr", onRevalidationError },
    });
    await collect(client.stories.iterate({ query: { per_page: 1 } }));

    for await (const _story of client.stories.iterate({ query: { per_page: 1 } })) {
      break;
    }

    await vi.waitFor(() => expect(requests).toHaveLength(4));
    await delay(50);
    expect(onRevalidationError).not.toHaveBeenCalled();
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

  it("should complete a restarted walk after content was published mid-walk", async () => {
    let currentCv = 100;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", ({ request }) => {
        const url = new URL(request.url);
        // The edge redirects a `cv` it no longer holds to the current one.
        if (url.searchParams.get("cv") !== String(currentCv)) {
          url.searchParams.set("cv", String(currentCv));
          return HttpResponse.redirect(url.toString(), 301);
        }
        const page = url.searchParams.get("page");
        const uuid = `link-${page}`;
        return HttpResponse.json(
          { links: { [uuid]: { id: Number(page), uuid } } },
          { headers: { total: "2", "per-page": "1" } },
        );
      }),
      http.get(`${STORIES_URL}/:slug`, () =>
        HttpResponse.json({ story: makeStory(99), cv: currentCv }),
      ),
    );
    const client = createClient();
    await client.stories.get("home");

    const walk = client.links.pages({ query: { per_page: 1 } });
    await walk.next();
    currentCv = 200;
    const [failed] = await collect(walk);
    expect(failed?.error).toBeInstanceOf(PaginationError);

    const links = await collect(client.links.iterate({ query: { per_page: 1 } }));
    expect(links.map((link) => link.uuid)).toEqual(["link-1", "link-2"]);
  });

  it("should pin later pages to the cv in the first page's URL", async () => {
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
      http.get(`${STORIES_URL}/:slug`, ({ params }) =>
        HttpResponse.json({ story: makeStory(99), cv: params.slug === "before" ? 100 : 200 }),
      ),
    );
    const client = createClient();
    await client.stories.get("before");

    const walk = client.links.pages({ query: { per_page: 1 } });
    await walk.next();
    // A publish observed mid-walk moves the client's tracked cv.
    await client.stories.get("after");
    await collect(walk);

    expect(requests.map((params) => params.get("cv"))).toEqual(["100", "100"]);
  });
});

describe("datasources.iterate()", () => {
  it("should yield each data source across pages", async () => {
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
  it("should yield each data source entry across pages", async () => {
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
