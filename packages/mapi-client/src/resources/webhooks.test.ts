import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createManagementApiClient } from "../index";

const BASE_URL = "https://mapi.storyblok.com/v1/spaces/:space_id/webhook_endpoints";
const WEBHOOK = {
  id: 7,
  name: "Deploy",
  endpoint: "https://example.com/deploy",
  actions: ["story.published"],
};

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

describe("webhooks.list()", () => {
  it("should list the webhooks of the space", async () => {
    let requestedSpaceId: string | undefined;
    server.use(
      http.get(BASE_URL, ({ params }) => {
        requestedSpaceId = String(params.space_id);
        return HttpResponse.json({ webhook_endpoints: [WEBHOOK] });
      }),
    );

    const result = await createClient(123).webhooks.list();

    expect(requestedSpaceId).toBe("123");
    expect(result.data?.webhook_endpoints).toEqual([WEBHOOK]);
  });

  it("should use the space id from the path option over the client default", async () => {
    let requestedSpaceId: string | undefined;
    server.use(
      http.get(BASE_URL, ({ params }) => {
        requestedSpaceId = String(params.space_id);
        return HttpResponse.json({ webhook_endpoints: [] });
      }),
    );

    await createClient(123).webhooks.list({ path: { space_id: 999 } });

    expect(requestedSpaceId).toBe("999");
  });

  it("should throw when no space id is available", () => {
    expect(() => createClient().webhooks.list()).toThrow(/Missing space_id/);
  });

  it("should return the error on 401", async () => {
    server.use(
      http.get(BASE_URL, () => HttpResponse.json({ error: "Unauthorized" }, { status: 401 })),
    );

    const result = await createClient(123).webhooks.list();

    expect(result.data).toBeUndefined();
    expect(result.error?.response.status).toBe(401);
  });
});

describe("webhooks.get()", () => {
  it("should retrieve a single webhook", async () => {
    let requestedId: string | undefined;
    server.use(
      http.get(`${BASE_URL}/:id`, ({ params }) => {
        requestedId = String(params.id);
        return HttpResponse.json({ webhook_endpoint: WEBHOOK });
      }),
    );

    const result = await createClient(123).webhooks.get(7);

    expect(requestedId).toBe("7");
    expect(result.data?.webhook_endpoint).toEqual(WEBHOOK);
  });
});

describe("webhooks.create()", () => {
  it("should send the webhook and return the created webhook", async () => {
    let requestBody: unknown;
    server.use(
      http.post(BASE_URL, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ webhook_endpoint: WEBHOOK }, { status: 201 });
      }),
    );
    const body = {
      webhook_endpoint: {
        name: "Deploy",
        endpoint: "https://example.com/deploy",
        actions: ["story.published"],
      },
    };

    const result = await createClient(123).webhooks.create({ body });

    expect(requestBody).toEqual(body);
    expect(result.data?.webhook_endpoint).toEqual(WEBHOOK);
  });

  it("should return the validation error on 422", async () => {
    server.use(
      http.post(BASE_URL, () => HttpResponse.json({ endpoint: ["is invalid"] }, { status: 422 })),
    );

    const result = await createClient(123).webhooks.create({
      body: { webhook_endpoint: { endpoint: "not-a-url" } },
    });

    expect(result.error?.response.status).toBe(422);
  });
});

describe("webhooks.update()", () => {
  it("should send a partial update for the webhook", async () => {
    let requestedId: string | undefined;
    let requestBody: unknown;
    server.use(
      http.patch(`${BASE_URL}/:id`, async ({ params, request }) => {
        requestedId = String(params.id);
        requestBody = await request.json();
        return HttpResponse.json({ webhook_endpoint: { ...WEBHOOK, name: "Rebuild" } });
      }),
    );
    const body = { webhook_endpoint: { name: "Rebuild" } };

    const result = await createClient(123).webhooks.update(7, { body });

    expect(requestedId).toBe("7");
    expect(requestBody).toEqual(body);
    expect(result.data?.webhook_endpoint.name).toBe("Rebuild");
  });
});

describe("webhooks.delete()", () => {
  it("should delete the webhook", async () => {
    let requestedId: string | undefined;
    server.use(
      http.delete(`${BASE_URL}/:id`, ({ params }) => {
        requestedId = String(params.id);
        return HttpResponse.json({ webhook_endpoint: WEBHOOK });
      }),
    );

    const result = await createClient(123).webhooks.delete(7);

    expect(requestedId).toBe("7");
    expect(result.error).toBeUndefined();
  });
});

describe("webhooks.allowedActions()", () => {
  it("should list the actions a webhook can subscribe to", async () => {
    server.use(
      http.get(`${BASE_URL}/allowed_actions`, () =>
        HttpResponse.json({
          allowed_actions: [{ action: "story.published" }, { action: "story.unpublished" }],
        }),
      ),
    );

    const result = await createClient(123).webhooks.allowedActions();

    expect(result.data?.allowed_actions.map(({ action }) => action)).toEqual([
      "story.published",
      "story.unpublished",
    ]);
  });
});
