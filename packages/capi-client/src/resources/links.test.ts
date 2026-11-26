import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createApiClient } from "../index";

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("links.list()", () => {
  it("should track the current cv a cache-busting cv was redirected to", async () => {
    const CURRENT_CV = "2000";
    const storyUrls: string[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", ({ request }) => {
        const url = new URL(request.url);
        // The edge redirects a cv it does not hold to the current version.
        if (url.searchParams.get("cv") !== CURRENT_CV) {
          url.searchParams.set("cv", CURRENT_CV);
          return HttpResponse.redirect(url.toString(), 301);
        }
        // `/cdn/links` responses carry no cv of their own.
        return HttpResponse.json({ links: {} });
      }),
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        storyUrls.push(request.url);
        return HttpResponse.json({ stories: [], cv: Number(CURRENT_CV) });
      }),
    );
    const client = createApiClient({ accessToken: "links-cache-bust-token" });

    await client.links.list({ query: { cv: 9_999_999_999 } });
    await client.stories.list();

    expect(new URL(storyUrls[0] ?? "").searchParams.get("cv")).toBe(CURRENT_CV);
  });

  it("should keep caching after a query parameter name smuggles in a cv", async () => {
    const CURRENT_CV = "2000";
    const storyUrls: string[] = [];
    const currentCvRedirect = (request: Request) => {
      const url = new URL(request.url);
      // The edge serves the last cv and redirects one it does not hold to the current one.
      const cvs = url.searchParams.getAll("cv");
      if (cvs[cvs.length - 1] === CURRENT_CV) {
        return undefined;
      }
      url.searchParams.set("cv", CURRENT_CV);
      return HttpResponse.redirect(url.toString(), 301);
    };
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", ({ request }) => {
        return currentCvRedirect(request) ?? HttpResponse.json({ links: {} });
      }),
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        storyUrls.push(request.url);
        return (
          currentCvRedirect(request) ?? HttpResponse.json({ stories: [], cv: Number(CURRENT_CV) })
        );
      }),
    );
    const client = createApiClient({ accessToken: "links-smuggled-cv-token" });

    await client.stories.list();
    await client.get("v2/cdn/links", {
      query: { version: "published", "x&cv": String(Number.MAX_SAFE_INTEGER) },
    });
    storyUrls.length = 0;
    await client.stories.list();
    await client.stories.list({ query: { starts_with: "blog/" } });
    await client.stories.list({ query: { starts_with: "blog/" } });

    expect(storyUrls).toHaveLength(1);
    expect(new URL(storyUrls[0] ?? "").searchParams.get("cv")).toBe(CURRENT_CV);
  });

  describe("without a cv known beforehand", () => {
    const spaceHandler = (version: () => number) =>
      http.get("https://api.storyblok.com/v2/cdn/spaces/me", () => {
        return HttpResponse.json({
          space: {
            id: 1,
            name: "Test Space",
            domain: "https://test.storyblok.com",
            version: version(),
            language_codes: [],
          },
        });
      });

    const setup = (accessToken: string) => {
      const state = { currentCv: 2000 };
      const linkUrls: string[] = [];
      server.use(
        spaceHandler(() => state.currentCv),
        http.get("https://api.storyblok.com/v2/cdn/links", ({ request }) => {
          linkUrls.push(request.url);
          const url = new URL(request.url);
          // The edge still holds cv 2000 and redirects any other cv it doesn't hold.
          const requestedCv = Number(url.searchParams.get("cv"));
          if (requestedCv !== state.currentCv && requestedCv !== 2000) {
            url.searchParams.set("cv", String(state.currentCv));
            return HttpResponse.redirect(url.toString(), 301);
          }
          // `/cdn/links` responses carry no cv of their own.
          return HttpResponse.json({ links: {} });
        }),
      );
      return { state, linkUrls, client: createApiClient({ accessToken }) };
    };

    it("should send the cv it was redirected to on the next request", async () => {
      const { linkUrls, client } = setup("links-only-learn-token");

      await client.links.list();
      await client.links.list({ query: { starts_with: "blog/" } });

      // The first request is redirected and followed; the second goes out with the cv.
      expect(linkUrls).toHaveLength(3);
      expect(new URL(linkUrls[2] ?? "").searchParams.get("cv")).toBe("2000");
    });

    it("should refetch after a space poll notices a publish", async () => {
      const { state, linkUrls, client } = setup("links-only-poll-token");

      await client.links.list();
      await client.spaces.get();
      await client.links.list();
      expect(linkUrls).toHaveLength(2);

      state.currentCv = 3000; // content was published
      await client.spaces.get();
      await client.links.list();

      expect(linkUrls).toHaveLength(4);
      expect(new URL(linkUrls[3] ?? "").searchParams.get("cv")).toBe("3000");
    });

    it("should refetch after a redirect reveals a publish", async () => {
      const { state, linkUrls, client } = setup("links-only-redirect-token");

      await client.links.list();
      state.currentCv = 3000; // content was published
      await client.links.list({ query: { cv: 9_999_999_999 } });
      await client.links.list();

      expect(linkUrls).toHaveLength(5);
      expect(new URL(linkUrls[4] ?? "").searchParams.get("cv")).toBe("3000");
    });
  });

  it("should not track a cv a draft request was sent with", async () => {
    const CURRENT_CV = "2000";
    const storyUrls: string[] = [];
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        // Drafts are never redirected, so the URL keeps the caller's cv.
        return HttpResponse.json({ links: {} });
      }),
      http.get("https://api.storyblok.com/v2/cdn/stories", ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("cv") !== CURRENT_CV) {
          url.searchParams.set("cv", CURRENT_CV);
          return HttpResponse.redirect(url.toString(), 301);
        }
        storyUrls.push(request.url);
        return HttpResponse.json({ stories: [], cv: Number(CURRENT_CV) });
      }),
    );
    const client = createApiClient({ accessToken: "links-draft-cv-token" });

    await client.links.list({ query: { version: "draft", cv: 9_999_999_999 } });
    await client.stories.list();
    await client.stories.list();

    expect(storyUrls).toHaveLength(1);
    expect(new URL(storyUrls[0] ?? "").searchParams.get("cv")).toBe(CURRENT_CV);
  });

  it("should successfully retrieve multiple links", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        return HttpResponse.json({ links: {}, cv: 1 });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    const result = await client.links.list();

    expect(result.error).toBeUndefined();
    expect(typeof result.data?.links).toBe("object");
  });

  it("should return links as a record of link objects", async () => {
    const linkUuid = "abc-123";
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        return HttpResponse.json({
          links: {
            [linkUuid]: {
              id: 1,
              uuid: linkUuid,
              slug: "home",
              path: "",
              name: "Home",
              is_folder: false,
              published: true,
              is_startpage: true,
              position: 0,
              real_path: "/home",
            },
          },
          cv: 1,
        });
      }),
    );
    const client = createApiClient({
      accessToken: "test-token",
    });

    const result = await client.links.list();

    expect(result.error).toBeUndefined();
    expect(result.data?.links[linkUuid]).toBeDefined();
    expect(result.data?.links[linkUuid]?.uuid).toBe(linkUuid);
    expect(result.data?.links[linkUuid]?.slug).toBe("home");
  });

  it("should return error on 401", async () => {
    server.use(
      http.get("https://api.storyblok.com/v2/cdn/links", () => {
        return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
      }),
    );
    const client = createApiClient({
      accessToken: "invalid-token",
    });

    const result = await client.links.list();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });

  it("should use in-memory cache for second call", async () => {
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

    await client.links.list({ query: { version: "published" } });
    await client.links.list({ query: { version: "published" } });

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

    await client.links.list({ query: { version: "draft" } });
    await client.links.list({ query: { version: "draft" } });

    expect(requestCount).toBe(2);
  });
});
