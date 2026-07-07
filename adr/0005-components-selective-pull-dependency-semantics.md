# ADR-0005: Components Selective Pull and Push Dependency Semantics

**Status:** Accepted
**Date:** 2026-07-07

## Context

Teams that share a single Storyblok space often only want to sync the components they own, not the entire schema. `components pull` gained `--filter <glob>`, `--group <name|Parent/Child path>` (repeatable, and includes descendant groups), and `--tag <name>` (repeatable and comma-separated), and `components push` gained the matching `--group` and `--tag` selectors alongside its existing `--filter`. Selectors combine with AND across different selector types and OR within a repeatable selector's values.

Selecting a subset of components raises a dependency question: when a component is selected, which of its related records (groups, tags, presets, and other components referenced from its schema) should be pulled or pushed alongside it? Components can reference groups and tags by ID (as their assigned group and tags) and can also reference groups and tags from inside field-level whitelists (`component_group_whitelist`, `component_tag_whitelist`), and they can reference other components by name through `component_whitelist`.

## Options considered

- **Option A (chosen): matches plus their own direct dependencies, minus sibling components.** A selected set includes the matched components, their assigned groups (with ancestors), assigned tags, presets, and the groups (with ancestors) and tags referenced by their own schema whitelists. It does not follow `component_whitelist` to pull in sibling components.
- **Option B: matches plus their full transitive dependencies, including sibling components.** This extends option A by following each matched component's `component_whitelist` to its sibling components, then collecting those siblings' dependencies too, recursively. It is the behavior `push --filter` had before this change. Rejected: `component_whitelist` is name-based and self-heals, so siblings are not required for a valid push, and following it silently expands a selection outward until it can reach most of the space, which defeats the point of a team syncing only the components it owns.
- **Option C: literal matches only, no dependencies.** Only the matched components, with no groups, tags, or presets. Rejected: group and tag references are ID-based and cannot self-heal, so a cross-space push of a component without its group and tag records leaves those references dangling, and a nested group whose ancestors are absent is rejected by the backend with a 422.

## Decision

### Dependency semantics

A selected set of components includes:

- The matched components themselves.
- Their assigned groups, including all ancestor groups up to the root.
- Their assigned tags.
- Their presets.
- The groups (with ancestors) and tags referenced by their own schema whitelists.

Sibling components referenced through a `component_whitelist` field are not pulled or pushed as part of the selection.

Rationale: group and tag references are ID-based. The target space assigns its own IDs, so a cross-space push must remap the referenced group or tag ID, which requires the group or tag record to be present in the pushed payload. The backend also rejects a component whose group has a `parent_id` pointing at a group that does not exist in the target space with a 422, so ancestor groups must travel with their descendants. `component_whitelist`, by contrast, is name-based: it needs no ID remapping, and if the referenced component is missing in the target space at push time, the whitelist entry simply does not match anything until that component is pushed too. Excluding sibling components from selection keeps a selective pull or push focused on the components a team actually owns, instead of silently pulling in every other component reachable through whitelists.

### Client-side filtering over server-side query parameters

Selectors filter the full fetched or loaded component set in memory, rather than requesting a pre-filtered set from the API through `in_group` or `with_tags` query parameters. The dependency collector needs to see the complete component, group, and tag data to trace which groups, tags, and ancestors a matched component depends on. Filtering server-side would return only the matched components and leave the collector without the data it needs to resolve dependencies correctly.

## Consequences

- `pull` and `push` selectors are symmetric: the same `--filter`, `--group`, and `--tag` flags mean the same thing on both commands.
- `push --filter` no longer expands to include sibling components referenced via `component_whitelist`; previously matched components pulled in their whitelisted siblings implicitly, and that behavior is now scoped to the option A dependency set.
- A cross-space push of a selected slice can leave harmless dangling `component_whitelist` names that reference components not yet present in the target space. These self-heal once the referenced components are pushed, since the whitelist match is name-based and requires no remapping.
- Pull and push always fetch or load the full component, group, and tag data before filtering, so selective sync does not reduce the amount of data read from disk or from the API; it only reduces what gets written or uploaded.
- The single-component `push <componentName>` path also no longer carries whitelisted sibling components through `component_whitelist`, for the same option A rationale: name-based references self-heal once the referenced component is pushed.
