/**
 * Reverse of the push-time DSL→wire field mapping, shared by `schema init`
 * (which emits `defineField` code) and `types generate --future-schema` (which
 * emits type literals). The two need the same *semantics* but different `allow`
 * entry shapes for a group whitelist, a `defineFolder` variable ref versus a
 * folder display path, so the group resolution is supplied by the caller.
 */

/**
 * Resolves a field's `component_group_whitelist` uuids through `resolveEntry`.
 * All-or-nothing: returns `undefined` when there is nothing to resolve or any
 * uuid is unknown, so the caller keeps the raw wire form (which still
 * round-trips via the diff's uuid↔path translation) rather than emitting a
 * broken reference.
 */
export function resolveGroupWhitelistEntries<T>(
  whitelist: unknown,
  resolveEntry?: (uuid: string) => T | undefined,
): T[] | undefined {
  if (!resolveEntry || !Array.isArray(whitelist) || whitelist.length === 0) { return undefined; }
  const entries = whitelist.map(uuid => (typeof uuid === 'string' ? resolveEntry(uuid) : undefined));
  if (!entries.every((entry): entry is T => entry !== undefined)) { return undefined; }
  return entries;
}

/**
 * Renames the wire reference keys back to their DSL form
 * (`component_whitelist`→`allow`, `component_group_whitelist`→`allow` with
 * caller-resolved entries, `datasource_slug`→`datasource`). The `source`
 * selector is left untouched.
 *
 * `restrict_components: true` and `restrict_type` are dropped alongside a
 * resolved `allow`, they're the wire byproduct `defineField`'s `allow`
 * re-derives on push, not independent DSL state. A group whitelist that cannot
 * be fully resolved keeps its raw wire form.
 *
 * A field restricted to a component *group* carries both a
 * `component_group_whitelist` and an empty `component_whitelist: []` on the
 * wire; the group whitelist takes precedence, so `allow` is only sourced from
 * `component_whitelist` when it holds actual block names.
 *
 * `restrict_components: false` disables the restriction while the space may still
 * store a stale whitelist. Emitting that inactive list as `allow` would make
 * `schema push` re-derive `restrict_components: true` and silently switch the
 * restriction back on, changing what editors may insert. So a disabled
 * restriction keeps its flag and drops the whitelist: the flag round-trips
 * losslessly, at the cost of discarding a list that is not in force anyway. An
 * absent `restrict_components` counts as active, matching backend enforcement.
 */
export function toDslField<T>(
  field: Record<string, unknown>,
  resolveGroupEntry?: (uuid: string) => T | undefined,
): Record<string, unknown> {
  const {
    component_whitelist,
    component_group_whitelist,
    datasource_slug,
    restrict_components,
    restrict_type,
    ...rest
  } = field;
  const out: Record<string, unknown> = { ...rest };
  const restrictionDisabled = restrict_components === false;
  const groupEntries = restrictionDisabled
    ? undefined
    : resolveGroupWhitelistEntries(component_group_whitelist, resolveGroupEntry);
  const hasBlockNames = !restrictionDisabled
    && Array.isArray(component_whitelist) && component_whitelist.length > 0;
  if (restrictionDisabled) {
    out.restrict_components = false;
    if (restrict_type !== undefined) { out.restrict_type = restrict_type; }
  }
  else if (hasBlockNames) {
    out.allow = component_whitelist;
  }
  else if (groupEntries) {
    out.allow = groupEntries;
  }
  else if (component_group_whitelist !== undefined) {
    out.component_group_whitelist = component_group_whitelist;
    if (restrict_components !== undefined) { out.restrict_components = restrict_components; }
    if (restrict_type !== undefined) { out.restrict_type = restrict_type; }
  }
  if (datasource_slug !== undefined) { out.datasource = datasource_slug; }
  return out;
}
