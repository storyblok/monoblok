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
