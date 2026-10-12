import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createManagementApiClient } from "../index";

const BASE_URL = "https://mapi.storyblok.com/v1/spaces/:space_id/space_roles";
const SPACE_ROLE = { id: 5, role: "Editor", permissions: ["publish_stories"] };

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const createClient = (spaceId?: number) =>
  createManagementApiClient({
    personalAccessToken: "test-token",
    spaceId,
    region: "eu",
    rateLimit: false,
  });

describe("spaceRoles.list()", () => {
  it("should list the roles of the space, forwarding the query", async () => {
    let requestedSpaceId: string | undefined;
    let search: string | null = null;
    server.use(
      http.get(BASE_URL, ({ params, request }) => {
        requestedSpaceId = String(params.space_id);
        search = new URL(request.url).searchParams.get("search");
        return HttpResponse.json({ space_roles: [SPACE_ROLE] });
      }),
    );

    const result = await createClient(123).spaceRoles.list({ query: { search: "Edit" } });

    expect(requestedSpaceId).toBe("123");
    expect(search).toBe("Edit");
    expect(result.data?.space_roles).toEqual([SPACE_ROLE]);
  });

  it("should use the space id from the path option over the client default", async () => {
    let requestedSpaceId: string | undefined;
    server.use(
      http.get(BASE_URL, ({ params }) => {
        requestedSpaceId = String(params.space_id);
        return HttpResponse.json({ space_roles: [] });
      }),
    );

    await createClient(123).spaceRoles.list({ path: { space_id: 999 } });

    expect(requestedSpaceId).toBe("999");
  });

  it("should throw when no space id is available", () => {
    expect(() => createClient().spaceRoles.list()).toThrow(/Missing space_id/);
  });

  it("should return the error on 401", async () => {
    server.use(
      http.get(BASE_URL, () => HttpResponse.json({ error: "Unauthorized" }, { status: 401 })),
    );

    const result = await createClient(123).spaceRoles.list();

    expect(result.data).toBeUndefined();
    expect(result.error?.response.status).toBe(401);
  });
});

describe("spaceRoles.get()", () => {
  it("should retrieve a single space role", async () => {
    let requestedId: string | undefined;
    server.use(
      http.get(`${BASE_URL}/:id`, ({ params }) => {
        requestedId = String(params.id);
        return HttpResponse.json({ space_role: SPACE_ROLE });
      }),
    );

    const result = await createClient(123).spaceRoles.get(5);

    expect(requestedId).toBe("5");
    expect(result.data?.space_role).toEqual(SPACE_ROLE);
  });
});

describe("spaceRoles.create()", () => {
  it("should send the space role and return the created role", async () => {
    let requestBody: unknown;
    server.use(
      http.post(BASE_URL, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ space_role: SPACE_ROLE }, { status: 201 });
      }),
    );
    const body = { space_role: { role: "Editor", permissions: ["publish_stories"] } };

    const result = await createClient(123).spaceRoles.create({ body });

    expect(requestBody).toEqual(body);
    expect(result.data?.space_role).toEqual(SPACE_ROLE);
  });
});

describe("spaceRoles.update()", () => {
  it("should send a partial update for the space role", async () => {
    let requestedId: string | undefined;
    let requestBody: unknown;
    server.use(
      http.patch(`${BASE_URL}/:id`, async ({ params, request }) => {
        requestedId = String(params.id);
        requestBody = await request.json();
        return HttpResponse.json({ space_role: { ...SPACE_ROLE, role: "Reviewer" } });
      }),
    );
    const body = { space_role: { role: "Reviewer" } };

    const result = await createClient(123).spaceRoles.update(5, { body });

    expect(requestedId).toBe("5");
    expect(requestBody).toEqual(body);
    expect(result.data?.space_role.role).toBe("Reviewer");
  });
});

describe("spaceRoles.replace()", () => {
  it("should replace the space role", async () => {
    let requestBody: unknown;
    server.use(
      http.put(`${BASE_URL}/:id`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ space_role: SPACE_ROLE });
      }),
    );
    const body = { space_role: { role: "Editor", permissions: ["publish_stories"] } };

    const result = await createClient(123).spaceRoles.replace(5, { body });

    expect(requestBody).toEqual(body);
    expect(result.error).toBeUndefined();
  });
});

describe("spaceRoles.delete()", () => {
  it("should delete the space role", async () => {
    let requestedId: string | undefined;
    server.use(
      http.delete(`${BASE_URL}/:id`, ({ params }) => {
        requestedId = String(params.id);
        return HttpResponse.json({ space_role: SPACE_ROLE });
      }),
    );

    const result = await createClient(123).spaceRoles.delete(5);

    expect(requestedId).toBe("5");
    expect(result.error).toBeUndefined();
  });
});
