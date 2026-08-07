# ADR-0010: Block Folder Identity by Name Path

**Status:** Accepted  
**Date:** 2026-07-10

## Context

The schema DSL enables declaring component groups (block folders) to organize blocks in the UI. Component groups are server-generated entities with UUIDs that are space-specific; they cannot be referenced directly in code. However, editors depend on folders in the UI:

- The block picker and block library structure blocks by group.
- `bloks` and `richtext` fields can restrict insertable blocks **by group** (`restrict_type: 'groups'` + `component_group_whitelist`).

Schema-as-code therefore needs to express folder membership in a way that is:

- **Code-addressable** — developers reference folders by a stable identity without needing to know remote UUIDs.
- **Editor-compatible** — the CLI can resolve folder references to the remote component groups they represent.
- **Safe to rename** — a folder's identity should not break if its display name changes upstream.

Three identity strategies were considered:

1. **UUID-based identity** — store remote UUIDs in the repository. Rejected: UUIDs are space-specific and cannot be shared across spaces; they are server-generated and not developer-controlled.
2. **UUID-with-aliases** — map aliases in the repository to remote UUIDs. Rejected: adds state files; breaks when spaces diverge or aliases are mismanaged.
3. **Name-path-based identity** — a folder is identified by its resolved name path (e.g. `Layout/Heros`), matched case-insensitively against remote groups using slugified segments. A rename is a create + stale, exactly like component renames.

## Decision

Folder identity is the **resolved name path**, matched against the remote space at push time using slugified, case-insensitive path matching.

1. **`defineFolder` returns an importable ref** that captures the folder's display name and parent chain. The ref computes the display path eagerly (e.g. `Layout/Heros`). No UUID storage; no state files.
2. **`defineBlock` folder assignment** accepts a folder ref or a raw path string. The ref normalizes to its path string; the CLI resolves both against remote groups by slugified path matching.
3. **Restriction by folder** — `bloks` and `richtext` fields can restrict insertable blocks to a folder using folder refs. This maps to `restrict_type: 'groups'` + `component_group_whitelist` on the wire. Mixing block and folder restrictions in one `allow` is a define-time error (the editor treats restriction modes as mutually exclusive).
4. **Push follows `--delete` semantics** — stale remote folders warn by default and are deleted only with `--delete`, children-first to avoid orphaning dependencies.
5. **No rename support in v1** — display names are used only at folder creation. A matched remote group keeps its remote name; the CLI never issues group updates. A rename is accomplished by creating a new folder and marking the old one stale (identical to component renames).

## Alternatives Considered

- **Per-space UUID mapping** — store UUIDs in a state file or environment variable. Rejected: adds complexity; requires external sync; breaks multi-space workflows.
- **Directory-structure-derived identity** — use file/directory layout as folder identity. Rejected: couples schema to directory layout, limiting refactoring flexibility in the repo.
- **Rename support with display-name tracking** — allow display-name updates to propagate to remote groups. Rejected: introduces ambiguity: did the ref shorthand or the explicit `defineFolder` define the display name? Adds complexity; defer to v2 if needed.

## Consequences

- **Group names are unique per space** — Storyblok enforces `uniqueness: { scope: :space_id }` on component group names, so a leaf name is unique across the **whole space**, not just within a parent. The CLI rejects duplicate slugified leaf names across the folder set at load time (`CommandError`) rather than letting a 422 surface mid-push. Re-parenting a folder while keeping its leaf name is therefore a two-step operation: rename or delete the old folder first (push), then push the re-parented folder.
- **No rename tracking** — renaming a folder is a `create` + `stale` pair, exactly like component renames. This is documented and acceptable for v1 workflows.
- **Display names set only at creation** — the CLI creates groups with the display name from `defineFolder` or the first-seen string reference. After creation, remote display names are never updated; they are considered user-editable (not sync'd).
- **No state files** — all folder identity lives in code; nothing is stored in `.storyblok` or environment.
- **Slugified matching** — folder paths are matched against remote groups using the same case-insensitive slugification as existing component group paths. A folder `Heros` matches remote group `heros` or `HEROS`. This enables teams to adopt the schema DSL incrementally without renaming all existing groups.
- **Restriction modes are exclusive** — code cannot mix block refs and folder refs in a single field's `allow` array. The editor honors this constraint; attempting to do so throws at define time.
- **Richtext support** — folder restrictions apply to both `bloks` and `richtext` fields identically.
- **Nullable `component_group_uuid` on write bodies** — the Management API accepts `component_group_uuid: null` to clear a block's group, but the OpenAPI `ComponentCreateRequest`/`ComponentUpdateRequest` bodies declared a non-nullable `string` (the read `Component` schema was already nullable). This is corrected at the codegen layer via a hey-api parser patch (`tools/openapi-codegen/src/patches.ts`) that widens the field to `string | null` before generation, so the generated `ComponentCreate`/`ComponentUpdate` types model `null` for every consumer. The patch is a documented stopgap; the fix should also land upstream in `storyblok/openapi-wdx`.

## Implementation Notes

- **CLI materialization** — the CLI collects folders from: (a) explicit `defineFolder` registrations, (b) folder assignments on blocks, (c) `{ folder }` entries in field `allow`, and (d) all parent paths of the above. Deduplication by slugified path.
- **Push ordering** — folders are created parent-first (breadth-first by depth); components are upserted with UUID resolution applied at send time; stale entities are deleted children-first (deepest first).
- **Rollback of folder mutations** — `schema rollback` inverts folder changes alongside components and datasources: a push that created a folder is undone by deleting it (children-first, after components are restored off it), and a push that deleted a folder is undone by recreating it (parent-first). Because a recreated group receives a *new* server uuid, restored components have their stored `component_group_uuid` and field `component_group_whitelist` uuids remapped (old → new) so they land in the recreated group rather than a dangling reference.

## Related ADRs

- **ADR-0008** — Dedicated `schema` command for unified entity management (folders, components, datasources).
