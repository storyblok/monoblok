import { describe, expect, it } from "vitest";
import { SPEC_INPUT_PATCHES } from "./patches.ts";

const TOKEN_PARAM = { name: "token", in: "query", required: true, schema: { type: "string" } };
const PAGE_PARAM = { name: "page", in: "query", schema: { type: "integer" } };

describe("CAPI input patch", () => {
  it("should drop the token query parameter that the security scheme already covers", () => {
    const spec = {
      paths: {
        "/v2/cdn/stories": {
          parameters: [TOKEN_PARAM],
          get: { parameters: [TOKEN_PARAM, PAGE_PARAM] },
        },
      },
    };

    SPEC_INPUT_PATCHES.capi?.(spec);

    expect(spec.paths["/v2/cdn/stories"].parameters).toEqual([]);
    expect(spec.paths["/v2/cdn/stories"].get.parameters).toEqual([PAGE_PARAM]);
  });

  it("should keep a token parameter that is not a query parameter", () => {
    const headerToken = { ...TOKEN_PARAM, in: "header" };
    const spec = { paths: { "/v2/cdn/links": { get: { parameters: [headerToken] } } } };

    SPEC_INPUT_PATCHES.capi?.(spec);

    expect(spec.paths["/v2/cdn/links"].get.parameters).toEqual([headerToken]);
  });
});

describe("MAPI input patch", () => {
  it("should add a create schema for webhooks that requires the fields the API requires", () => {
    const spec = {
      paths: {
        "/v1/spaces/{space_id}/webhook_endpoints": {
          post: {
            requestBody: {
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/WebhookEndpointRequest" },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          WebhookEndpointRequest: {
            type: "object",
            properties: { webhook_endpoint: { type: "object", properties: {} } },
          },
        },
      },
    };

    SPEC_INPUT_PATCHES.mapi?.(spec);

    expect(spec.components.schemas).toHaveProperty(
      "CreateWebhookEndpointRequest.properties.webhook_endpoint.required",
      ["name", "endpoint", "actions"],
    );
  });
});
