# ADR-0015: Block Tag Identity by Name

**Status:** Accepted  
**Date:** 2026-09-14

## Context

Blocks can carry block tags, and `bloks` / `richtext` fields can restrict insertable blocks by tag
(`restrict_type: 'tags'` + `component_tag_whitelist` / `component_tag_denylist`). Both references
are stored as tag ids, which are space-local.

The schema DSL had no way to express either, so `schema init` emitted the raw ids it read
(`internal_tag_ids: ['90137558404120']`, `component_tag_whitelist: [90137558404120]`) and
`schema push` forwarded them verbatim. Pushing that schema into a second space fails outright for a
block's own tags — the Management API validates `internal_tag_ids` against the target space and
rejects ids it does not have — and fails silently for a field's tag lists, which it stores without
validating, leaving a restriction that matches nothing.

Component groups had the same problem and were solved by name-path identity in ADR-0010. Tags are
the remaining space-local reference in the DSL.

## Decision

Block tag identity is the **exact tag name**, resolved against the target space at push time.

1. **`defineBlock` takes `tags: ['<name>']`**, a transient key the CLI resolves to
   `internal_tag_ids`. Setting it beside the raw `internal_tag_ids` throws at define time.
2. **`allow` / `deny` take `{ tag: '<name>' }` entries**, beside the existing block refs and
   `defineFolder` refs. They map to `component_tag_whitelist` / `component_tag_denylist` with
   `restrict_type: 'tags'`, which the DSL now derives rather than asking authors to set by hand.
   Mixing dimensions in one list throws, as it already did for blocks and folders.
3. **Push creates missing tags.** A name the target space has no tag for is created
   (`object_type: 'component'`) before the blocks that reference it are pushed. This matches what
   `components push` and `assets push` already do.
4. **Tags are a dependency, not a diffed entity.** They have no `defineTag`, never appear in the
   diff, and `--delete` never removes them; a push reports how many it created.
5. **Raw ids stay legal** as a same-space escape hatch, in both places. A string entry is a name, a
   number an id, so the two spaces coexist in one list.

Unlike folder paths, tag names are used verbatim rather than slugified: Storyblok makes a tag name
unique per space and object type, and a tag name never doubles as a directory name, so there is no
second spelling to reconcile.

## Alternatives Considered

- **Keep raw ids and document the limitation.** Rejected: it makes a schema unpushable to any space
  but the one it was read from, which is the whole point of schema-as-code.
- **Strip tags from the push payload.** Rejected: it unblocks the 422 but makes tags unmanageable
  through the toolchain and silently clears tags the space already has.
- **A `defineTag` helper mirroring `defineFolder`.** Rejected for now: folders need one because they
  carry a parent chain and a display name distinct from their identity. A tag is a bare name, so a
  `{ tag }` entry says everything a ref would.

## Consequences

- **No rename tracking.** Renaming a tag in the schema creates a new tag and leaves the old one in
  place, the same trade-off folders and blocks make.
- **Tags a push creates are never cleaned up.** `--delete` covers components, datasources, and
  folders; an unused tag is left for the user to remove in the UI. Deleting one would remove it from
  blocks outside the schema too.
- **Dry run does not announce tag creation.** Tags are not part of the diff, so `--dry-run` shows
  the block's `tags` change without naming the tag that would be created for it.
- **Diffing is in name space.** Remote tag ids are translated to names on both sides before diffing,
  and both sides are sorted, so tag order never shows up as a change.
- **Compile-time narrowing by tag.** A field restricted to `{ tag: 'X' }` narrows its content type
  to the registry blocks that declare `tags: ['X']`, mirroring folder narrowing. A block whose tags
  are managed in the UI rather than in code is not narrowed in — the same best-effort reading
  `folder` gets.
- **Local component JSON drops name-space tag lists.** `schema push --write-components` writes the
  wire shape its consumers expect; a tag list still holding names is dropped rather than written in
  a form nothing can read, exactly as the group lists are.

## Related ADRs

- **ADR-0010** — Block folder identity by name path, the same decision for component groups.
- **ADR-0008** — Dedicated `schema` command for unified entity management.
