import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createManagementApiClient } from "../index";

const BASE_URL = "https://mapi.storyblok.com/v1/spaces/:space_id/workflows";
const WORKFLOW = { id: 3, name: "Review", content_types: ["page"], is_default: false };

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

describe("workflows.list()", () => {
  it("should list the workflows of the space, forwarding the query", async () => {
    let requestedSpaceId: string | undefined;
    let includeStages: string | null = null;
    server.use(
      http.get(BASE_URL, ({ params, request }) => {
        requestedSpaceId = String(params.space_id);
        includeStages = new URL(request.url).searchParams.get("include_stages");
        return HttpResponse.json({ workflows: [WORKFLOW] });
      }),
    );

    const result = await createClient(123).workflows.list({ query: { include_stages: true } });

    expect(requestedSpaceId).toBe("123");
    expect(includeStages).toBe("true");
    expect(result.data?.workflows).toEqual([WORKFLOW]);
  });

  it("should use the space id from the path option over the client default", async () => {
    let requestedSpaceId: string | undefined;
    server.use(
      http.get(BASE_URL, ({ params }) => {
        requestedSpaceId = String(params.space_id);
        return HttpResponse.json({ workflows: [] });
      }),
    );

    await createClient(123).workflows.list({ path: { space_id: 999 } });

    expect(requestedSpaceId).toBe("999");
  });

  it("should throw when no space id is available", () => {
    expect(() => createClient().workflows.list()).toThrow(/Missing space_id/);
  });

  it("should return the error on 401", async () => {
    server.use(
      http.get(BASE_URL, () => HttpResponse.json({ error: "Unauthorized" }, { status: 401 })),
    );

    const result = await createClient(123).workflows.list();

    expect(result.data).toBeUndefined();
    expect(result.error?.response.status).toBe(401);
  });
});

describe("workflows.get()", () => {
  it("should retrieve a single workflow", async () => {
    let requestedId: string | undefined;
    server.use(
      http.get(`${BASE_URL}/:id`, ({ params }) => {
        requestedId = String(params.id);
        return HttpResponse.json({ workflow: WORKFLOW });
      }),
    );

    const result = await createClient(123).workflows.get(3);

    expect(requestedId).toBe("3");
    expect(result.data?.workflow).toEqual(WORKFLOW);
  });
});

describe("workflows.create()", () => {
  it("should send the workflow and return the created workflow", async () => {
    let requestBody: unknown;
    server.use(
      http.post(BASE_URL, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ workflow: WORKFLOW }, { status: 201 });
      }),
    );
    const body = { workflow: { name: "Review", content_types: ["page"] } };

    const result = await createClient(123).workflows.create({ body });

    expect(requestBody).toEqual(body);
    expect(result.data?.workflow).toEqual(WORKFLOW);
  });
});

describe("workflows.update()", () => {
  it("should send the update for the workflow", async () => {
    let requestedId: string | undefined;
    let requestBody: unknown;
    server.use(
      http.put(`${BASE_URL}/:id`, async ({ params, request }) => {
        requestedId = String(params.id);
        requestBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const body = { workflow: { name: "Legal review" } };

    const result = await createClient(123).workflows.update(3, { body });

    expect(requestedId).toBe("3");
    expect(requestBody).toEqual(body);
    expect(result.error).toBeUndefined();
  });
});

describe("workflows.delete()", () => {
  it("should delete the workflow", async () => {
    let requestedId: string | undefined;
    server.use(
      http.delete(`${BASE_URL}/:id`, ({ params }) => {
        requestedId = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const result = await createClient(123).workflows.delete(3);

    expect(requestedId).toBe("3");
    expect(result.error).toBeUndefined();
  });
});
