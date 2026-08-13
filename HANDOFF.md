# `defineField` field typing: no excess-property checks, no `allow`/raw-key exclusivity

**Do this second.** The sibling worktree `fix/schema-deny-leaks-to-wire` must land first — it
decides whether `deny` reaches the wire, which determines whether the raw deny keys belong on the
deprecated branch of the union defined below.

## Two defects

### 1. No excess-property checking

`defineField` accepts _any_ key. Typos and keys meaningless for the field type compile clean, get
pushed to the Management API verbatim, and silently do nothing.

```ts
defineField("x", { type: "bloks", component_group_whitlist: ["a"] }); // typo → silently ignored
defineField("x", { type: "text", component_group_whitelist: ["x"] }); // meaningless on text
defineField("x", { type: "text", allow: ["teaser"] }); // meaningless on text
defineField("x", { type: "asset", restrict_components: true }); // meaningless on asset
defineField("x", { type: "bloks", totally_bogus_key: 123 }); // anything goes
```

Root cause — `packages/schema/src/helpers/define-field.ts:110-113`:

```ts
export function defineField<const TName extends string, const TField extends FieldInput>(
  name: TName,
  field: TField,
): DefinedField<TName, TField>;
```

The literal is _inferred as_ `TField`, so the only check is plain assignability to the constraint,
which ignores extra properties. EPC only fires against a **concrete** target. The `Field` union is
modelled correctly — `const a: Field = { type: "bloks", typo_key: 1 }` errors as it should. Only the
generic signature loses the check. `defineBlock` is the contrast case: its parameter is the concrete
`BlockInput<…>` (`define-block.ts:71-79`), and EPC works there.

Still checked today: known keys owned by the _matched_ member get value types validated
(`{ type: "bloks", component_group_whitelist: "nope" }` errors). The same key on `type: "text"` does
not, because `TextFieldRoot` doesn't own it.

### 2. `allow` and the raw wire keys are silently both-legal

`mapFieldToWire` spreads `...rest` and _then_ assigns from `allow`
(`cli/src/commands/schema/map-to-wire.ts:22-42`), so a hand-written `component_whitelist` is
silently overwritten when `allow` is also set. Setting both is always a mistake and must become a
type error.

## Target type shape

`allow`/`deny` **XOR** the raw wire keys, as a discriminated union. `@deprecated` goes on the raw
branch — used here as a signposting mechanism ("this works, but `allow` is the intended way"), not
as removal intent. Strikethrough alone is not enough, hence the union: it makes the conflict a hard
error.

Buckets, and the reasoning behind each:

| Keys                                                | Branch   | `@deprecated`?                                                                                                                                         |
| --------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `component_whitelist`, `component_group_whitelist`  | raw      | **Yes** — `allow` fully replaces both                                                                                                                  |
| `component_denylist`, `component_group_denylist`    | raw      | **Yes, conditional** — only once `deny` actually wires up (sibling worktree); `component_group_denylist` only if `deny` accepts folder refs, see below |
| `component_tag_whitelist`, `component_tag_denylist` | **both** | **No** — no DSL replacement exists                                                                                                                     |
| `restrict_components`                               | raw      | **Yes** — see below                                                                                                                                    |
| `restrict_type`                                     | **both** | **No** — `'tags'` is unreachable via `allow`, see below                                                                                                |

### Why `restrict_components` _is_ deprecated

An earlier draft kept this undeprecated on the grounds that `restrict_components: false` has no
`allow` equivalent. That reasoning was wrong: authors never need `false`.

- Omitting `allow` is _already_ the unrestricted state. The backend returns no violations when both
  lists are blank (`../storyrails/app/models/concerns/validates_component_restrictions.rb:78`:
  `return [] if whitelist.blank? && denylist.blank?`), and a field with no `allow` emits neither a
  whitelist nor the flag.
- The flag's only real purpose is representing a legacy space that stored a whitelist with the
  restriction switched off. `schema init` emits it for that case — and **drops the stale whitelist**
  while doing so (`cli/src/commands/schema/init/generate-code.ts:262-268, 289-293`).
- Because the whitelist is dropped, deleting the deprecated line leaves "no whitelist, no flag",
  which is behaviourally identical. **The remediation is simply to delete the line.**

So `schema init` output for adopted legacy spaces will show a strikethrough on this flag. That is
intentional and desirable — it flags legacy state and the fix is a one-line deletion. Do not
special-case it away.

### Why `restrict_type` is not deprecated (this corrects an earlier assumption)

`restrict_type` is not a redundant byproduct — it is the **mode selector**. Verified in the backend:

- `app/models/concerns/validates_component_restrictions.rb:69` —
  `return [] if field_schema["restrict_type"].in?(%w[groups tags])`. Name lists
  (`component_whitelist` / `component_denylist`) are honoured **only** when `restrict_type` is
  neither `groups` nor `tags`.
- `app/models/component.rb:261` — `groups`/`tags` mark a name restriction stale.
- Valid values: `'groups'`, `'tags'`, and `''` _or_ `'components'` for name-based
  (`spec/models/story_spec.rb:3972` treats `'components'` as the explicit name-based value; our
  mapper currently emits `''`).

Consequence: `restrict_type: 'tags'` is the **only** way to activate `component_tag_whitelist` /
`component_tag_denylist`, and there is no `allow` sugar for tags. So `restrict_type` must stay legal
and undeprecated on both branches. Deprecating it would flag the only working tag path.

**Your call to make:** whether to add tag sugar (e.g. `allow: [defineTag(...)]`) so the tag keys and
`restrict_type: 'tags'` could eventually join the deprecated branch. Out of scope here — if you skip
it, leave a note so the next person doesn't "tidy up" `restrict_type` into the deprecated bucket.

**SKIPPED, as offered.** No tag sugar was added. `restrict_type`, `component_tag_whitelist`, and
`component_tag_denylist` are declared on `FieldInput` with plain (non-`@deprecated`) doc comments
that say so explicitly, and `define-field.test-d.ts` has a test asserting that
`restrict_type: 'tags'` plus both tag lists compiles. Do not move these into the deprecated bucket
until tag sugar exists.

### RESOLVED: `deny` accepts folder refs, so both deny keys are deprecated

The sibling worktree settled this (see its `HANDOFF.md`): group denial is real, the old runtime
guard was wrong, and `deny` now takes `defineFolder` refs and maps to `component_group_denylist`. So
`component_denylist` **and** `component_group_denylist` both sit on the deprecated branch, each
pointing at `deny`.

## Verified fix for defect 1

Four candidates were probed with tsc. **Do not re-litigate A and B — empirically ruled out:**

| Candidate | Shape                                                                | Result                                                                                                    |
| --------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| A         | `field: TField & FieldInput`                                         | ❌ catches nothing                                                                                        |
| B         | `Record<Exclude<keyof TField, keyof FieldInput>, never>`             | ❌ over-rejects — `keyof` on a union yields only _common_ keys, so valid `component_whitelist` is flagged |
| C         | discriminant-aware `Exclude<keyof T, keyof MemberFor<T> \| DslKeys>` | ✅ correct, but breaks `type: 'custom'`                                                                   |
| **D**     | **C with `type: 'custom'` exempted**                                 | ✅ **correct**                                                                                            |

```ts
type DslKeys = "allow" | "deny" | "datasource" | "required" | "name";
type MemberFor<T> = T extends { type: infer K } ? Extract<Field, { type: K }> : Field;
type NoExtra<T> = T extends { type: "custom" }
  ? unknown
  : Record<Exclude<keyof T, keyof MemberFor<T> | DslKeys>, never>;

export function defineField<const TName extends string, const TField extends FieldInput>(
  name: TName,
  field: TField & NoExtra<TField>,
): DefinedField<TName, TField>;
```

The `custom` exemption is load-bearing: `map-to-wire.ts:17` documents that `type: 'custom'` plugin
extras pass through verbatim, so arbitrary plugin option keys must stay legal.

Verified accepted under D: `bloks` + `component_whitelist`; `bloks` + the full raw
`restrict_components`/`restrict_type`/`component_group_whitelist` trio; `richtext` +
`component_group_whitelist`; `allow` + `deny`; `text` + `max_length` + `required`; `custom` +
arbitrary plugin keys.

Verified rejected under D: the typo; group keys on `text`; `restrict_components` on `asset`; a bogus
key on `bloks`.

Note candidate D solves defect 1 only. Defect 2 (XOR) needs the union on top — D constrains _which_
keys are legal per field type, not which _combinations_.

## Required JSDoc on every deprecated key

A bare `@deprecated` tag gives the user a strikethrough and no idea what to do. Every tag must state
**why** it is discouraged and **what to use instead**, with a copy-pasteable example. Use these as
the baseline wording:

```ts
/**
 * @deprecated Use `allow` instead — it takes block names or `defineBlock` refs and derives
 * `restrict_components` / `restrict_type` for you. A bare `component_whitelist` without those
 * flags is ignored by the Management API, and if you set both, `allow` silently wins.
 *
 * @example
 * defineField('body', { type: 'bloks', allow: ['teaser', heroBlock] });
 */
component_whitelist?: string[];

/**
 * @deprecated Use `allow` with `defineFolder` refs instead. Folder paths are resolved to
 * component group uuids at push time, and the restrict flags are derived for you.
 *
 * @example
 * const heros = defineFolder({ name: 'Heros', parent: layout });
 * defineField('body', { type: 'bloks', allow: [heros] });
 */
component_group_whitelist?: string[];

/**
 * @deprecated Use `deny` instead — it takes block names or `defineBlock` refs, narrows the
 * field's content type, and derives the wire flags for you.
 *
 * @example
 * defineField('body', { type: 'bloks', deny: ['banner'] });
 */
component_denylist?: string[];

/**
 * @deprecated Derived from `allow` / `deny` — you should not set it by hand.
 *
 * To leave a field unrestricted, omit `allow` entirely rather than setting `false`: a field with
 * no whitelist is already unrestricted. This flag only exists to represent legacy spaces that
 * stored a whitelist with the restriction switched off; `schema init` drops that stale whitelist,
 * so **deleting this line is safe and behaviourally identical**.
 */
restrict_components?: boolean;
```

`component_group_denylist` gets the same treatment as `component_denylist` **iff** the sibling
worktree concludes that `deny` accepts folder refs. Otherwise it carries no tag.

Do **not** tag `component_tag_whitelist`, `component_tag_denylist`, or `restrict_type`. Instead,
give `restrict_type` a plain (non-`@deprecated`) doc comment explaining that it is the mode selector
— `'groups'` / `'tags'` / `''`|`'components'` — that `allow` derives it for the group and name-based
modes, and that `'tags'` is the one mode with no DSL sugar, which is why it stays undeprecated.

## Where the `@deprecated` tags go

**Not** in `src/generated/`. These types are generated from OpenAPI specs under
`tools/openapi-codegen/`, and `Field` is the shared **wire** type the CLI also consumes — tagging
there would penalise legitimate wire-level use and be overwritten on regeneration. Put them on the
DSL-level `FieldInput` in `define-field.ts`.

**Unverified, test first:** whether TS reliably surfaces a `@deprecated` tag from an intersection
member when the same key is also declared on the `Field` side. If it doesn't, the raw branch of the
union will need to redeclare those keys explicitly rather than inherit them from `Field`.

**VERIFIED — it does not, and the prescribed fallback was needed.** Probed with the TS language
service (`getCompletionsAtPosition` / `getSuggestionDiagnostics`) on both TS 6.0.3 and 5.8.3:

- A key declared on **both** sides of an intersection, tagged on only one, is reported as **not**
  deprecated. Declaration order makes no difference, and the same holds when the untagged
  declaration sits on a union branch instead. TS reports a property as deprecated only when _every_
  declaration of it carries the tag.
- Fix applied: `FieldInput` is built on `FieldWithoutRestrictions`, a distributive
  `Omit<…, WireRestrictionKeys>` over `Field`, so `FieldInput` is the **only** declaration site for
  the eight wire restriction keys. With that, all five deprecated keys report correctly and
  `restrict_type` / the two tag keys correctly do not.

**Second finding, affects DoD item 3.** TypeScript has no deprecation reporting for object-literal
property _writes_ at all — only for property _reads_ (`field.component_whitelist`). Confirmed
against four target shapes (plain type, intersection, discriminated union, interface) and both TS
versions, so **no** type-level design can produce an inline strikethrough on a written
`component_whitelist:` key. What the tags do deliver:

- the key shown struck through in **autocomplete**, with the JSDoc and its example in the hover card
- a strikethrough wherever the key is read
- the reason in the compile error when it conflicts with `allow` / `deny`

If an inline nudge on the written key is wanted, it needs a lint rule, not a type.

## Scope

- `packages/schema/src/helpers/define-field.ts` — signature, `FieldInput` union, `@deprecated` tags.
- `packages/schema/src/helpers/define-field.test-d.ts` — type tests for every accepted/rejected row
  above, plus the XOR cases (`allow` + `component_whitelist` must error; each branch alone must
  pass; tag keys + `restrict_type` must pass on both branches).
- Consider a `schema validate` diagnostic mirroring the XOR error for JS consumers with no
  type-checking.
- Expect fallout: the stricter signature may surface pre-existing bad keys in repo fixtures and
  `packages/cli` tests.

**Done, with these deviations:**

- The `schema validate` diagnostic was added: a `conflicting_restriction` error issue in
  `validators/validate-schema.ts`, reading the same `DERIVED_RESTRICTION_KEYS` list the type uses,
  so the two cannot drift. `schema init` never emits a conflicting combination (`toDslField`'s
  branches are mutually exclusive), so this does not fire on generated code.
- **No discriminated union was built.** The XOR is a second constraint type,
  `NoRestrictionConflict<T>`, intersected into the parameter next to candidate D's `NoExtraKeys<T>`.
  Reason: EPC only ever fires against the concrete `Record<…>` target, so a union constraint would
  have contributed nothing to defect 1 and only restated the XOR that one mapped type already
  expresses — at the cost of distributing a hand-written union over 17 field variants. `FieldInput`
  keeps `Field`'s discriminated union intact.
- Rejected keys resolve to `Invalid<TReason>`, an unsatisfiable `unique symbol`-branded type whose
  argument carries the reason into the compiler error
  (`… is not assignable to type 'Invalid<"\"component_whitelist\" is derived from \"allow\"/\"deny\": set one or the other, not both">'`).
  Behaviourally identical to the `never` in candidate D, since the rejected key set is computed the
  same way; only the message differs.
- No fallout materialised: no repo fixture or `packages/cli` test needed a change.

## Docs work (required — part of this fix, not a follow-up)

Source: `../storyblok-docs-platform/src/content/docs/docs/libraries/js/schema/index.mdx`. See
`docs/docs-platform.md` in monoblok for conventions.

The reported issue (#750) was filed _because_ the docs page never connects the DSL vocabulary to the
wire vocabulary. The reporter searched for `component_group_whitelist`, got zero hits, and concluded
the feature was missing. The code fix does not address that; these edits do.

**1. Add a short aside on the vocabulary difference.** `@storyblok/schema` deliberately renames the
wire keys, and none of the wire names appear anywhere on the page — so anyone arriving from the
Storyblok UI or the CLI cannot find the feature by searching for the name they already know. Add a
brief aside near `defineField()` mapping DSL → wire, so those terms are at least present and
searchable:

| Schema (DSL)               | Storyblok field option                                  |
| -------------------------- | ------------------------------------------------------- |
| `allow` (block names/refs) | `component_whitelist`                                   |
| `allow` (folder refs)      | `component_group_whitelist` + `restrict_type: 'groups'` |
| `deny`                     | `component_denylist`                                    |
| derived automatically      | `restrict_components`, `restrict_type`                  |

**Framing — important:** in the docs, present the raw keys as **low-level escape hatches**, not as
"deprecated". Wording along the lines of: "these lower-level field options are still accepted as an
escape hatch; prefer `allow`/`deny`, which derive the restriction flags for you." The `@deprecated`
JSDoc tag is an IDE nudge for people who already reached for the raw key; the docs should simply
point everyone at the intended API without making the escape hatches look removed or unsupported.
Note this is a deliberate departure from the existing `component_group_uuid` row (line 87), which is
labelled "_Deprecated._" — do not copy that label for the field-level keys.

**2. Add a folder example under `allow`.** The only snippet today is `allow: [heroBlock, "teaser"]`
— blocks only. Folders are mentioned in prose (line 139) with no code. Add:

```ts
const heros = defineFolder({ name: "Heros", parent: layoutFolder });
const bodyField = defineField("body", { type: "bloks", allow: [heros] });
```

Also state next to it that a single `allow` list restricts by **either** blocks **or** folders,
never both, and that mixing them throws at definition time. (Line 109 already says this in the
table, but it is easy to miss and belongs beside the example — where the constraint actually bites.)

**3. Clarify that `allow` covers `richtext`, not just `bloks`.** Line 109 currently reads "Restricts
a `bloks` field to specific blocks or folders". Verified against a real space: a folder `allow` on a
`richtext` field pushes `component_group_whitelist` + `restrict_type: 'groups'` exactly as on
`bloks`. Reword to cover both field types.

Do **not** document `deny` here — it does not reach the wire yet. That belongs to the sibling
worktree, which owns its docs section.

**Status.** The sibling's docs commit (`dc1375fe` in `storyblok-docs-platform`) landed first and
already did item 3 (the `allow` row now reads "a `bloks` or `richtext` field") and added the `deny`
row plus a first mention of the four list keys as escape hatches. Added on top, uncommitted in that
repo:

- item 1, as a DSL → wire table with a row per dimension for both `allow` and `deny`, framed as
  escape hatches rather than "deprecated", and naming `component_tag_whitelist` /
  `component_tag_denylist` / `restrict_type: 'tags'` as the one dimension with no DSL equivalent
- item 2, the folder `allow` example, sharing a snippet with the folder `deny` example so both
  dimensions read together, with the either/or constraint restated concretely beside it
- a paragraph stating the two new compile errors: mixing the vocabularies, and an option the field's
  `type` does not support

`pnpm lint` is green in the docs repo.

## Verification

```bash
pnpm nx build @storyblok/schema && pnpm nx test @storyblok/schema && pnpm nx lint:fix @storyblok/schema
pnpm nx run-many -t build test lint   # the CLI consumes these types
```

## Definition of done

1. Unknown/typo keys are a compile error (per-field-type, `custom` exempted).
2. `allow` together with any raw whitelist key is a compile error; each branch alone compiles.
3. Raw branch carries `@deprecated` pointing at `allow`/`deny`, each tag stating why and what to use
   instead per the JSDoc section above; tag keys and `restrict_type` carry **no** tag.
4. `restrict_components: false` and `restrict_type: 'tags'` + tag lists still compile (deprecated
   but legal, in the first case).
5. `type: 'custom'` plugin extras still compile.
6. Type-level tests cover all of the above; full repo build/test/lint green.
7. Docs updated per the Docs work section: vocabulary aside (framed as escape hatches, **not**
   deprecated), folder example with the either/or constraint, and `richtext` clarified.

## Context

Found while answering https://github.com/storyblok/monoblok/issues/750 — itself invalid, since group
whitelists _are_ supported via `allow`.
