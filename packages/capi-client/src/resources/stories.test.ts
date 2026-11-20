import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createApiClient } from "../index";
import type { CacheEntry, CacheProvider } from "../index";
import { ClientError } from "../error";
import { createMemoryCacheProvider } from "../utils/cache";

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const makeStory = (uuid: string, content: Record<string, unknown>) => {
  return {
    alternates: [],
    content,
    created_at: "2024-01-01T00:00:00.000Z",
    default_full_slug: `default/${uuid}`,
    first_published_at: "2024-01-01T00:00:00.000Z",
    full_slug: `stories/${uuid}`,
    group_id: `group-${uuid}`,
    id: Number.parseInt(uuid.replace(/\D/g, ""), 10) || 1,
    is_startpage: false,
    lang: "default",
    localized_paths: [],
    name: `Story ${uuid}`,
    parent_id: 0,
    path: `stories/${uuid}`,
    position: 0,
    published_at: "2024-01-01T00:00:00.000Z",
    release_id: 0,
    slug: uuid,
    sort_by_date: "2024-01-01",
    tag_list: [],
    translated_slugs: [],
    updated_at: "2024-01-01T00:00:00.000Z",
    uuid,
  };
};

describe("stories.get()", () => {
  it("should successfully retrieve a single story", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () =>
        HttpResponse.json({ story: makeStory("test-story", { component: "page", _uid: "uid-1" }) }),
      ),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    const result = await client.stories.get("test-story");

    expect(result.error).toBeUndefined();
    expect(typeof result.data?.story).toBe("object");
  });

  it("should return a synthetic response for transport failures on resource calls", async () => {
    // stories.get() goes through asApiResponse rather than the generic get()/request()
    // path — this pins that it gets the same Response/Request normalization.
    server.use(http.get("https://api.storyblok.com/v2/cdn/stories/*", () => HttpResponse.error()));
    const client = createApiClient({
      accessToken: "test-token",
      retry: { limit: 0 },
    });

    const result = await client.stories.get("test-story");

    expect(result.error).toBeDefined();
    // ApiResponse types `error` as `ClientError` unconditionally — a transport failure
    // has to be wrapped to match, not passed through as the raw `TypeError`, or code
    // written against the documented type (e.g. `result.error?.response.status`) throws
    // at runtime on exactly the failure case this guards.
    expect(result.error).toBeInstanceOf(ClientError);
    expect(result.error?.response.status).toBe(0);
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(0);
    expect(result.request).toBeInstanceOf(Request);
  });

  it("should keep the original error when baseUrl is unparseable on a transport failure", async () => {
    // A malformed `baseUrl` makes the generated client's own `Request` construction
    // throw before a request/response ever exists, so the fallback below has to build
    // its own placeholder `Request` from that same broken `baseUrl` — and must not let
    // that throw too, or it silently replaces `result.error.cause` (with the full
    // attempted URL) with a less useful "baseUrl is invalid" error instead.
    const client = createApiClient({
      accessToken: "test-token",
      baseUrl: "not a url",
      retry: { limit: 0 },
    });

    const result = await client.stories.get("test-story");

    expect(result.error).toBeDefined();
    expect((result.error?.cause as Error | undefined)?.message).toContain("test-story");
    expect(result.request).toBeInstanceOf(Request);
  });

  it("should retry on 429", async () => {
    vi.useFakeTimers();
    let requestCount = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", async () => {
        requestCount++;
        if (requestCount === 1) {
          return new HttpResponse(null, {
            status: 429,
          });
        }

        return HttpResponse.json({
          story: {
            id: 123,
            name: "test-story",
            slug: "test-story",
            full_slug: "test-story",
            created_at: "2024-01-01T00:00:00.000Z",
            published_at: "2024-01-01T00:00:00.000Z",
            content: {},
          },
        });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    const resultPromise = client.stories.get("test-story");
    await vi.runOnlyPendingTimersAsync();
    const result = await resultPromise;

    expect(result.error).toBeUndefined();
    expect(typeof result.data?.story).toBe("object");
    expect(requestCount).toBe(2);
    vi.useRealTimers();
  });

  it("should return error in response when throwOnError is false (default)", async () => {
    vi.useFakeTimers();
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () => {
        return HttpResponse.json(
          {
            error: "Not Found",
            message: "Story not found",
          },
          { status: 404 },
        );
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    const resultPromise = client.stories.get("non-existent-story");
    await vi.runOnlyPendingTimersAsync();
    const result = await resultPromise;

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(404);
    vi.useRealTimers();
  });

  it("should throw error when throwOnError is true", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () => {
        return HttpResponse.json(
          {
            error: "Not Found",
            message: "Story not found",
          },
          { status: 404 },
        );
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      throwOnError: true,
    });

    await expect(client.stories.get("non-existent-story")).rejects.toThrow();
  });

  it("should preserve the original error as cause when throwOnError is true", async () => {
    server.use(http.get("https://api.storyblok.com/v2/cdn/stories/*", () => HttpResponse.error()));
    const client = createApiClient({
      accessToken: "test-token",
      throwOnError: true,
      retry: { limit: 0 },
    });

    await expect(client.stories.get("non-existent-story")).rejects.toMatchObject({
      cause: expect.anything(),
    });
  });

  it("should allow overriding throwOnError per stories method call", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () => {
        return HttpResponse.json(
          {
            error: "Not Found",
            message: "Story not found",
          },
          { status: 404 },
        );
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    await expect(
      client.stories.get("non-existent-story", { throwOnError: true }),
    ).rejects.toThrow();
  });

  it("should automatically add find_by=uuid when identifier is a UUID", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          story: makeStory("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", {
            component: "page",
            _uid: "uid-1",
          }),
        });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.stories.get("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

    expect(new URL(capturedUrl!).searchParams.get("find_by")).toBe("uuid");
  });

  it("should not override an explicit find_by when identifier is a UUID", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          story: makeStory("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", {
            component: "page",
            _uid: "uid-1",
          }),
        });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.stories.get("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", {
      query: { find_by: "uuid" },
    });

    const params = new URL(capturedUrl!).searchParams;
    expect(params.getAll("find_by")).toEqual(["uuid"]); // exactly once, not duplicated
  });

  it("should not add find_by for a non-UUID string identifier", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          story: makeStory("test-story", { component: "page", _uid: "uid-1" }),
        });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.stories.get("test-story");

    expect(new URL(capturedUrl!).searchParams.has("find_by")).toBe(false);
  });

  it("should not add find_by for a numeric identifier", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ story: makeStory("123", { component: "page", _uid: "uid-1" }) });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.stories.get("123");

    expect(new URL(capturedUrl!).searchParams.has("find_by")).toBe(false);
  });

  it("should join excluding_story_fields array into a comma-separated query param", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          story: makeStory("home", { component: "page", _uid: "uid-1" }),
        });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.stories.get("home", {
      query: { excluding_story_fields: ["translated_slugs", "alternates"] },
    });

    expect(new URL(capturedUrl!).searchParams.get("excluding_story_fields")).toBe(
      "translated_slugs,alternates",
    );
  });

  it("should forward excluding_story_fields string unchanged", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          story: makeStory("home", { component: "page", _uid: "uid-1" }),
        });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.stories.get("home", {
      query: { excluding_story_fields: "translated_slugs" },
    });

    expect(new URL(capturedUrl!).searchParams.get("excluding_story_fields")).toBe(
      "translated_slugs",
    );
  });

  it("should omit excluding_story_fields when passed an empty array", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          story: makeStory("home", { component: "page", _uid: "uid-1" }),
        });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.stories.get("home", {
      query: { excluding_story_fields: [] as any },
    });

    expect(new URL(capturedUrl!).searchParams.has("excluding_story_fields")).toBe(false);
  });
});

describe("stories.list()", () => {
  it("should successfully retrieve multiple stories", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", () =>
        HttpResponse.json({ stories: [makeStory("s1", { component: "page", _uid: "u1" })] }),
      ),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    const result = await client.stories.list();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.stories)).toBe(true);
  });

  it("should join excluding_story_fields array into a comma-separated query param", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ stories: [] });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.stories.list({
      query: { excluding_story_fields: ["translated_slugs", "alternates", "created_at"] },
    });

    expect(new URL(capturedUrl!).searchParams.get("excluding_story_fields")).toBe(
      "translated_slugs,alternates,created_at",
    );
  });

  it("should forward excluding_story_fields string unchanged", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ stories: [] });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.stories.list({
      query: { excluding_story_fields: "translated_slugs" },
    });

    expect(new URL(capturedUrl!).searchParams.get("excluding_story_fields")).toBe(
      "translated_slugs",
    );
  });

  it("should omit excluding_story_fields when passed an empty array", async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ stories: [] });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await client.stories.list({
      query: { excluding_story_fields: [] as any },
    });

    expect(new URL(capturedUrl!).searchParams.has("excluding_story_fields")).toBe(false);
  });
});

describe("inlineRelations", () => {
  it("should keep default behavior when inlineRelations is false", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () => {
        return HttpResponse.json({
          rels: [
            makeStory("author-1", {
              _uid: "author-content-1",
              component: "author",
              name: "Ada",
            }),
          ],
          story: makeStory("page-1", {
            _uid: "page-content-1",
            author: "author-1",
            component: "page",
          }),
        });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    const result = await client.stories.get("test-story", {
      query: { resolve_relations: "page.author" },
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.story.content.author).toBe("author-1");
  });

  it("should inline relations for stories.get()", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () => {
        return HttpResponse.json({
          rels: [
            makeStory("author-1", {
              _uid: "author-content-1",
              component: "author",
              name: "Pat",
            }),
            makeStory("article-1", {
              _uid: "article-content-1",
              component: "article",
              title: "Foo",
            }),
            makeStory("article-2", {
              _uid: "article-content-2",
              component: "article",
              title: "Bar",
            }),
          ],
          story: makeStory("page-1", {
            _uid: "page-content-1",
            author: "author-1",
            articles: ["article-1"],
            teaser: [
              {
                _uid: "teaser-content-1",
                component: "teaser",
                articles: ["article-2"],
              },
            ],
            component: "page",
          }),
        });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      inlineRelations: true,
    });

    const result = await client.stories.get("test-story", {
      query: { resolve_relations: "page.author,page.articles,teaser.articles" },
    });

    expect(result.error).toBeUndefined();
    const content = result.data?.story.content;
    expect(content?.author).toMatchObject({ uuid: "author-1" });
    expect(content?.articles).toMatchObject([{ uuid: "article-1" }]);
    expect((content?.teaser as any)?.[0].articles).toMatchObject([{ uuid: "article-2" }]);
  });

  it("should auto-fetch rel_uuids and inline fetched stories", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () => {
        return HttpResponse.json({
          rel_uuids: ["author-1"],
          story: makeStory("page-1", {
            _uid: "page-content-1",
            author: "author-1",
            component: "page",
          }),
        });
      }),
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("by_uuids") === "author-1") {
          return HttpResponse.json({
            stories: [
              makeStory("author-1", {
                _uid: "author-content-1",
                component: "author",
                name: "Kai",
              }),
            ],
          });
        }

        return HttpResponse.json({ stories: [] });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      inlineRelations: true,
    });

    const result = await client.stories.get("test-story", {
      query: { resolve_relations: "page.author" },
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.story.content.author).toMatchObject({ uuid: "author-1" });
  });

  it("should not deadlock when fetching rel_uuids with a fixed rateLimit", async () => {
    vi.useFakeTimers();
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () => {
        return HttpResponse.json({
          rel_uuids: ["author-deadlock"],
          story: makeStory("page-deadlock", {
            _uid: "page-content-deadlock",
            author: "author-deadlock",
            component: "page",
          }),
        });
      }),
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("by_uuids") === "author-deadlock") {
          return HttpResponse.json({
            stories: [
              makeStory("author-deadlock", {
                _uid: "author-content-deadlock",
                component: "author",
                name: "DeadlockAuthor",
              }),
            ],
          });
        }

        return HttpResponse.json({ stories: [] });
      }),
    );

    // A fixed rateLimit of 1 means a single shared throttle queue with 1 slot.
    // stories.get() -> requestWithCache -> throttleManager.execute (takes the slot)
    //   -> fetchMissingRelations -> throttleManager.execute (waits for a slot that never frees)
    // This causes a deadlock because the outer slot is held while the inner call waits.
    const client = createApiClient({
      accessToken: "test-token",
      inlineRelations: true,
      rateLimit: 1,
    });

    const DEADLOCK = Symbol("deadlock");
    const deadline = new Promise<typeof DEADLOCK>((resolve) =>
      setTimeout(() => resolve(DEADLOCK), 500),
    );
    const resultPromise = client.stories.get("test-story", {
      query: { resolve_relations: "page.author" },
    });

    await vi.advanceTimersByTimeAsync(1_000);
    const outcome = await Promise.race([resultPromise, deadline]);

    // If the bug is fixed the request should resolve with data, not hit the deadline.
    expect(outcome).not.toBe(DEADLOCK);
    vi.useRealTimers();
  });

  it("should not deadlock when multiple concurrent requests fetch rel_uuids with a fixed rateLimit", async () => {
    vi.useFakeTimers();
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/:slug", ({ params }) => {
        const slug = params.slug as string;
        return HttpResponse.json({
          rel_uuids: [`author-${slug}`],
          story: makeStory(`page-${slug}`, {
            _uid: `page-content-${slug}`,
            author: `author-${slug}`,
            component: "page",
          }),
        });
      }),
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const byUuids = url.searchParams.get("by_uuids");
        if (byUuids) {
          return HttpResponse.json({
            stories: [
              makeStory(byUuids, {
                _uid: `author-content-${byUuids}`,
                component: "author",
                name: `Author ${byUuids}`,
              }),
            ],
          });
        }

        return HttpResponse.json({ stories: [] });
      }),
    );

    // With rateLimit: 3, three concurrent requests will saturate all slots.
    // Each outer request holds a slot while awaiting fetchMissingRelations,
    // which needs a slot from the same queue — classic deadlock.
    const client = createApiClient({
      accessToken: "test-token",
      inlineRelations: true,
      rateLimit: 3,
    });

    const DEADLOCK = Symbol("deadlock");
    const deadline = new Promise<typeof DEADLOCK>((resolve) =>
      setTimeout(() => resolve(DEADLOCK), 500),
    );
    const resultsPromise = Promise.all([
      client.stories.get("story-a", { query: { resolve_relations: "page.author" } }),
      client.stories.get("story-b", { query: { resolve_relations: "page.author" } }),
      client.stories.get("story-c", { query: { resolve_relations: "page.author" } }),
    ]);

    await vi.advanceTimersByTimeAsync(1_000);
    const outcome = await Promise.race([resultsPromise, deadline]);

    expect(outcome).not.toBe(DEADLOCK);
    vi.useRealTimers();
  });

  it("should return an error when fetching relations fails", async () => {
    vi.useFakeTimers();
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () => {
        return HttpResponse.json({
          rel_uuids: ["author-throw"],
          story: makeStory("page-throw", {
            _uid: "page-content-throw",
            author: "author-throw",
            component: "page",
          }),
        });
      }),
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        return HttpResponse.json({ message: "Nope" }, { status: 500 });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      inlineRelations: true,
    });

    const resultPromise = client.stories.get("test-story", {
      query: { resolve_relations: "page.author" },
    });
    const [result] = await Promise.all([resultPromise, vi.runAllTimersAsync()]);
    vi.useRealTimers();

    expect(result.data).toBeUndefined();
    expect(result.error).toBeInstanceOf(ClientError);
  });

  it("should merge inline relations from rels and rel_uuids for stories.list()", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const byUuids = url.searchParams.get("by_uuids");

        if (byUuids) {
          return HttpResponse.json({
            stories: [
              makeStory("author-1", {
                _uid: "author-content-1",
                component: "author",
                name: "Lee",
              }),
            ],
          });
        }

        return HttpResponse.json({
          rel_uuids: ["author-1"],
          rels: [
            makeStory("author-2", {
              _uid: "author-content-2",
              component: "author",
              name: "Sam",
            }),
          ],
          stories: [
            makeStory("page-1", {
              _uid: "page-content-1",
              authors: ["author-1", "author-2"],
              component: "page",
            }),
          ],
        });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      inlineRelations: true,
    });

    const result = await client.stories.list({
      query: { resolve_relations: "page.authors" },
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.stories[0]?.content.authors).toMatchObject([
      { uuid: "author-1" },
      { uuid: "author-2" },
    ]);
    expect(result.data?.rels).toHaveLength(1);
    expect(result.data?.rel_uuids).toEqual(["author-1"]);
  });

  it("should not share cache between generic get and stories.get", async () => {
    let requestCount = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () => {
        requestCount++;
        return HttpResponse.json({
          story: makeStory("home", {
            _uid: "page-content-1",
            component: "page",
            author: "author-1",
          }),
          rels: [
            makeStory("author-1", {
              _uid: "author-content-1",
              component: "author",
              name: "Ada",
            }),
          ],
          cv: 1,
        });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      inlineRelations: true,
    });

    const genericResult = await client.get("v2/cdn/stories/home", {
      query: { version: "published", resolve_relations: "page.author" },
    });
    const storiesResult = await client.stories.get("home", {
      query: { version: "published", resolve_relations: "page.author" },
    });

    expect(requestCount).toBe(2);
    // @ts-expect-error generic get returns untyped data
    expect(genericResult.data?.story.content.author).toBe("author-1");
    expect(storiesResult.data?.story.content.author).toMatchObject({ uuid: "author-1" });
  });
});

describe("fetchOptions", () => {
  it("should forward non-standard fetchOptions to the underlying fetch call", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ story: makeStory("test", { component: "page", _uid: "uid-1" }) }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const client = createApiClient({
      accessToken: "test-token",
      fetch: fetchSpy,
      rateLimit: false,
      retry: { limit: 0 },
    });

    await client.stories.get("test-story", {
      fetchOptions: { next: { revalidate: 60 } },
    });

    expect(fetchSpy).toHaveBeenCalled();
    const [, fetchInit] = fetchSpy.mock.calls[0];
    expect(fetchInit).toMatchObject({ next: { revalidate: 60 } });
  });

  it("should forward fetchOptions in stories.list()", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ stories: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createApiClient({
      accessToken: "test-token",
      fetch: fetchSpy,
      rateLimit: false,
      retry: { limit: 0 },
    });

    await client.stories.list({
      fetchOptions: { next: { revalidate: 120, tags: ["stories"] } },
    });

    expect(fetchSpy).toHaveBeenCalled();
    const [, fetchInit] = fetchSpy.mock.calls[0];
    expect(fetchInit).toMatchObject({ next: { revalidate: 120, tags: ["stories"] } });
  });

  it("should not pass kyOptions when fetchOptions is omitted", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ story: makeStory("test", { component: "page", _uid: "uid-1" }) }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const client = createApiClient({
      accessToken: "test-token",
      fetch: fetchSpy,
      rateLimit: false,
      retry: { limit: 0 },
    });

    await client.stories.get("test-story");

    expect(fetchSpy).toHaveBeenCalled();
    const [, fetchInit] = fetchSpy.mock.calls[0];
    expect(fetchInit).not.toHaveProperty("next");
  });
});

describe("generic GET method", () => {
  it("should perform GET requests with query params", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          query: {
            starts_with: url.searchParams.get("starts_with"),
            token: url.searchParams.get("token"),
            version: url.searchParams.get("version"),
          },
        });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    const result = await client.get("v2/cdn/links", {
      query: {
        starts_with: "docs/",
        version: "published",
      },
    });

    expect(result.error).toBeUndefined();
    // @ts-expect-error generic get request can have any shape or form
    expect(result.data?.query).toEqual({
      starts_with: "docs/",
      token: "test-token",
      version: "published",
    });
  });

  it("should return error when throwOnError is false", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/custom-endpoint", () => {
        return HttpResponse.json({ message: "Nope" }, { status: 404 });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    const result = await client.get("v2/cdn/custom-endpoint");

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(404);
  });

  it("should throw error when throwOnError is true", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/custom-endpoint", () => {
        return HttpResponse.json({ message: "Nope" }, { status: 404 });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      throwOnError: true,
    });

    await expect(client.get("v2/cdn/custom-endpoint")).rejects.toThrow();
  });

  it("should allow overriding throwOnError per generic get call", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/custom-endpoint", () => {
        return HttpResponse.json({ message: "Nope" }, { status: 404 });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    await expect(client.get("v2/cdn/custom-endpoint", { throwOnError: true })).rejects.toThrow();
  });
});

describe("cache and cv", () => {
  it("should use in-memory cache by default for published CDN GET requests", async () => {
    let requestCount = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        requestCount++;
        return HttpResponse.json({
          links: {},
          cv: 1,
        });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    await client.get("v2/cdn/links", {
      query: { version: "published" },
    });
    await client.get("v2/cdn/links", {
      query: { version: "published" },
    });

    expect(requestCount).toBe(1);
  });

  it("should not cache draft requests", async () => {
    let requestCount = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        requestCount++;
        return HttpResponse.json({ links: {} });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    await client.get("v2/cdn/links", {
      query: { version: "draft" },
    });
    await client.get("v2/cdn/links", {
      query: { version: "draft" },
    });

    expect(requestCount).toBe(2);
  });

  it("should flush cache when cv changes", async () => {
    let requestCount = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", ({ request }: { request: Request }) => {
        requestCount++;
        const url = new URL(request.url);
        const page = url.searchParams.get("page");

        if (page === "2") {
          return HttpResponse.json({ links: {}, cv: 2 });
        }

        return HttpResponse.json({ links: {}, cv: 1 });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    await client.get("v2/cdn/links", {
      query: { version: "published", page: 1 },
    });
    await client.get("v2/cdn/links", {
      query: { version: "published", page: 1 },
    });
    await client.get("v2/cdn/links", {
      query: { version: "published", page: 2 },
    });
    await client.get("v2/cdn/links", {
      query: { version: "published", page: 1 },
    });

    expect(requestCount).toBe(3);
  });

  it("should not auto-flush cache when cv changes and flush is manual", async () => {
    let requestCount = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", ({ request }: { request: Request }) => {
        requestCount++;
        const url = new URL(request.url);
        const page = url.searchParams.get("page");
        return HttpResponse.json({ links: {}, cv: page === "2" ? 2 : 1 });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      cache: { flush: "manual" },
    });

    await client.get("v2/cdn/links", { query: { version: "published", page: 1 } });
    await client.get("v2/cdn/links", { query: { version: "published", page: 2 } }); // cv changes to 2
    await client.get("v2/cdn/links", { query: { version: "published", page: 1 } }); // still cached despite cv change

    expect(requestCount).toBe(2); // page 1 served from cache, not re-fetched after cv change
  });

  it("should flush cache and reset cv when flushCache() is called", async () => {
    let requestCount = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        requestCount++;
        return HttpResponse.json({ links: {}, cv: 1 });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      cache: { flush: "manual" },
    });

    await client.get("v2/cdn/links", { query: { version: "published" } }); // populates cache
    await client.get("v2/cdn/links", { query: { version: "published" } }); // served from cache
    expect(requestCount).toBe(1);

    await client.flushCache();

    await client.get("v2/cdn/links", { query: { version: "published" } }); // cache cleared, re-fetches
    expect(requestCount).toBe(2);
  });

  it("should not downgrade cv or flush cache when a lower cv is received", async () => {
    let requestCount = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", ({ request }: { request: Request }) => {
        requestCount++;
        const url = new URL(request.url);
        const page = url.searchParams.get("page");
        // page 1 first returns cv=2, then a stale response with cv=1 simulating SWR regression
        if (page === "1") {
          return HttpResponse.json({ links: {}, cv: requestCount === 1 ? 2 : 1 });
        }
        return HttpResponse.json({ links: {}, cv: 2 });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    await client.get("v2/cdn/links", { query: { version: "published", page: 1 } }); // cv → 2
    await client.get("v2/cdn/links", { query: { version: "published", page: 2 } }); // cv stays 2
    // Simulate a stale response coming in with cv=1 — should not flush the cache
    await client.get("v2/cdn/links", { query: { version: "published", page: 1 } }); // served from cache (cv regression guard)

    expect(requestCount).toBe(2); // page 1 still served from cache after receiving stale cv
  });

  it.each([500, 502, 503, 429, 408])(
    "should serve the cached response when network-first hits a %i",
    async (status) => {
      // An HTTP error resolves rather than rejects unless `throwOnError` is enabled, so
      // without recognising the error result `network-first` would surface the outage to
      // the caller while a perfectly good cached entry sat unused.
      let fail = false;
      server.use(
        http.get("https://api.storyblok.com/v2/cdn/links", () =>
          fail
            ? HttpResponse.json({ error: "Nope" }, { status })
            : HttpResponse.json({ links: {}, marker: "cached", cv: 1 }),
        ),
      );
      const client = createApiClient({
        accessToken: "test-token",
        retry: { limit: 0 },
        cache: { strategy: "network-first" },
      });

      await client.get("v2/cdn/links", { query: { version: "published" } });

      fail = true;
      const result = await client.get("v2/cdn/links", { query: { version: "published" } });

      expect(result.error).toBeUndefined();
      // @ts-expect-error generic get request can have any shape or form
      expect(result.data?.marker).toBe("cached");
    },
  );

  it.each([400, 401, 403, 404, 422])(
    "should surface a %i with network-first instead of the cached response",
    async (status) => {
      // A definitive answer must not be masked by a cached copy: a 404 means the entry is
      // gone, a 401 means the token no longer works.
      let fail = false;
      server.use(
        http.get("https://api.storyblok.com/v2/cdn/links", () =>
          fail
            ? HttpResponse.json({ error: "Nope" }, { status })
            : HttpResponse.json({ links: {}, marker: "cached", cv: 1 }),
        ),
      );
      const client = createApiClient({
        accessToken: "test-token",
        retry: { limit: 0 },
        cache: { strategy: "network-first" },
      });

      await client.get("v2/cdn/links", { query: { version: "published" } });

      fail = true;
      const result = await client.get("v2/cdn/links", { query: { version: "published" } });

      expect(result.error).toBeDefined();
      expect(result.response.status).toBe(status);
    },
  );

  it.each([500, 502, 503, 429, 408])(
    "should serve the cached response when network-first hits a %i with throwOnError",
    async (status) => {
      // With `throwOnError` the same outage rejects instead of resolving. The fallback has
      // to recognise it there too, or the strategy would depend on a client-wide flag.
      let fail = false;
      server.use(
        http.get("https://api.storyblok.com/v2/cdn/links", () =>
          fail
            ? HttpResponse.json({ error: "Nope" }, { status })
            : HttpResponse.json({ links: {}, marker: "cached", cv: 1 }),
        ),
      );
      const client = createApiClient({
        accessToken: "test-token",
        throwOnError: true,
        retry: { limit: 0 },
        cache: { strategy: "network-first" },
      });

      await client.get("v2/cdn/links", { query: { version: "published" } });

      fail = true;
      const result = await client.get("v2/cdn/links", { query: { version: "published" } });

      // @ts-expect-error generic get request can have any shape or form
      expect(result.data?.marker).toBe("cached");
    },
  );

  it.each([400, 401, 403, 404, 422])(
    "should surface a %i with network-first and throwOnError instead of the cached response",
    async (status) => {
      // A definitive answer rejects rather than resolving here, and a rejection the cache
      // swallows is the same masked deletion as a returned one.
      let fail = false;
      server.use(
        http.get("https://api.storyblok.com/v2/cdn/links", () =>
          fail
            ? HttpResponse.json({ error: "Nope" }, { status })
            : HttpResponse.json({ links: {}, marker: "cached", cv: 1 }),
        ),
      );
      const client = createApiClient({
        accessToken: "test-token",
        throwOnError: true,
        retry: { limit: 0 },
        cache: { strategy: "network-first" },
      });

      await client.get("v2/cdn/links", { query: { version: "published" } });

      fail = true;
      await expect(
        client.get("v2/cdn/links", { query: { version: "published" } }),
      ).rejects.toMatchObject({ response: { status } });
    },
  );

  it("should serve the cached response when network-first hits a transport failure", async () => {
    // A request that got no answer at all is transient by nature: nothing was said about
    // whether the resource still exists.
    let fail = false;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", () =>
        fail ? HttpResponse.error() : HttpResponse.json({ links: {}, marker: "cached", cv: 1 }),
      ),
    );
    const client = createApiClient({
      accessToken: "test-token",
      retry: { limit: 0 },
      cache: { strategy: "network-first" },
    });

    await client.get("v2/cdn/links", { query: { version: "published" } });

    fail = true;
    const result = await client.get("v2/cdn/links", { query: { version: "published" } });

    // @ts-expect-error generic get request can have any shape or form
    expect(result.data?.marker).toBe("cached");
  });

  it("should serve the cached response when network-first hits a transport failure with throwOnError", async () => {
    // With `throwOnError` a transport failure rejects with the original `TypeError`
    // (unwrapped, so `instanceof`/`name` checks still work). The fallback has to
    // recognise it as transient too, or it would surface the outage instead of the cache.
    let fail = false;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", () =>
        fail ? HttpResponse.error() : HttpResponse.json({ links: {}, marker: "cached", cv: 1 }),
      ),
    );
    const client = createApiClient({
      accessToken: "test-token",
      throwOnError: true,
      retry: { limit: 0 },
      cache: { strategy: "network-first" },
    });

    await client.get("v2/cdn/links", { query: { version: "published" } });

    fail = true;
    const result = await client.get("v2/cdn/links", { query: { version: "published" } });

    // @ts-expect-error generic get request can have any shape or form
    expect(result.data?.marker).toBe("cached");
  });

  it("should surface a transient error with network-first when nothing is cached", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", () =>
        HttpResponse.json({ error: "Nope" }, { status: 503 }),
      ),
    );
    const client = createApiClient({
      accessToken: "test-token",
      retry: { limit: 0 },
      cache: { strategy: "network-first" },
    });

    const result = await client.get("v2/cdn/links", { query: { version: "published" } });

    expect(result.error).toBeDefined();
    expect(result.response.status).toBe(503);
  });

  it("should not serve a cached response for a transient error with cache-first", async () => {
    // Only `network-first` falls back. `cache-first` never reaches the network while a
    // valid entry exists, so an error there means the entry was already gone.
    let requestCount = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        requestCount++;
        return HttpResponse.json({ error: "Nope" }, { status: 503 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token", retry: { limit: 0 } });

    const result = await client.get("v2/cdn/links", { query: { version: "published" } });

    expect(result.response.status).toBe(503);
    expect(requestCount).toBe(1);
  });

  it("should report a background swr revalidation that came back 5xx", async () => {
    // The revalidation resolves with an error result rather than throwing, so without
    // recognising it the entry would go stale with no signal to the caller at all.
    let fail = false;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", () =>
        fail
          ? HttpResponse.json({ error: "Nope" }, { status: 503 })
          : HttpResponse.json({ links: {}, cv: 1 }),
      ),
    );
    const onRevalidationError = vi.fn();
    const client = createApiClient({
      accessToken: "test-token",
      retry: { limit: 0 },
      cache: { strategy: "swr", onRevalidationError },
    });

    await client.get("v2/cdn/links", { query: { version: "published" } });

    fail = true;
    const result = await client.get("v2/cdn/links", { query: { version: "published" } });

    // The cached entry is still served — reporting must not make swr blocking.
    expect(result.error).toBeUndefined();
    await vi.waitFor(() => expect(onRevalidationError).toHaveBeenCalledTimes(1));
  });

  it("should return cached response and revalidate in background with swr strategy", async () => {
    let requestCount = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        requestCount++;
        return HttpResponse.json({
          requestCount,
          links: {},
          cv: 1,
        });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      cache: {
        strategy: "swr",
        ttlMs: 1_000,
      },
    });

    const firstResult = await client.get("v2/cdn/links", {
      query: { version: "published" },
    });
    const secondResult = await client.get("v2/cdn/links", {
      query: { version: "published" },
    });
    await vi.waitFor(() => {
      expect(requestCount).toBe(2);
    });
    const thirdResult = await client.get("v2/cdn/links", {
      query: { version: "published" },
    });

    // @ts-expect-error generic get request can have any shape or form
    expect(firstResult.data?.requestCount).toBe(1);
    // @ts-expect-error generic get request can have any shape or form
    expect(secondResult.data?.requestCount).toBe(1);
    // @ts-expect-error generic get request can have any shape or form
    expect(thirdResult.data?.requestCount).toBe(2);
  });

  it("should not cache stale swr revalidation results after cv regression", async () => {
    let requestCount = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", ({ request }: { request: Request }) => {
        requestCount++;
        const url = new URL(request.url);
        const cv = url.searchParams.get("cv");

        if (cv === "2") {
          return HttpResponse.json({ links: {}, marker: "stale", cv: 1 });
        }

        return HttpResponse.json({ links: {}, marker: "fresh", cv: 2 });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      cache: {
        strategy: "swr",
      },
    });

    const firstResult = await client.get("v2/cdn/links", {
      query: { version: "published" },
    });
    const secondResult = await client.get("v2/cdn/links", {
      query: { version: "published" },
    });
    await vi.waitFor(() => {
      expect(requestCount).toBe(2);
    });
    const thirdResult = await client.get("v2/cdn/links", {
      query: { version: "published" },
    });

    // @ts-expect-error generic get request can have any shape or form
    expect(firstResult.data?.marker).toBe("fresh");
    // @ts-expect-error generic get request can have any shape or form
    expect(secondResult.data?.marker).toBe("fresh");
    // @ts-expect-error generic get request can have any shape or form
    expect(thirdResult.data?.marker).toBe("fresh");
  });
});

describe("cache provider compatibility", () => {
  it("should invalidate an entry stored by a provider that round-trips the cv", async () => {
    let cv = 1000;
    let storyRequests = 0;
    const store = new Map<string, CacheEntry>();
    const rebuildingProvider: CacheProvider = {
      async get<TValue>(key: string) {
        const entry = store.get(key);
        if (!entry) {
          return undefined;
        }

        // Rebuilds the entry field by field, like an adapter over a store with its own schema.
        return {
          value: entry.value as TValue,
          storedAt: entry.storedAt,
          ttlMs: entry.ttlMs,
          cv: entry.cv,
        };
      },
      async set(key, entry) {
        store.set(key, { ...entry, storedAt: entry.storedAt ?? Date.now() });
      },
      async flush() {
        store.clear();
      },
    };
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/spaces/me", () =>
        HttpResponse.json({ space: { id: 1, name: "Test", version: cv } }),
      ),
      http.get("https://api.storyblok.com/v2/cdn/stories", () => {
        storyRequests++;
        return HttpResponse.json({ stories: [], cv });
      }),
    );
    const client = createApiClient({
      accessToken: "round-trip-provider-token",
      cache: { provider: rebuildingProvider },
    });

    await client.get("v2/cdn/stories", { query: { version: "published" } });
    await client.get("v2/cdn/stories", { query: { version: "published" } });
    expect(storyRequests).toBe(1);

    cv = 2000; // content was published
    await client.spaces.get();
    await client.get("v2/cdn/stories", { query: { version: "published" } });

    expect(storyRequests).toBe(2);
  });
});

describe("cache.cv: manual", () => {
  it("should not attach cv to subsequent requests", async () => {
    const capturedUrls: string[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        capturedUrls.push(request.url);
        return HttpResponse.json({
          stories: [makeStory("s1", { component: "page", _uid: "u1" })],
          cv: 999,
        });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      cache: { cv: "manual" },
    });

    await client.stories.list({ query: { version: "published" } });
    await client.stories.list({ query: { version: "published", page: 2 } });

    const secondUrl = new URL(capturedUrls[1]!);
    expect(secondUrl.searchParams.has("cv")).toBe(false);
  });
});

describe("cv pinning while the cv is unknown", () => {
  it("should send only one unpinned request while the cv is unknown", async () => {
    const cvs: (string | null)[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", async ({ request }) => {
        cvs.push(new URL(request.url).searchParams.get("cv"));
        await new Promise((resolve) => setTimeout(resolve, 10));
        return HttpResponse.json({
          story: makeStory("s1", { component: "page", _uid: "u1" }),
          cv: 42,
        });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await Promise.all(["a", "b", "c", "d"].map((slug) => client.stories.get(slug)));

    expect(cvs).toEqual([null, "42", "42", "42"]);
  });

  it("should release waiting requests when the first response carries no cv", async () => {
    const cvs: (string | null)[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", async ({ request }) => {
        cvs.push(new URL(request.url).searchParams.get("cv"));
        await new Promise((resolve) => setTimeout(resolve, 10));
        return HttpResponse.json({ error: "Not Found" }, { status: 404 });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    const results = await Promise.all(["a", "b", "c"].map((slug) => client.stories.get(slug)));

    expect(results.map((result) => result.response?.status)).toEqual([404, 404, 404]);
    expect(cvs).toEqual([null, null, null]);
  });

  it("should not hold back draft requests", async () => {
    let inFlight = 0;
    let peakInFlight = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", async () => {
        inFlight++;
        peakInFlight = Math.max(peakInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight--;
        return HttpResponse.json({
          story: makeStory("s1", { component: "page", _uid: "u1" }),
          cv: 42,
        });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    await Promise.all(
      ["a", "b", "c"].map((slug) => client.stories.get(slug, { query: { version: "draft" } })),
    );

    expect(peakInFlight).toBe(3);
  });

  it("should not hold back requests when cv is managed manually", async () => {
    const cvs: (string | null)[] = [];
    let inFlight = 0;
    let peakInFlight = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", async ({ request }) => {
        cvs.push(new URL(request.url).searchParams.get("cv"));
        inFlight++;
        peakInFlight = Math.max(peakInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight--;
        return HttpResponse.json({
          story: makeStory("s1", { component: "page", _uid: "u1" }),
          cv: 42,
        });
      }),
    );
    const client = createApiClient({ accessToken: "test-token", cache: { cv: "manual" } });

    await Promise.all(["a", "b", "c"].map((slug) => client.stories.get(slug)));

    expect(peakInFlight).toBe(3);
    expect(cvs).toEqual([null, null, null]);
  });

  it("should pin the wave after a publish to the new cv", async () => {
    let cv = 1000;
    const cvs: (string | null)[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/spaces/me", () =>
        HttpResponse.json({ space: { id: 1, name: "Test", version: cv } }),
      ),
      http.get("https://api.storyblok.com/v2/cdn/stories/*", async ({ request }) => {
        cvs.push(new URL(request.url).searchParams.get("cv"));
        await new Promise((resolve) => setTimeout(resolve, 10));
        return HttpResponse.json({
          story: makeStory("s1", { component: "page", _uid: "u1" }),
          cv,
        });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });
    await client.stories.get("warm");

    cv = 2000; // content was published
    await client.spaces.get();
    await Promise.all(["a", "b", "c", "d"].map((slug) => client.stories.get(slug)));

    expect(cvs).toEqual([null, null, "2000", "2000", "2000"]);
  });

  it("should stop waiting for a discovering request that is slow to respond", async () => {
    let openGate = () => {};
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const cvs: (string | null)[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", async ({ request }) => {
        cvs.push(new URL(request.url).searchParams.get("cv"));
        if (request.url.includes("/slow")) {
          await gate;
        }
        return HttpResponse.json({
          story: makeStory("s1", { component: "page", _uid: "u1" }),
          cv: 42,
        });
      }),
    );
    const client = createApiClient({ accessToken: "test-token" });

    const slow = client.stories.get("slow");
    const fast = await client.stories.get("fast");
    openGate();
    await slow;

    expect(fast.response?.status).toBe(200);
    expect(cvs).toEqual([null, null]);
  });
});

describe("inlineLinks", () => {
  const storyLink = (uuid: string) => ({
    id: uuid,
    url: "",
    linktype: "story",
    fieldtype: "multilink",
    cached_url: `stories/${uuid}`,
  });
  const richTextWithLink = (uuid: string) => ({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Read more",
            marks: [{ type: "link", attrs: { href: "", uuid, linktype: "story" } }],
          },
        ],
      },
    ],
  });
  const getRichTextLinkAttrs = (richText: any) => richText.content[0].content[0].marks[0].attrs;

  const linkPageResponse = () => ({
    links: [makeStory("target-1", { _uid: "t1", component: "page" })],
    story: makeStory("page-1", {
      _uid: "page-content-1",
      component: "page",
      cta: storyLink("target-1"),
      body: richTextWithLink("target-1"),
      external: { id: "", url: "https://example.com", linktype: "url", fieldtype: "multilink" },
      missing: storyLink("not-resolved"),
    }),
  });

  it("should keep default behavior when inlineLinks is false", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () =>
        HttpResponse.json(linkPageResponse()),
      ),
    );
    const client = createApiClient({ accessToken: "test-token" });

    const result = await client.stories.get("page-1", { query: { resolve_links: "story" } });

    expect(result.data?.story.content.cta).not.toHaveProperty("story");
  });

  it("should inline links into multilink fields and richtext link marks", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () =>
        HttpResponse.json(linkPageResponse()),
      ),
    );
    const client = createApiClient({ accessToken: "test-token", inlineLinks: true });

    const result = await client.stories.get("page-1", { query: { resolve_links: "story" } });

    expect(result.error).toBeUndefined();
    const content: any = result.data?.story.content;
    expect(content.cta.story).toMatchObject({ uuid: "target-1" });
    expect(getRichTextLinkAttrs(content.body).story).toMatchObject({ uuid: "target-1" });
    expect(content.external).not.toHaveProperty("story");
    expect(content.missing).not.toHaveProperty("story");
  });

  it("should not inline links without resolve_links", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () =>
        HttpResponse.json(linkPageResponse()),
      ),
    );
    const client = createApiClient({ accessToken: "test-token", inlineLinks: true });

    const result = await client.stories.get("page-1");

    expect(result.data?.story.content.cta).not.toHaveProperty("story");
  });

  it("should inline links for stories.list() and fetch link_uuids", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("by_uuids") === "target-2") {
          return HttpResponse.json({
            stories: [makeStory("target-2", { _uid: "t2", component: "page" })],
          });
        }
        return HttpResponse.json({
          link_uuids: ["target-2"],
          stories: [
            makeStory("page-2", { _uid: "p2", component: "page", cta: storyLink("target-2") }),
          ],
        });
      }),
    );
    const client = createApiClient({ accessToken: "test-token", inlineLinks: true });

    const result = await client.stories.list({ query: { resolve_links: "story" } });

    expect(result.error).toBeUndefined();
    const cta: any = result.data?.stories[0]?.content.cta;
    expect(cta.story).toMatchObject({ uuid: "target-2" });
  });

  it("should inline links inside inlined relations", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () =>
        HttpResponse.json({
          rels: [
            makeStory("author-1", {
              _uid: "a1",
              component: "author",
              website: storyLink("target-1"),
            }),
          ],
          links: [makeStory("target-1", { _uid: "t1", component: "page" })],
          story: makeStory("page-1", { _uid: "p1", component: "page", author: "author-1" }),
        }),
      ),
    );
    const client = createApiClient({
      accessToken: "test-token",
      inlineRelations: true,
      inlineLinks: true,
    });

    const result = await client.stories.get("page-1", {
      query: {
        resolve_relations: "page.author",
        resolve_links: "story",
        resolve_links_in_relations: 1,
      },
    });

    expect(result.error).toBeUndefined();
    const author: any = result.data?.story.content.author;
    expect(author.content.website.story).toMatchObject({ uuid: "target-1" });
  });

  it("should leave the response's rels and links unchanged", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () =>
        HttpResponse.json({
          rels: [
            makeStory("author-1", {
              _uid: "a1",
              component: "author",
              website: storyLink("target-1"),
            }),
          ],
          links: [
            makeStory("target-1", { _uid: "t1", component: "page", next: storyLink("target-2") }),
            makeStory("target-2", { _uid: "t2", component: "page" }),
          ],
          story: makeStory("page-1", { _uid: "p1", component: "page", author: "author-1" }),
        }),
      ),
    );
    const client = createApiClient({
      accessToken: "test-token",
      inlineRelations: true,
      inlineLinks: true,
    });

    const result = await client.stories.get("page-1", {
      query: {
        resolve_relations: "page.author",
        resolve_links: "story",
        resolve_links_in_relations: 1,
      },
    });

    const data: any = result.data;
    expect(data.rels[0].content.website).not.toHaveProperty("story");
    expect(data.links[0].content.next).not.toHaveProperty("story");
  });

  const linkedPagesResponse = () => ({
    links: [
      makeStory("target-1", { _uid: "t1", component: "page", next: storyLink("target-2") }),
      makeStory("target-2", { _uid: "t2", component: "page", back: storyLink("target-1") }),
    ],
    story: makeStory("page-1", { _uid: "p1", component: "page", cta: storyLink("target-1") }),
  });

  it("should not inline the links of linked stories by default", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () =>
        HttpResponse.json(linkedPagesResponse()),
      ),
    );
    const client = createApiClient({ accessToken: "test-token", inlineLinks: true });

    const result = await client.stories.get("page-1", { query: { resolve_links: "story" } });

    const cta: any = result.data?.story.content.cta;
    expect(cta.story).toMatchObject({ uuid: "target-1" });
    expect(cta.story.content.next).not.toHaveProperty("story");
  });

  it("should inline the links of linked stories one level deep with resolve_links_level 2", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () =>
        HttpResponse.json(linkedPagesResponse()),
      ),
    );
    const client = createApiClient({ accessToken: "test-token", inlineLinks: true });

    const result = await client.stories.get("page-1", {
      query: { resolve_links: "story", resolve_links_level: 2 },
    });

    const cta: any = result.data?.story.content.cta;
    expect(cta.story.content.next.story).toMatchObject({ uuid: "target-2" });
    expect(cta.story.content.next.story.content.back).not.toHaveProperty("story");
    expect(() => JSON.stringify(result.data)).not.toThrow();
  });

  it("should keep the relations of linked stories as UUIDs", async () => {
    const relatedPost = (uuid: string, related: string) =>
      makeStory(uuid, { _uid: uuid, component: "post", related });
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () =>
        HttpResponse.json({
          rels: [relatedPost("post-1", "post-2"), relatedPost("post-2", "post-1")],
          links: [relatedPost("post-1", "post-2")],
          story: makeStory("page-1", {
            _uid: "p1",
            component: "page",
            first: storyLink("post-1"),
            second: storyLink("post-1"),
          }),
        }),
      ),
    );
    const client = createApiClient({
      accessToken: "test-token",
      inlineRelations: true,
      inlineLinks: true,
    });

    const result = await client.stories.get("page-1", {
      query: { resolve_relations: "post.related", resolve_links: "story" },
    });

    expect(result.error).toBeUndefined();
    const content: any = result.data?.story.content;
    expect(content.first.story.content.related).toBe("post-2");
    expect(content.second.story.content.related).toBe("post-2");
  });

  it("should reduce links fetched beyond the resolve limit to the url shape", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }: { request: Request }) => {
        if (new URL(request.url).searchParams.get("by_uuids") === "target-1") {
          return HttpResponse.json({
            stories: [{ ...makeStory("target-1", { _uid: "t1", component: "page" }), path: "" }],
          });
        }
        return HttpResponse.json({
          link_uuids: ["target-1"],
          stories: [
            makeStory("page-1", { _uid: "p1", component: "page", cta: storyLink("target-1") }),
          ],
        });
      }),
    );
    const client = createApiClient({ accessToken: "test-token", inlineLinks: true });

    const result = await client.stories.list({ query: { resolve_links: "url" } });

    const cta: any = result.data?.stories[0]?.content.cta;
    expect(cta.story).toEqual({
      id: 1,
      uuid: "target-1",
      name: "Story target-1",
      slug: "target-1",
      full_slug: "stories/target-1",
      url: "stories/target-1",
    });
  });

  it("should inline the links of relations fetched beyond the resolve limit", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }: { request: Request }) => {
        if (new URL(request.url).searchParams.get("by_uuids") === "author-1") {
          return HttpResponse.json({
            links: [makeStory("target-1", { _uid: "t1", component: "page" })],
            stories: [
              makeStory("author-1", {
                _uid: "a1",
                component: "author",
                website: storyLink("target-1"),
              }),
            ],
          });
        }
        return HttpResponse.json({
          rel_uuids: ["author-1"],
          stories: [makeStory("page-1", { _uid: "p1", component: "page", author: "author-1" })],
        });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      inlineRelations: true,
      inlineLinks: true,
    });

    const result = await client.stories.list({
      query: {
        resolve_relations: "page.author",
        resolve_links: "story",
        resolve_links_in_relations: 1,
      },
    });

    const author: any = result.data?.stories[0]?.content.author;
    expect(author.content.website.story).toMatchObject({ uuid: "target-1" });
  });

  it("should return a failed request for links beyond the resolve limit as an error", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }: { request: Request }) => {
        if (new URL(request.url).searchParams.has("by_uuids")) {
          return HttpResponse.json({ error: "Too Many Requests" }, { status: 429 });
        }
        return HttpResponse.json({
          link_uuids: ["target-1"],
          stories: [
            makeStory("page-1", { _uid: "p1", component: "page", cta: storyLink("target-1") }),
          ],
        });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
      inlineLinks: true,
      retry: { limit: 0 },
    });

    const result = await client.stories.list({ query: { resolve_links: "url" } });
    const thrown = client.stories.list({
      query: { resolve_links: "url" },
      throwOnError: true,
    });

    expect(result.data).toBeUndefined();
    expect(result.error).toBeInstanceOf(ClientError);
    await expect(thrown).rejects.toBeInstanceOf(ClientError);
  });

  it("should cache responses inlined with links apart from raw ones", async () => {
    let requests = 0;
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () => {
        requests += 1;
        return HttpResponse.json(linkPageResponse());
      }),
    );
    const cache = createMemoryCacheProvider();
    const rawClient = createApiClient({ accessToken: "test-token", cache: { provider: cache } });
    const linkClient = createApiClient({
      accessToken: "test-token",
      inlineLinks: true,
      cache: { provider: cache },
    });

    await rawClient.stories.get("page-1", { query: { resolve_links: "story" } });
    const result = await linkClient.stories.get("page-1", { query: { resolve_links: "story" } });

    const cta: any = result.data?.story.content.cta;
    expect(cta.story).toMatchObject({ uuid: "target-1" });
    expect(requests).toBe(2);
  });

  it("should share one copy of a linked story between the links to it", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", () =>
        HttpResponse.json({
          links: [makeStory("target-1", { _uid: "t1", component: "page" })],
          stories: [
            makeStory("page-1", { _uid: "p1", component: "page", cta: storyLink("target-1") }),
            makeStory("page-2", { _uid: "p2", component: "page", cta: storyLink("target-1") }),
          ],
        }),
      ),
    );
    const client = createApiClient({ accessToken: "test-token", inlineLinks: true });

    const result = await client.stories.list({ query: { resolve_links: "story" } });

    const [first, second]: any[] = result.data?.stories ?? [];
    expect(first.content.cta.story).toBe(second.content.cta.story);
  });
});

describe("circularRelations", () => {
  const relatedPage = (uuid: string, related?: string) =>
    makeStory(uuid, { _uid: `${uuid}-content`, component: "page", related });

  /** Serves `stories.get()` from the given relation chain: the first story is requested. */
  const serveRelationChain = (...links: Array<[uuid: string, related?: string]>) => {
    const stories = links.map(([uuid, related]) => relatedPage(uuid, related));
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () =>
        HttpResponse.json({ story: stories[0], rels: stories, cv: 1 }),
      ),
    );
  };

  /** A fresh module instance, so the once-per-process warning has not fired yet. */
  const importFreshCreateApiClient = async () => {
    vi.resetModules();
    const { createApiClient: freshCreateApiClient } = await import("../index");
    return freshCreateApiClient;
  };

  const resolveRelatedQuery = { version: "published", resolve_relations: "page.related" } as const;

  const relatedOf = (story: unknown): unknown =>
    (story as { content: { related: unknown } }).content.related;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return a circular result and warn once across clients when the option is unset", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const freshCreateApiClient = await importFreshCreateApiClient();
    serveRelationChain(["a", "b"], ["b", "a"]);
    const first = freshCreateApiClient({ accessToken: "token-1", inlineRelations: true });
    const second = freshCreateApiClient({ accessToken: "token-2", inlineRelations: true });

    const result = await first.stories.get("a", { query: resolveRelatedQuery });
    await first.stories.get("a", { query: { ...resolveRelatedQuery, version: "draft" } });
    await second.stories.get("a", { query: resolveRelatedQuery });

    const story = result.data?.story;
    expect(relatedOf(relatedOf(story))).toBe(story);
    expect(() => JSON.stringify(story)).toThrow(TypeError);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toMatch(/^\[storyblok\/api-client\] .*circular/);
    expect(warn.mock.calls[0]?.[0]).toContain("JSON.stringify");
    expect(warn.mock.calls[0]?.[0]).toContain("circularRelations");
    expect(warn.mock.calls[0]?.[0]).toContain("1.0");
  });

  it("should not warn when the option is unset and the result is not circular", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const freshCreateApiClient = await importFreshCreateApiClient();
    serveRelationChain(["a", "b"], ["b", "c"], ["c"]);
    const client = freshCreateApiClient({ accessToken: "test-token", inlineRelations: true });

    const result = await client.stories.get("a", { query: resolveRelatedQuery });

    expect(relatedOf(relatedOf(result.data?.story))).toMatchObject({ uuid: "c" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("should return a circular result without warning when the option is true", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const freshCreateApiClient = await importFreshCreateApiClient();
    serveRelationChain(["a", "b"], ["b", "a"]);
    const client = freshCreateApiClient({
      accessToken: "test-token",
      inlineRelations: true,
      circularRelations: true,
    });

    const result = await client.stories.get("a", { query: resolveRelatedQuery });

    const story = result.data?.story;
    expect(relatedOf(relatedOf(story))).toBe(story);
    expect(warn).not.toHaveBeenCalled();
  });

  it("should stop inlining two levels below the requested story when the option is false", async () => {
    serveRelationChain(["a", "b"], ["b", "c"], ["c", "d"], ["d"]);
    const client = createApiClient({
      accessToken: "test-token",
      inlineRelations: true,
      circularRelations: false,
    });

    const result = await client.stories.get("a", { query: resolveRelatedQuery });

    const b = relatedOf(result.data?.story);
    const c = relatedOf(b);
    expect(b).toMatchObject({ uuid: "b" });
    expect(c).toMatchObject({ uuid: "c" });
    expect(relatedOf(c)).toBe("d");
  });

  it.each([
    {
      cycle: "A → B → A",
      links: [
        ["a", "b"],
        ["b", "a"],
      ],
    },
    {
      cycle: "A → B → C → A",
      links: [
        ["a", "b"],
        ["b", "c"],
        ["c", "a"],
      ],
    },
  ] satisfies Array<{ cycle: string; links: Array<[string, string]> }>)(
    "should return a serializable result for $cycle without warning when the option is false",
    async ({ links }) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const freshCreateApiClient = await importFreshCreateApiClient();
      serveRelationChain(...links);
      const client = freshCreateApiClient({
        accessToken: "test-token",
        inlineRelations: true,
        circularRelations: false,
      });

      const result = await client.stories.get("a", { query: resolveRelatedQuery });

      const story = result.data?.story;
      const secondLevel = relatedOf(relatedOf(story));
      expect(secondLevel).toMatchObject({ uuid: links[1]?.[1] });
      expect(secondLevel).not.toBe(story);
      expect(relatedOf(secondLevel)).toBe(links[2]?.[1] ?? "b");
      expect(() => JSON.stringify(story)).not.toThrow();
      expect(warn).not.toHaveBeenCalled();
    },
  );

  it("should return serializable stories from stories.list() when the option is false", async () => {
    const stories = [relatedPage("a", "b"), relatedPage("b", "a")];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories", () =>
        HttpResponse.json({ stories, rels: stories, cv: 1 }),
      ),
    );
    const client = createApiClient({
      accessToken: "test-token",
      inlineRelations: true,
      circularRelations: false,
    });

    const result = await client.stories.list({ query: resolveRelatedQuery });

    const [a, b] = result.data?.stories ?? [];
    expect(relatedOf(relatedOf(a))).toMatchObject({ uuid: "a" });
    expect(relatedOf(relatedOf(b))).toMatchObject({ uuid: "b" });
    expect(() => JSON.stringify(result.data?.stories)).not.toThrow();
  });

  it("should not share cached results between clients with and without circular references", async () => {
    let requestCount = 0;
    const stories = [relatedPage("a", "b"), relatedPage("b", "a")];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/stories/*", () => {
        requestCount++;
        return HttpResponse.json({ story: stories[0], rels: stories, cv: 1 });
      }),
    );
    const store = new Map<string, CacheEntry>();
    const sharedProvider: CacheProvider = {
      async get<TValue>(key: string) {
        return store.get(key) as CacheEntry<TValue> | undefined;
      },
      async set(key, entry) {
        store.set(key, { ...entry, storedAt: entry.storedAt ?? Date.now() });
      },
      async flush() {
        store.clear();
      },
    };
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const circularClient = createApiClient({
      accessToken: "shared-cache-token",
      inlineRelations: true,
      cache: { provider: sharedProvider },
    });
    const acyclicClient = createApiClient({
      accessToken: "shared-cache-token",
      inlineRelations: true,
      circularRelations: false,
      cache: { provider: sharedProvider },
    });

    await circularClient.stories.get("a", { query: resolveRelatedQuery });
    const acyclic = await acyclicClient.stories.get("a", { query: resolveRelatedQuery });
    const cachedAcyclic = await acyclicClient.stories.get("a", { query: resolveRelatedQuery });
    const cachedCircular = await circularClient.stories.get("a", { query: resolveRelatedQuery });

    expect(requestCount).toBe(2);
    expect(() => JSON.stringify(acyclic.data?.story)).not.toThrow();
    expect(() => JSON.stringify(cachedAcyclic.data?.story)).not.toThrow();
    const circularStory = cachedCircular.data?.story;
    expect(relatedOf(relatedOf(circularStory))).toBe(circularStory);
  });
});
