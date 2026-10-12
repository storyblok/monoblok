import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createManagementApiClient } from "../index";

const BASE_URL = "https://mapi.storyblok.com/v1/spaces/:space_id/workflow_stages";
const WORKFLOW_STAGE = { id: 11, name: "Drafting", workflow_id: 3, color: "#ff0000" };

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

describe("workflowStages.list()", () => {
  it("should list the workflow stages of the space, forwarding the query", async () => {
    let requestedSpaceId: string | undefined;
    let inWorkflow: string | null = null;
    server.use(
      http.get(BASE_URL, ({ params, request }) => {
        requestedSpaceId = String(params.space_id);
        inWorkflow = new URL(request.url).searchParams.get("in_workflow");
        return HttpResponse.json({ workflow_stages: [WORKFLOW_STAGE] });
      }),
    );

    const result = await createClient(123).workflowStages.list({ query: { in_workflow: 3 } });

    expect(requestedSpaceId).toBe("123");
    expect(inWorkflow).toBe("3");
    expect(result.data?.workflow_stages).toEqual([WORKFLOW_STAGE]);
  });

  it("should use the space id from the path option over the client default", async () => {
    let requestedSpaceId: string | undefined;
    server.use(
      http.get(BASE_URL, ({ params }) => {
        requestedSpaceId = String(params.space_id);
        return HttpResponse.json({ workflow_stages: [] });
      }),
    );

    await createClient(123).workflowStages.list({ path: { space_id: 999 } });

    expect(requestedSpaceId).toBe("999");
  });

  it("should throw when no space id is available", () => {
    expect(() => createClient().workflowStages.list()).toThrow(/Missing space_id/);
  });

  it("should return the error on 401", async () => {
    server.use(
      http.get(BASE_URL, () => HttpResponse.json({ error: "Unauthorized" }, { status: 401 })),
    );

    const result = await createClient(123).workflowStages.list();

    expect(result.data).toBeUndefined();
    expect(result.error?.response.status).toBe(401);
  });
});

describe("workflowStages.get()", () => {
  it("should retrieve a single workflow stage", async () => {
    let requestedId: string | undefined;
    server.use(
      http.get(`${BASE_URL}/:id`, ({ params }) => {
        requestedId = String(params.id);
        return HttpResponse.json({ workflow_stage: WORKFLOW_STAGE });
      }),
    );

    const result = await createClient(123).workflowStages.get(11);

    expect(requestedId).toBe("11");
    expect(result.data?.workflow_stage).toEqual(WORKFLOW_STAGE);
  });
});

describe("workflowStages.create()", () => {
  it("should send the workflow stage and return the created stage", async () => {
    let requestBody: unknown;
    server.use(
      http.post(BASE_URL, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ workflow_stage: WORKFLOW_STAGE }, { status: 201 });
      }),
    );
    const body = { workflow_stage: { name: "Drafting", color: "#ff0000", workflow_id: 3 } };

    const result = await createClient(123).workflowStages.create({ body });

    expect(requestBody).toEqual(body);
    expect(result.data?.workflow_stage).toEqual(WORKFLOW_STAGE);
  });
});

describe("workflowStages.update()", () => {
  it("should send a partial update for the workflow stage", async () => {
    let requestedId: string | undefined;
    let requestBody: unknown;
    server.use(
      http.patch(`${BASE_URL}/:id`, async ({ params, request }) => {
        requestedId = String(params.id);
        requestBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const body = { workflow_stage: { name: "Writing" } };

    const result = await createClient(123).workflowStages.update(11, { body });

    expect(requestedId).toBe("11");
    expect(requestBody).toEqual(body);
    expect(result.error).toBeUndefined();
  });
});

describe("workflowStages.replace()", () => {
  it("should replace the workflow stage", async () => {
    let requestBody: unknown;
    server.use(
      http.put(`${BASE_URL}/:id`, async ({ request }) => {
        requestBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const body = { workflow_stage: { name: "Drafting", workflow_id: 3 } };

    const result = await createClient(123).workflowStages.replace(11, { body });

    expect(requestBody).toEqual(body);
    expect(result.error).toBeUndefined();
  });
});

describe("workflowStages.delete()", () => {
  it("should delete the workflow stage", async () => {
    let requestedId: string | undefined;
    server.use(
      http.delete(`${BASE_URL}/:id`, ({ params }) => {
        requestedId = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const result = await createClient(123).workflowStages.delete(11);

    expect(requestedId).toBe("11");
    expect(result.error).toBeUndefined();
  });
});
