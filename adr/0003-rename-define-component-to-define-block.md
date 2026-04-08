# ADR-0003: Rename defineComponent to defineBlock in schema package

**Status:** Accepted
**Date:** 2026-04-16

## Context

The Storyblok documentation team is aligning terminology: the user-facing concept is a "block," not a "component." The `@storyblok/schema` package — the define layer where users author block schemas — should reflect this.

However, the Storyblok Management API (MAPI) and Content API (CAPI) use "component" in their REST endpoints, request/response payloads, and field names (`component_whitelist`, `searchblok_id`, etc.). Renaming those would break API compatibility.

## Decision

Rename the schema define layer to block terminology. Keep component/blok terminology everywhere that directly mirrors the REST API.

**Schema package (`@storyblok/schema`)** — the boundary:

- `defineComponent` → `defineBlock` (and `defineBlockCreate`, `defineBlockUpdate`, `defineBlockFolder`, etc.)
- `Component` type → `Block`, `ComponentSchema` → `BlockSchema`, `RootComponents` → `RootBlocks`, `NestableComponents` → `NestableBlocks`
- `BlokContent` → `BlockContent`, `BlokContentInput` → `BlockContentInput`, `BloksFieldValue` → `BlocksFieldValue`

**Client packages (`mapi-client`, `capi-client`)** — outside the boundary:

- Import new names from schema, re-export under REST API naming for their consumers (`Block as Component`, `BlockContent as BlokContent`, etc.)
- Internal code keeps REST API terminology via import aliases (`import type { Block as Component }`)
- `StoryblokTypesConfig` (the `withTypes()` interface) accepts `Component`, which is the aliased `Block` type from schema

**Unchanged:**

- OpenAPI specs, generated types, API field names, string literals (`type: 'bloks'`, `type: 'blok'`)
- CLI and migrations packages (consume mapi-client re-exports, unaffected)

## Consequences

- Users of `@storyblok/schema` see block terminology matching Storyblok docs
- Users of `mapi-client`/`capi-client` see component/blok terminology matching the REST API
