import { describe, expect, it } from "vitest";
import { applyInputPatches, applySpecPatches } from "./patches.ts";

const webhookSpec = () => ({
  paths: {
    "/v1/spaces/{space_id}/webhook_endpoints": {
      post: {
        requestBody: {
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/WebhookEndpointRequest" } },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      WebhookEndpointRequest: {
        type: "object",
        properties: {
          webhook_endpoint: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              secret: { type: "string" },
            },
          },
        },
      },
    },
  },
});

type Property = { type: string | string[] };
type Patched = {
  components: {
    schemas: Record<
      string,
      { properties: { webhook_endpoint: { properties: Record<string, Property> } } }
    >;
  };
};

/** Reads the patched spec back in the shape the assertions walk. */
function webhookRequestProperties(spec: unknown, schema: string): Record<string, Property> {
  const patched: Patched = JSON.parse(JSON.stringify(spec));
  return patched.components.schemas[schema].properties.webhook_endpoint.properties;
}

describe("applyInputPatches", () => {
  it("should let webhook requests clear the description and the secret", () => {
    const spec = webhookSpec();

    applyInputPatches("mapi", spec);

    for (const schema of ["WebhookEndpointRequest", "CreateWebhookEndpointRequest"]) {
      const properties = webhookRequestProperties(spec, schema);
      expect(properties.description.type).toEqual(["string", "null"]);
      expect(properties.secret.type).toEqual(["string", "null"]);
      expect(properties.name.type).toBe("string");
    }
  });
});

describe("applySpecPatches", () => {
  it("should apply the per-schema patches the type generator applies", () => {
    const spec = {
      paths: {},
      components: {
        schemas: {
          ComponentUpdateRequest: {
            type: "object",
            properties: {
              component: { type: "object", properties: { description: { type: "string" } } },
            },
          },
        },
      },
    };

    applySpecPatches("mapi", spec);

    expect(
      spec.components.schemas.ComponentUpdateRequest.properties.component.properties.description
        .type,
    ).toEqual(["string", "null"]);
  });
});
