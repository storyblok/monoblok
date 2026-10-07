import { DENIABLE_FIELD_TYPES } from "../restrictions";
import { isRecord } from "../utils/is-record";
import { formatValue, quoteString, RawCode } from "./format";

/** Fields to strip from individual schema field entries (`pos` is implicit in array order). */
const FIELD_STRIP_KEYS = new Set(["id", "pos"]);

function stripKeys(obj: Record<string, unknown>, keys: Set<string>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([key, value]) => !keys.has(key) && value !== undefined && value !== null,
    ),
  );
}

/**
 * Resolves a field's group list uuids to `defineFolder` ref identifiers when
 * every uuid maps to a known folder var, returning the ordered {@link RawCode}
 * refs. Returns `undefined` when there is nothing to resolve or any uuid is
 * unknown, so the caller keeps the raw wire form (still round-trips via the
 * diff's uuid↔path translation) rather than emitting a broken ref.
 */
function resolveGroupRefs(
  groupList: unknown,
  folderVarByUuid?: Map<string, string>,
): RawCode[] | undefined {
  if (!folderVarByUuid || !Array.isArray(groupList) || groupList.length === 0) {
    return undefined;
  }
  const vars = groupList.map((uuid) =>
    typeof uuid === "string" ? folderVarByUuid.get(uuid) : undefined,
  );
  if (!vars.every((v): v is string => typeof v === "string")) {
    return undefined;
  }
  return vars.map((v) => new RawCode(v));
}

/**
 * Resolves a field's tag list ids to their tag names, returning the ordered
 * `{ tag: name }` entries `allow`/`deny` take. Returns `undefined` when there is
 * nothing to resolve or any id is unknown, so the caller keeps the raw wire form
 * (still valid in the space it was read from) rather than emitting a reference
 * that names no tag.
 */
export function resolveTagRefs(
  tagList: unknown,
  tagNameById?: Map<string, string>,
): TagRef[] | undefined {
  if (!tagNameById || !Array.isArray(tagList) || tagList.length === 0) {
    return undefined;
  }
  const names = tagList.map((id) =>
    typeof id === "string" || typeof id === "number" ? tagNameById.get(String(id)) : undefined,
  );
  if (!names.every((name): name is string => typeof name === "string")) {
    return undefined;
  }
  return names.map((tag) => ({ tag }));
}

/** Whether a wire restriction list holds entries (an absent or empty list is no restriction). */
function isNonEmptyList(list: unknown): boolean {
  return Array.isArray(list) && list.length > 0;
}

/**
 * How a field's wire restriction keys map back to the DSL, resolved once so
 * {@link toDslField} and {@link collectRestrictionFolderVars} can never disagree
 * about whether a field's folder refs are emitted (and therefore imported).
 *
 * - `disabled` — `restrict_components: false`: the flag round-trips, the lists do not.
 * - `tags` — restricted by block tag: the tag lists and their flags keep their wire form.
 * - `names` — restricted by block name: `allow`/`deny` hold plain names.
 * - `tagRefs` — restricted by block tag, every id resolved to its tag name.
 * - `folders` — restricted by folder, every uuid resolved to a `defineFolder` ref.
 * - `raw` — restricted by folder, but at least one uuid is unknown: keep the wire keys.
 * - `none` — no restriction in force.
 */
export type FieldRestriction =
  | { kind: "disabled" }
  | { kind: "tags" }
  | { kind: "tagRefs"; allow?: TagRef[]; deny?: TagRef[] }
  | { kind: "names"; allow?: unknown; deny?: unknown }
  | { kind: "folders"; allow?: RawCode[]; deny?: RawCode[] }
  | { kind: "raw" }
  | { kind: "none" };

/** A tag reference in the DSL form `allow`/`deny` take: `{ tag: name }`. */
export interface TagRef {
  tag: string;
}

/**
 * The field types that own the component restriction keys (`restrict_components`,
 * `restrict_type` and the group lists).
 *
 * A space can store those keys on any field type — the Management API takes a
 * component schema as an opaque blob and stores a stray `restrict_components: true`
 * on an `asset` field verbatim — but the editor only
 * reads them on these two, and `defineField` rejects an option the field type does
 * not own. Emitting such a stray key would generate code that does not compile, so
 * the restriction keys are only ever emitted for these types.
 */
const RESTRICTABLE_FIELD_TYPES = new Set(["bloks", "richtext"]);

/**
 * Classifies a field's wire restriction keys. The block-name and folder
 * dimensions are mutually exclusive in the editor, which clears one dimension's
 * lists when you switch to the other, so a field restricted by folder carries an
 * empty `component_whitelist: []` alongside its group list. Non-emptiness is
 * therefore what picks the dimension.
 *
 * When both dimensions somehow hold a list, block names win here while the editor
 * would evaluate the folder list and ignore the names. The orders disagree on
 * purpose: whichever one loses gets dropped from the emitted DSL, and dropping a
 * name list is the more visible loss. Neither reading is faithful, so the shape is
 * a round-trip hazard either way. The editor cannot author it (switching dimension
 * clears all six lists) and the Management API only backstops that for `bloks`
 * fields, so reaching it takes a `richtext` written through the API.
 *
 * A denylist is read back only where the editor reads one: on a field type that
 * has a denylist, and only while the matching allow list is empty. Anywhere else
 * the list is stored but inert, and emitting it as `deny` would generate code
 * `defineField` rejects — the push after `schema init` would then fail to load the
 * schema at all rather than for one field. A dropped denylist is not a silent loss
 * of enforcement, because it was never enforced; push replaces the whole field, so
 * the stray key is cleared from the space on the way through.
 *
 * The tag dimension needs `restrict_type: 'tags'` and a non-empty tag list. The
 * `restrict_type` check alone is not enough to claim the field, because a list the
 * editor cannot produce still has to be handled: switching dimension in the editor
 * clears all six lists, and the Management API only backstops that for `bloks`
 * fields (it strips the name lists, keeping the group ones), so on `richtext` a
 * legacy or API-written `restrict_type: 'tags'` can survive next to a live
 * `component_whitelist`. Claiming that field for the tag dimension would drop the
 * name list on the round trip.
 *
 * A `restrict_type: 'tags'` that no tag list backs still never falls through to
 * `none`: it ends up in `raw`, which keeps `restrict_type` and
 * `restrict_components` verbatim. `restrict_type: 'tags'` with both lists empty
 * still restricts by tags in the editor, and dropping the two flags would leave
 * nothing to re-derive them from, silently unrestricting the field on the next
 * push.
 *
 * Claiming the field for the tag dimension drops any group list it also holds,
 * and the editor would have read the group list instead: it evaluates groups
 * before tags, and its group arm does not gate the denylist on `restrict_type`.
 * Same round-trip hazard as the name/group tie above, in the same direction, and
 * reachable the same way, through the API rather than the editor.
 */
export function resolveFieldRestriction(
  field: Record<string, unknown>,
  folderVarByUuid?: Map<string, string>,
  tagNameById?: Map<string, string>,
): FieldRestriction {
  if (field.restrict_components === false) {
    return { kind: "disabled" };
  }
  // A denylist is only in force where the editor reads one: on a field type that
  // has one at all, and only while the matching allow list is empty. Emitting an
  // out-of-force list as `deny` would generate code `defineField` rejects, so the
  // push that follows `schema init` could not even load the schema.
  const denyIsReadable = DENIABLE_FIELD_TYPES.includes(String(field.type));
  if (
    field.restrict_type === "tags" &&
    (isNonEmptyList(field.component_tag_whitelist) || isNonEmptyList(field.component_tag_denylist))
  ) {
    const hasTagAllow = isNonEmptyList(field.component_tag_whitelist);
    const hasTagDeny =
      denyIsReadable && !hasTagAllow && isNonEmptyList(field.component_tag_denylist);
    const allow = hasTagAllow
      ? resolveTagRefs(field.component_tag_whitelist, tagNameById)
      : undefined;
    const deny = hasTagDeny ? resolveTagRefs(field.component_tag_denylist, tagNameById) : undefined;
    // Only one of the two is ever in force, and emitting nothing for a list that
    // is would drop the restriction, so an unresolvable id keeps the wire form.
    return (!hasTagAllow || allow) && (!hasTagDeny || deny)
      ? { kind: "tagRefs", allow, deny }
      : { kind: "tags" };
  }
  // On `bloks`, the Management API clears the name lists when the editor switches
  // dimension, so a `component_whitelist`/`component_denylist` surviving next to an
  // empty-tag `restrict_type: 'tags'` is stale junk from before the switch, not a live
  // restriction. Ignore it here so the field falls through to `raw`, which keeps the tag
  // flags instead of resurrecting the stale list as `allow`/`deny`. `richtext` gets no such
  // backstop from the API, so its name list is still live and is read below as usual.
  const nameListsAreStale = field.type === "bloks" && field.restrict_type === "tags";
  const hasNameAllow = !nameListsAreStale && isNonEmptyList(field.component_whitelist);
  const hasNameDeny =
    !nameListsAreStale &&
    denyIsReadable &&
    !hasNameAllow &&
    isNonEmptyList(field.component_denylist);
  if (hasNameAllow || hasNameDeny) {
    return {
      kind: "names",
      allow: hasNameAllow ? field.component_whitelist : undefined,
      deny: hasNameDeny ? field.component_denylist : undefined,
    };
  }
  const hasGroupAllow = isNonEmptyList(field.component_group_whitelist);
  const hasGroupDeny =
    denyIsReadable && !hasGroupAllow && isNonEmptyList(field.component_group_denylist);
  if (hasGroupAllow || hasGroupDeny) {
    const allow = hasGroupAllow
      ? resolveGroupRefs(field.component_group_whitelist, folderVarByUuid)
      : undefined;
    const deny = hasGroupDeny
      ? resolveGroupRefs(field.component_group_denylist, folderVarByUuid)
      : undefined;
    // Only one of the two is ever in force, and emitting nothing for a list that is
    // would drop the restriction, so an unresolvable uuid keeps the whole field raw.
    return (!hasGroupAllow || allow) && (!hasGroupDeny || deny)
      ? { kind: "folders", allow, deny }
      : { kind: "raw" };
  }
  if (
    field.restrict_type === "tags" ||
    field.component_group_whitelist !== undefined ||
    field.component_group_denylist !== undefined
  ) {
    return { kind: "raw" };
  }
  return { kind: "none" };
}

/**
 * Reverse of the push-time DSL→wire field mapping: renames the wire reference
 * keys back to their DSL form (`component_whitelist`/`component_group_whitelist`
 * → `allow`, `component_denylist`/`component_group_denylist` → `deny`, either as
 * plain block names or as `defineFolder` refs, and `datasource_slug` →
 * `datasource`). The `source` selector is left untouched.
 *
 * `restrict_components: true` and `restrict_type` are dropped alongside a
 * resolved `allow`/`deny` — they're the wire byproduct `defineField` re-derives on
 * push, not independent DSL state. Group lists that cannot be fully resolved to
 * folder refs keep their raw wire form.
 *
 * `restrict_components: false` disables the restriction while the space may still
 * store stale lists. Emitting an inactive list as `allow`/`deny` would make
 * `schema push` re-derive `restrict_components: true` and silently switch the
 * restriction back on, changing what editors may insert. So a disabled
 * restriction keeps its flag and drops the lists: the flag round-trips
 * losslessly, at the cost of discarding lists that are not in force anyway.
 *
 * An absent `restrict_components` counts as active, which is a deliberate
 * narrowing rather than a faithful read. The editor treats the flag's absence as
 * "no restriction at all", so a legacy field carrying a bare `component_whitelist`
 * accepts anything today. Emitting it as `allow` makes push re-derive
 * `restrict_components: true`, and the restriction starts being enforced. That
 * matches the list's apparent intent, and the alternative is discarding a list
 * someone wrote on purpose, but it does change what editors may insert.
 *
 * A tag restriction (`restrict_type: 'tags'` with a tag list in force) keeps its
 * wire form, flags included: the tag dimension has no `allow`/`deny` equivalent,
 * so dropping `restrict_type` would leave the tag lists inert on the next push,
 * and emitting the field's (stale, not-in-force) name or group lists as DSL refs
 * would switch it back to restricting by name.
 *
 * `restrict_components: true` with no list in force is kept too, for the same
 * reason: with no `allow`/`deny` emitted there is nothing to re-derive it from, so
 * dropping it would switch the restriction off on the next push.
 *
 * None of these flags are emitted for a field type that does not own them; see
 * {@link RESTRICTABLE_FIELD_TYPES}.
 *
 * See {@link resolveFieldRestriction} for how the block-name and folder
 * dimensions are told apart.
 */
function toDslField(
  field: Record<string, unknown>,
  folderVarByUuid?: Map<string, string>,
  tagNameById?: Map<string, string>,
): Record<string, unknown> {
  const {
    component_whitelist,
    component_denylist,
    component_group_whitelist,
    component_group_denylist,
    component_tag_whitelist,
    component_tag_denylist,
    datasource_slug,
    restrict_components,
    restrict_type,
    ...rest
  } = field;
  const out: Record<string, unknown> = { ...rest };
  const restriction = resolveFieldRestriction(field, folderVarByUuid, tagNameById);
  // Stray restriction keys on a field type that does not own them are junk the
  // editor never wrote and never reads; emitting them would not compile.
  const restrictable = RESTRICTABLE_FIELD_TYPES.has(field.type as string);

  // A tag list the DSL could not name passes through verbatim whenever the field
  // type owns it, whichever dimension is actually in force. A resolved one is
  // emitted as `allow`/`deny` refs below instead, so it must not be written twice.
  if (restrictable && restriction.kind !== "tagRefs") {
    if (component_tag_whitelist !== undefined) {
      out.component_tag_whitelist = component_tag_whitelist;
    }
    if (component_tag_denylist !== undefined) {
      out.component_tag_denylist = component_tag_denylist;
    }
  }

  switch (restriction.kind) {
    case "disabled":
      if (restrictable) {
        out.restrict_components = false;
        if (restrict_type !== undefined) {
          out.restrict_type = restrict_type;
        }
      }
      break;
    case "tags":
      if (restrictable) {
        if (restrict_components !== undefined) {
          out.restrict_components = restrict_components;
        }
        out.restrict_type = restrict_type;
      }
      break;
    case "names":
    case "folders":
    case "tagRefs":
      if (restriction.allow !== undefined) {
        out.allow = restriction.allow;
      }
      if (restriction.deny !== undefined) {
        out.deny = restriction.deny;
      }
      break;
    case "raw":
      if (restrictable) {
        if (component_group_whitelist !== undefined) {
          out.component_group_whitelist = component_group_whitelist;
        }
        if (component_group_denylist !== undefined) {
          out.component_group_denylist = component_group_denylist;
        }
        if (restrict_components !== undefined) {
          out.restrict_components = restrict_components;
        }
        if (restrict_type !== undefined) {
          out.restrict_type = restrict_type;
        }
      }
      break;
    case "none":
      // No list is in force, so there is no `allow`/`deny` here to re-derive the
      // flags from on the next push. `restrict_components: true` is still real
      // state, so it is kept along with the dimension selector it applies to. An
      // absent flag has nothing to preserve, and `false` is classified as
      // `disabled` instead.
      //
      // Two shapes land here and they lose different things. A field with the
      // restriction on and no list keys at all reads as unrestricted in the editor
      // either way, so keeping the flag costs nothing and buys a byte-identical
      // round trip, which is what makes a second push report `unchanged`. A field
      // whose only list is a tag denylist is genuinely restricted, because the
      // editor's tag arm does not gate the denylist on `restrict_type`, and
      // dropping the flag there would unrestrict it.
      if (restrictable && restrict_components === true) {
        out.restrict_components = restrict_components;
        if (restrict_type !== undefined) {
          out.restrict_type = restrict_type;
        }
      }
      break;
  }
  if (datasource_slug !== undefined) {
    out.datasource = datasource_slug;
  }
  return out;
}

/**
 * Returns a shallow copy of `obj` without keys whose value is an empty array.
 * Remote blocks/fields carry many optional list fields the space never set
 * (e.g. `internal_tag_ids: []`, an empty `component_whitelist`); emitting them
 * as `key: []` is noise in a hand-editable definition, so they are dropped.
 */
export function omitEmptyArrays(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Generates a `defineField('name', {...})` code string for a single schema field.
 * Position is implicit in the array index, so `pos` is stripped from the config.
 */
export function generateFieldCode(
  fieldName: string,
  fieldData: Record<string, unknown>,
  depth: number,
  folderVarByUuid?: Map<string, string>,
  tagNameById?: Map<string, string>,
): string {
  const clean = omitEmptyArrays(
    toDslField(stripKeys(fieldData, FIELD_STRIP_KEYS), folderVarByUuid, tagNameById),
  );
  return `defineField(${quoteString(fieldName)}, ${formatValue(clean, depth)})`;
}

/**
 * Collects the sorted, unique `defineFolder` var names a component's fields
 * reference through fully-resolvable group lists, so the generated file can
 * import them. Shares {@link resolveFieldRestriction} with {@link toDslField} so
 * only folders that actually reach the emitted `allow`/`deny` are imported.
 */
export function collectRestrictionFolderVars(
  schema: Record<string, Record<string, unknown>>,
  folderVarByUuid?: Map<string, string>,
): string[] {
  const vars = new Set<string>();
  for (const field of Object.values(schema)) {
    if (!isRecord(field)) {
      continue;
    }
    const restriction = resolveFieldRestriction(field, folderVarByUuid);
    if (restriction.kind !== "folders") {
      continue;
    }
    for (const ref of [...(restriction.allow ?? []), ...(restriction.deny ?? [])]) {
      vars.add(ref.code);
    }
  }
  return [...vars].sort();
}

/** Sorts schema fields by `pos` for stable ordering. */
export function sortSchemaByPos(
  schema: Record<string, Record<string, unknown>>,
): [string, Record<string, unknown>][] {
  return Object.entries(schema)
    .filter(([key]) => key !== "_uid" && key !== "component")
    .sort(([, a], [, b]) => {
      const posA = typeof a.pos === "number" ? a.pos : Infinity;
      const posB = typeof b.pos === "number" ? b.pos : Infinity;
      return posA - posB;
    });
}
