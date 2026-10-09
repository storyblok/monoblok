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

type Parser = NonNullable<UserConfig["parser"]>;

/** True for a non-null object we can walk/mutate as a parsed schema node. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Widen a component write request's `component_group_uuid` to nullable.
 *
 * The MAPI accepts `component_group_uuid: null` on component create/update to
 * clear a block's group. The read `Component` schema already models this
 * (`type: ['string', 'null']`), but the `ComponentCreateRequest` /
 * `ComponentUpdateRequest` bodies declare a bare `type: 'string'`. Match them to
 * the read shape so the generated create/update types allow `null` for callers
 * that intentionally clear a group.
 *
 * The property lives at `.properties.component.properties.component_group_uuid`
 * (both request bodies wrap the component in a `component` envelope). Typed as
 * `unknown` because hey-api's `SchemaObject` union is not ergonomic to navigate;
 * the runtime guards make the walk safe.
 */
function widenComponentGroupUuid(schema: unknown): void {
  if (!isRecord(schema) || !isRecord(schema.properties)) {
    return;
  }
  const component = schema.properties.component;
  if (!isRecord(component) || !isRecord(component.properties)) {
    return;
  }
  const group = component.properties.component_group_uuid;
  if (isRecord(group) && group.type === "string") {
    group.type = ["string", "null"];
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

function patchMapiInput(spec: unknown): void {
  moveGetOrganizationToMe(spec);
  requireWebhookCreateFields(spec);
}

const MAPI_PARSER: Parser = {
  patch: {
    input: patchMapiInput,
    schemas: {
      ComponentCreateRequest: widenComponentGroupUuid,
      ComponentUpdateRequest: widenComponentGroupUuid,
      CreateWorkflowStageRequest: requireWorkflowStageCreateFields,
    },
  },
};

/** Parser config per spec, or `undefined` when a spec needs no patches. */
export const SPEC_PARSERS: Partial<Record<SpecSource, Parser>> = {
  mapi: MAPI_PARSER,
};
