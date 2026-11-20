/**
 * Per-spec parser patches applied in-memory by `@hey-api/openapi-ts` before it
 * generates types (via `parser.patch.schemas`). Each patch mutates the parsed
 * OpenAPI schema object in place.
 *
 * Use these only to correct upstream OpenAPI gaps we cannot fix in the private
 * `storyblok/openapi-wdx` spec directly. A patch here is a deliberate, reviewed
 * divergence from upstream: keep the list small, document why each exists, and
 * migrate the fix upstream when the contract is owned there.
 */

import type { UserConfig } from "@hey-api/openapi-ts";
import type { SpecSource } from "./aliases.ts";
import { isRecord } from "./object.ts";

type Parser = NonNullable<UserConfig["parser"]>;

/**
 * Component write properties the MAPI clears when sent `null`. Excludes
 * `metadata`, which the MAPI clears only with `{}`.
 */
const NULLABLE_COMPONENT_WRITE_PROPERTIES = [
  "display_name",
  "description",
  "image",
  "preview_field",
  "preview_tmpl",
  "preset_id",
  "component_group_uuid",
  "color",
  "icon",
  "content_type_asset_preview",
];

/**
 * Widen a component write request's clearable properties to nullable, matching
 * the read `Component` schema.
 *
 * The properties live at `.properties.component.properties` (both request bodies
 * wrap the component in a `component` envelope). Typed as `unknown` because
 * hey-api's `SchemaObject` union is not ergonomic to navigate; the runtime
 * guards make the walk safe.
 */
function widenNullableComponentProperties(schema: unknown): void {
  if (!isRecord(schema) || !isRecord(schema.properties)) {
    return;
  }
  const component = schema.properties.component;
  if (!isRecord(component) || !isRecord(component.properties)) {
    return;
  }
  for (const name of NULLABLE_COMPONENT_WRITE_PROPERTIES) {
    const property = component.properties[name];
    if (isRecord(property) && typeof property.type === "string") {
      property.type = [property.type, "null"];
    }
  }
}

const ORG_BY_ID_PATH = "/v1/orgs/{id}";
const CURRENT_ORG_PATH = "/v1/orgs/me";

/**
 * Serve "Retrieve Organization" from `GET /v1/orgs/me`.
 *
 * The upstream spec declares it as `GET /v1/orgs/{id}`, but the API ignores the
 * id and always returns the caller's organization, which every other
 * organization operation (`PUT`/`PATCH`) already addresses as `/v1/orgs/me`.
 * Move the operation next to them so callers need no placeholder id. No-op once
 * upstream declares `GET /v1/orgs/me` itself.
 */
function moveGetOrganizationToMe(spec: unknown): void {
  if (!isRecord(spec) || !isRecord(spec.paths)) {
    return;
  }
  const byId = spec.paths[ORG_BY_ID_PATH];
  const current = spec.paths[CURRENT_ORG_PATH];
  if (!isRecord(byId) || !isRecord(byId.get) || !isRecord(current) || current.get) {
    return;
  }
  current.get = byId.get;
  delete byId.get;
  const remainingMethods = Object.keys(byId).filter((key) => key !== "parameters");
  if (remainingMethods.length === 0) {
    delete spec.paths[ORG_BY_ID_PATH];
  }
}

const WORKFLOW_STAGE_CREATE_REQUIRED = ["name", "color"];

/**
 * Require `name` and `color` on "Create Workflow Stage".
 *
 * Upstream declares `required` next to a single-`allOf` `$ref`, which hey-api
 * drops, and also lists `workflow_id`, which the API does not require (it
 * defaults to the space's default workflow). The API rejects a create without
 * `name` or `color` (422). Put exactly those two in a second `allOf` member so
 * the generated type is an intersection that keeps them required.
 */
function requireWorkflowStageCreateFields(schema: unknown): void {
  if (!isRecord(schema) || !isRecord(schema.properties)) {
    return;
  }
  const stage = schema.properties.workflow_stage;
  if (!isRecord(stage) || !Array.isArray(stage.allOf) || stage.allOf.length !== 1) {
    return;
  }
  stage.allOf = [
    ...stage.allOf,
    {
      type: "object",
      required: WORKFLOW_STAGE_CREATE_REQUIRED,
      properties: Object.fromEntries(
        WORKFLOW_STAGE_CREATE_REQUIRED.map((name) => [name, { type: "string" }]),
      ),
    },
  ];
  delete stage.required;
}

const SCHEMA_REF_PREFIX = "#/components/schemas/";
const WEBHOOKS_PATH = "/v1/spaces/{space_id}/webhook_endpoints";
const WEBHOOK_CREATE_SCHEMA = "CreateWebhookEndpointRequest";
const WEBHOOK_CREATE_REQUIRED = ["name", "endpoint", "actions"];

/**
 * Give "Create Webhook" a request body with its required fields.
 *
 * Upstream, create (`POST`) and partial update (`PATCH`) share
 * `WebhookEndpointRequest`, which marks every field optional. The API rejects a
 * create without `name`, `endpoint`, or `actions` (422), so create gets its own
 * copy that requires them, and update keeps the shared, all-optional schema.
 */
function requireWebhookCreateFields(spec: unknown): void {
  if (!isRecord(spec) || !isRecord(spec.paths) || !isRecord(spec.components)) {
    return;
  }
  const { schemas } = spec.components;
  const webhooks = spec.paths[WEBHOOKS_PATH];
  if (!isRecord(schemas) || schemas[WEBHOOK_CREATE_SCHEMA] || !isRecord(webhooks)) {
    return;
  }
  const createSchema = structuredClone(schemas.WebhookEndpointRequest);
  const body =
    isRecord(createSchema) && isRecord(createSchema.properties)
      ? createSchema.properties.webhook_endpoint
      : undefined;
  const jsonBody =
    isRecord(webhooks.post) &&
    isRecord(webhooks.post.requestBody) &&
    isRecord(webhooks.post.requestBody.content)
      ? webhooks.post.requestBody.content["application/json"]
      : undefined;
  if (!isRecord(body) || !isRecord(jsonBody)) {
    return;
  }
  body.required = WEBHOOK_CREATE_REQUIRED;
  schemas[WEBHOOK_CREATE_SCHEMA] = createSchema;
  jsonBody.schema = { $ref: `${SCHEMA_REF_PREFIX}${WEBHOOK_CREATE_SCHEMA}` };
}

const NULLABLE_WEBHOOK_WRITE_PROPERTIES = ["description", "secret"];

/**
 * Let webhook requests clear `description` and `secret` with `null`, matching
 * the read `WebhookEndpoint` schema, which already declares both nullable.
 * Runs before {@link requireWebhookCreateFields} copies the schema for create.
 */
function widenNullableWebhookProperties(spec: unknown): void {
  if (!isRecord(spec) || !isRecord(spec.components) || !isRecord(spec.components.schemas)) {
    return;
  }
  const request = spec.components.schemas.WebhookEndpointRequest;
  const body =
    isRecord(request) && isRecord(request.properties)
      ? request.properties.webhook_endpoint
      : undefined;
  if (!isRecord(body) || !isRecord(body.properties)) {
    return;
  }
  for (const name of NULLABLE_WEBHOOK_WRITE_PROPERTIES) {
    const property = body.properties[name];
    if (isRecord(property) && typeof property.type === "string") {
      property.type = [property.type, "null"];
    }
  }
}

const STRATA_SEARCH_PATH = "/v1/spaces/{space_id}/strata/search";

const strataErrorResponse = (description: string) => ({
  description,
  content: {
    "application/json": { schema: { $ref: `${SCHEMA_REF_PREFIX}StrataErrorResponse` } },
  },
});

/**
 * Declare "Search the Strata index" on the Management API.
 *
 * The endpoint is live, and the CLI's `stories find --mode semantic` depends on
 * it, but upstream leaves the operation out of the public spec while it keeps the
 * schemas it returns (`StrataSearchResults`, `StrataErrorResponse`). Without the
 * operation there is no typed client method. The parameters and responses follow
 * the API's observed contract. No-op once upstream declares the path itself.
 *
 * @todo(openapi-spec): Remove this patch, `STRATA_SEARCH_PATH` and
 * `strataErrorResponse` once the upstream Management API spec publishes
 * `GET /v1/spaces/{space_id}/strata/search`, then regenerate every consumer.
 * `@storyblok/management-api-client`'s `strata.search()` calls the generated
 * `searchStrataIndex`: if upstream names the operation differently, update it.
 */
function addStrataSearchOperation(spec: unknown): void {
  if (!isRecord(spec) || !isRecord(spec.paths) || !isRecord(spec.components)) {
    return;
  }
  const { schemas } = spec.components;
  if (
    spec.paths[STRATA_SEARCH_PATH] ||
    !isRecord(schemas) ||
    !schemas.StrataSearchResults ||
    !schemas.StrataErrorResponse
  ) {
    return;
  }
  spec.paths[STRATA_SEARCH_PATH] = {
    parameters: [
      {
        name: "space_id",
        in: "path",
        required: true,
        description: "Numeric ID of a space",
        schema: { type: "integer" },
      },
    ],
    get: {
      summary: "Search the Strata index",
      operationId: "searchStrataIndex",
      description:
        "Search the space's content by meaning. Results only include stories the user can read, " +
        "so a user whose role limits them to certain folders searches within those folders. A " +
        "scoped personal access token or an OAuth token also needs the `strata:read` scope. Each " +
        "hit is one matching piece of content, so a story can appear more than once.",
      tags: ["Strata"],
      parameters: [
        {
          name: "q",
          in: "query",
          required: false,
          description: "Search term, at most 2000 characters. A blank term returns no results.",
          schema: { type: "string", maxLength: 2000 },
        },
        {
          name: "version",
          in: "query",
          required: false,
          description: "Content version to search.",
          schema: { type: "string", enum: ["draft", "published"], default: "published" },
        },
        {
          name: "limit",
          in: "query",
          required: false,
          description:
            "Maximum number of results, from 1 to 100. With `starts_with` or `content_type` set, at most 50. Any other value returns 400.",
          schema: { type: "integer", default: 25, minimum: 1, maximum: 100 },
        },
        {
          name: "starts_with",
          in: "query",
          required: false,
          description:
            "Only search stories whose full slug starts with this value, e.g. `docs/`. Matches the default-language slug: a language prefix such as `de/` matches nothing.",
          schema: { type: "string" },
        },
        {
          name: "content_type",
          in: "query",
          required: false,
          description:
            "Only search stories whose content type (root component) is this one, read from the draft content.",
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "Search results, best match first",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { results: { $ref: `${SCHEMA_REF_PREFIX}StrataSearchResults` } },
                required: ["results"],
              },
            },
          },
        },
        "400": strataErrorResponse("Invalid parameter value"),
        "401": strataErrorResponse("Unauthorized"),
        "403": strataErrorResponse(
          "Forbidden: Strata is off for the space or organization (`feature_disabled`), or the token lacks `strata:read` (`insufficient_scope`)",
        ),
        "404": strataErrorResponse("The space does not exist or the user cannot access it"),
        "429": strataErrorResponse("Too many requests"),
        "503": strataErrorResponse("Search backend temporarily unavailable"),
      },
    },
  };
}

function patchMapiInput(spec: unknown): void {
  moveGetOrganizationToMe(spec);
  widenNullableWebhookProperties(spec);
  requireWebhookCreateFields(spec);
  // @todo(openapi-spec): Remove once upstream publishes the Strata search operation.
  addStrataSearchOperation(spec);
}

/**
 * Whole-document patches per spec. The generator's parser config reads them from
 * here, and so does tooling that parses a spec on its own, so the two always see
 * the same schemas.
 */
const INPUT_PATCHES: Partial<Record<SpecSource, (spec: unknown) => void>> = {
  mapi: patchMapiInput,
};

/**
 * Applies a spec's whole-document patches in place, exactly as the generator
 * does. For tooling that reads the spec outside the generator and has to see the
 * same schemas it does.
 */
export function applyInputPatches(source: SpecSource, spec: unknown): void {
  INPUT_PATCHES[source]?.(spec);
}

/** Per-schema patches per spec, keyed by component schema name. */
const SCHEMA_PATCHES: Partial<Record<SpecSource, Record<string, (schema: unknown) => void>>> = {
  mapi: {
    ComponentCreateRequest: widenNullableComponentProperties,
    ComponentUpdateRequest: widenNullableComponentProperties,
    CreateWorkflowStageRequest: requireWorkflowStageCreateFields,
  },
};

/**
 * Applies every patch the generator applies, whole-document patches first,
 * then per-schema ones. For tooling that reads a spec's schemas outside the
 * generator, such as the resource field descriptors.
 */
export function applySpecPatches(source: SpecSource, spec: unknown): void {
  applyInputPatches(source, spec);
  const schemas =
    isRecord(spec) && isRecord(spec.components) && isRecord(spec.components.schemas)
      ? spec.components.schemas
      : undefined;
  for (const [name, patch] of Object.entries(SCHEMA_PATCHES[source] ?? {})) {
    if (schemas?.[name] !== undefined) {
      patch(schemas[name]);
    }
  }
}

const MAPI_PARSER: Parser = {
  patch: {
    input: INPUT_PATCHES.mapi,
    schemas: SCHEMA_PATCHES.mapi,
  },
};

/** Parser config per spec, or `undefined` when a spec needs no patches. */
export const SPEC_PARSERS: Partial<Record<SpecSource, Parser>> = {
  mapi: MAPI_PARSER,
};
