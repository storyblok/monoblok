import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createManagementApiClient } from "../index";

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const RELEASE = {
  id: 1,
  uuid: "release-uuid",
  name: "Summer campaign",
  released: false,
  branches_to_deploy: [],
  created_at: "2026-01-01T00:00:00.000Z",
};

describe("releases.list()", () => {
  it("should successfully retrieve releases", async () => {
    server.use(
      http.get("https://mapi.storyblok.com/v1/spaces/:space_id/releases", () => {
        return HttpResponse.json({ releases: [RELEASE] });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: "test-token",
      spaceId: 123,
      region: "eu",
      rateLimit: false,
    });

    const result = await client.releases.list();

    expect(result.error).toBeUndefined();
    expect(result.data?.releases).toEqual([RELEASE]);
  });

  it("should pass the branch filter", async () => {
    let branchId: string | null = null;
    server.use(
      http.get("https://mapi.storyblok.com/v1/spaces/:space_id/releases", ({ request }) => {
        branchId = new URL(request.url).searchParams.get("branch_id");
        return HttpResponse.json({ releases: [] });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: "test-token",
      spaceId: 123,
      region: "eu",
      rateLimit: false,
    });

    await client.releases.list({ query: { branch_id: 7 } });

    expect(branchId).toBe("7");
  });

  it("should return error on 401", async () => {
    server.use(
      http.get("https://mapi.storyblok.com/v1/spaces/:space_id/releases", () => {
        return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: "invalid-token",
      spaceId: 123,
      region: "eu",
      rateLimit: false,
    });

    const result = await client.releases.list();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });

  it("should allow overriding space_id via path option", async () => {
    let resolvedSpaceId: string | undefined;
    server.use(
      http.get("https://mapi.storyblok.com/v1/spaces/:space_id/releases", ({ params }) => {
        resolvedSpaceId = String(params.space_id);
        return HttpResponse.json({ releases: [] });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: "test-token",
      region: "eu",
      rateLimit: false,
    });

    await client.releases.list({ path: { space_id: 999 } });

    expect(resolvedSpaceId).toBe("999");
  });
});
