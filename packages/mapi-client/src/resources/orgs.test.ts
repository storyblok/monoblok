import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { createManagementApiClient } from "../index";

const ORG_URL = "https://mapi.storyblok.com/v1/orgs/me";
const ORG = { id: 42, name: "Acme" };

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const createClient = () =>
  createManagementApiClient({
    personalAccessToken: "test-token",
    region: "eu",
    rateLimit: false,
  });

describe("orgs.get()", () => {
  it("should retrieve the organization of the authenticated user without a space id", async () => {
    server.use(http.get(ORG_URL, () => HttpResponse.json({ org: ORG })));

    const result = await createClient().orgs.get();

    expect(result.data?.org).toEqual(ORG);
  });

  it("should forward the query", async () => {
    let showPasswordComplexity: string | null = null;
    server.use(
      http.get(ORG_URL, ({ request }) => {
        showPasswordComplexity = new URL(request.url).searchParams.get("show_password_complexity");
        return HttpResponse.json({ org: ORG });
      }),
    );

    await createClient().orgs.get({ query: { show_password_complexity: "true" } });

    expect(showPasswordComplexity).toBe("true");
  });

  it("should return the error on 401", async () => {
    server.use(
      http.get(ORG_URL, () => HttpResponse.json({ error: "Unauthorized" }, { status: 401 })),
    );

    const result = await createClient().orgs.get();

    expect(result.data).toBeUndefined();
    expect(result.error?.response.status).toBe(401);
  });
});

describe("orgs.update()", () => {
  it("should send a partial update for the organization", async () => {
    let requestBody: unknown;
    server.use(
      http.patch(ORG_URL, async ({ request }) => {
        requestBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const body = { org: { name: "Acme Inc." } };

    const result = await createClient().orgs.update({ body });

    expect(requestBody).toEqual(body);
    expect(result.error).toBeUndefined();
  });

  it("should return the validation error on 422", async () => {
    server.use(
      http.patch(ORG_URL, () => HttpResponse.json({ name: ["is invalid"] }, { status: 422 })),
    );

    const result = await createClient().orgs.update({ body: { org: { name: "" } } });

    expect(result.error?.response.status).toBe(422);
  });
});

describe("orgs.replace()", () => {
  it("should replace the organization settings", async () => {
    let requestBody: unknown;
    server.use(
      http.put(ORG_URL, async ({ request }) => {
        requestBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const body = { org: { name: "Acme Inc." } };

    const result = await createClient().orgs.replace({ body });

    expect(requestBody).toEqual(body);
    expect(result.error).toBeUndefined();
  });
});
