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
 * id and always returns the caller's organization, which every other org
 * operation (`PUT`/`PATCH`) already addresses as `/v1/orgs/me`. Move the
 * operation next to them so the generated SDK needs no fake id. No-op once
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

const MAPI_PARSER: Parser = {
  patch: {
    input: moveGetOrganizationToMe,
    schemas: {
      ComponentCreateRequest: widenComponentGroupUuid,
      ComponentUpdateRequest: widenComponentGroupUuid,
    },
  },
};

/** Parser config per spec, or `undefined` when a spec needs no patches. */
export const SPEC_PARSERS: Partial<Record<SpecSource, Parser>> = {
  mapi: MAPI_PARSER,
};
