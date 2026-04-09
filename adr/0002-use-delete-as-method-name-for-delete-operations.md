# ADR-0002: Use `delete` as Method Name for Delete Operations

**Status:** Accepted  
**Date:** 2026-04-09

## Context

The management API client exposes resource methods that map to HTTP DELETE operations. `delete` is a reserved word in JavaScript, which causes friction in code generation and destructuring. The OpenAPI code generator (`@hey-api/openapi-ts`) appends an underscore to reserved words, producing `export const delete_`. The value also cannot be destructured with its original name (`const { delete } = client.stories` is a syntax error).

An earlier iteration chose `remove` as the operationId and public method name to sidestep these issues. However, this created an inconsistency: the OpenAPI summaries and descriptions still said "Delete", the HTTP verb is DELETE, and the low-level client exposes a generic `.delete()` method. Having two different words for the same concept (`remove` for resource methods, `delete` everywhere else) was confusing and would be difficult to change later once the API surface was widely adopted.

## Decision

Use `delete` as both the OpenAPI `operationId` and the public method name on every resource object (e.g. `client.stories.delete(id)`).

Accept the following trade-offs:

- **Generated SDK code uses `delete_`** — The code generator produces `export const delete_` for the low-level function. The handwritten resource layer calls `delete_()` internally but exposes the method as `delete()` in the object literal, where reserved words are valid as method names.
- **Destructuring requires aliasing** — Consumers who want to destructure must alias: `const { delete: deleteStory } = client.stories`. This is an uncommon pattern with the client's API, and the dot-access form (`client.stories.delete(id)`) works without issues.

## Alternatives Considered

- **`remove`** — Avoids the reserved-word issue entirely. Used by Twilio (which later migrated to `remove`). Rejected because it diverges from the HTTP verb, the OpenAPI descriptions, and the generic client method, adding cognitive overhead.
- **`del`** — Used by Stripe. Short and avoids the reserved-word problem. Rejected because it is an abbreviation that does not match any established term in the domain and is less discoverable.

## Consequences

- Consistent terminology: `delete` is used throughout the OpenAPI spec, generated types (`DeleteData`, `DeleteResponses`), and the public resource API.
- Minor ergonomic cost when destructuring (aliasing required). The overwhelmingly common `client.<resource>.delete()` dot-access pattern is unaffected.
- The generated SDK layer retains `delete_` as an internal detail; consumers interact only with the clean `delete()` method on the resource object.
