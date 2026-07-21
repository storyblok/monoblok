# ADR-0006: Datasource per-dimension entry values

**Status:** Accepted
**Date:** 2026-07-07

## Context

`storyblok datasources pull` exported each entry with its default-dimension value only. The Storyblok Management API fills an entry's `dimension_value` only when a request passes the numeric `dimension` id, and it returns a single scalar per request. The pull command never passed `dimension`, so entries for datasources with dimensions (for example a per-language `en` dimension) lost all dimension-specific values locally, and `push` could not restore them (DX-466).

Three decisions shaped the fix: how to represent multiple dimension values on disk, how to create the dimensions themselves on a target space, and how to send the `dimension_id` write parameter that the API accepts but the OpenAPI spec does not model.

## Decision

**Store per-dimension values keyed by dimension code.** Each local entry carries an optional `dimension_values` map keyed by the dimension code (`entry_value`, e.g. `en`) rather than the numeric dimension id. Codes are stable across spaces; ids are not. This keeps datasources portable: `push` resolves each code to the target space's dimension id via the target datasource's `dimensions` array, skips codes with no matching target dimension (with a warning), and clears a dimension removed locally by sending a blank value. Pull runs one entry sweep per dimension in addition to the default sweep and merges non-empty values into the map; the transient scalar `dimension_value` is not written to disk.

**Create dimensions on push by mapping to `dimensions_attributes`.** The MAPI datasource create endpoint models dimensions only through the Rails nested-attributes field `dimensions_attributes` (`name` + `entry_value`); the pulled `dimensions` array (which carries source-space ids) is otherwise ignored. On create, `pushDatasource` maps `dimensions` to `dimensions_attributes` so a fresh target space gets its dimensions created and the target assigns new ids, after which per-dimension entry values resolve by code. This mapping is applied on create only: sending `dimensions_attributes` without ids on update would create duplicate dimensions, so updates leave existing dimensions untouched, and a code missing from an already-existing target datasource still falls through to the warn-and-skip path.

**Forward `dimension_id` from the mapi-client wrapper instead of patching the spec.** The MAPI update endpoint reads `params[:dimension_id]` to write a dimension child row, but `storyblok/openapi-wdx` does not model that query parameter, so the generated `UpdateData['query']` is `never`. The generated sdk forwards `query` verbatim at runtime, so the hand-written `datasourceEntries.update` wrapper exposes `query.dimension_id` and passes it through with a localized cast. This keeps the fix within the monorepo, with no cross-repo spec change or `spec.lock` bump.

## Consequences

- Datasources round-trip fully into a fresh target space: push creates the datasource with its dimensions, then writes per-dimension entry values resolved by code. The on-disk file format changes from a scalar `dimension_value` to a `dimension_values` map.
- Pull issues `1 + dimensionCount` sweeps per datasource; dimension sweeps run sequentially per datasource to bound request volume against the rate limit.
- Files pulled before this change (scalar `dimension_value`) still read and push without error; they simply carry no `dimension_values`.
- Dimensions are created but not reconciled on update: adding a dimension to an already-pushed target datasource, or removing one, is out of scope and would require id-aware `dimensions_attributes` diffing. Values for a code with no matching target dimension are skipped with a warning.
- The wrapper cast is a deliberate, documented divergence from the generated types. Modeling `dimension_id` upstream in `openapi-wdx` and regenerating would remove the cast; that is a follow-up, not a prerequisite.

Links: DX-466, GitHub #656.
