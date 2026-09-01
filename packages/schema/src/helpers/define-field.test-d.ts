import { describe, expectTypeOf, it } from "vitest";
import type { FieldValue } from "../generated/types/field";
import { defineBlock } from "./define-block";
import { type CheckedField, defineField, type FieldInput } from "./define-field";
import { defineFolder } from "./define-folder";

describe("defineField type inference", () => {
  it("should narrow type based on field type discriminant", () => {
    const f = defineField("title", { type: "text", max_length: 100 });
    expectTypeOf(f.type).toEqualTypeOf<"text">();
    expectTypeOf(f.name).toEqualTypeOf<"title">();
    // const generic preserves the literal value 100, not the widened number | undefined
    expectTypeOf(f.max_length).toEqualTypeOf<100>();
  });

  it("should not include config keys from other field types", () => {
    const f = defineField("title", { type: "text", max_length: 100 });
    // @ts-expect-error 'options' is not a valid key for 'text' fields
    void f.options;
  });

  it("should narrow option field type correctly", () => {
    const f = defineField("toggle", {
      type: "option",
      options: [{ name: "Yes", value: "yes" }],
    });
    expectTypeOf(f.type).toEqualTypeOf<"option">();
  });

  it("should narrow number field type correctly", () => {
    const f = defineField("count", { type: "number", min_value: 0, max_value: 100 });
    expectTypeOf(f.type).toEqualTypeOf<"number">();
    // const generic preserves the literal value 0, not the widened number | undefined
    expectTypeOf(f.min_value).toEqualTypeOf<0>();
  });

  it("should normalize a string `allow` list to a literal tuple on bloks fields", () => {
    const f = defineField("body", { type: "bloks", allow: ["teaser", "hero"] });
    expectTypeOf(f.type).toEqualTypeOf<"bloks">();
    type Allow = (typeof f)["allow"];
    expectTypeOf<Allow[number]>().toEqualTypeOf<"teaser" | "hero">();
  });

  it("should normalize block-object refs in `allow` to their name literals", () => {
    const heroBlock = { name: "hero" as const };
    const teaserBlock = { name: "teaser" as const };
    const _f = defineField("body", { type: "bloks", allow: [heroBlock, teaserBlock, "intro"] });
    type Allow = (typeof _f)["allow"];
    expectTypeOf<Allow[number]>().toEqualTypeOf<"hero" | "teaser" | "intro">();
  });

  it("should normalize a `datasource` ref to its slug literal", () => {
    const colors = { slug: "colors" as const };
    const _f = defineField("theme", { type: "option", source: "internal", datasource: colors });
    expectTypeOf<(typeof _f)["datasource"]>().toEqualTypeOf<"colors">();
  });

  it("should normalize folder allow entries to { folder: path } literals", () => {
    const heros = defineFolder({ name: "Heros" });
    const field = defineField("body", { type: "bloks", allow: [heros] });
    expectTypeOf(field.allow).toEqualTypeOf<readonly [{ folder: "Heros" }]>();
  });

  it("should narrow bloks content by folder allow entries, including nested folders", () => {
    const layout = defineFolder({ name: "Layout" });
    const heros = defineFolder({ name: "Heros", parent: layout });
    const _heroBlock = defineBlock({ name: "hero", folder: heros, fields: [] });
    const _teaserBlock = defineBlock({ name: "teaser", fields: [] });
    const _pageBlock = defineBlock({
      name: "page",
      is_root: true,
      fields: [defineField("body", { type: "bloks", allow: [layout] })],
    });
    type Body = FieldValue<
      (typeof _pageBlock)["fields"][0],
      typeof _heroBlock | typeof _teaserBlock
    >;
    expectTypeOf<Body[number]["component"]>().toEqualTypeOf<"hero">();
  });

  it("should narrow by folder allow entries case-insensitively (ref casing vs string shorthand casing)", () => {
    const blog = defineFolder({ name: "Blog" });
    // Block declares its folder as a lower-cased string shorthand; the allow ref
    // resolves to `'Blog'`. Same folder at push/editor time, so narrowing keeps it.
    const _postBlock = defineBlock({ name: "post", folder: "blog", fields: [] });
    const _teaserBlock = defineBlock({ name: "teaser", fields: [] });
    const _pageBlock = defineBlock({
      name: "page",
      is_root: true,
      fields: [defineField("body", { type: "bloks", allow: [blog] })],
    });
    type Body = FieldValue<
      (typeof _pageBlock)["fields"][0],
      typeof _postBlock | typeof _teaserBlock
    >;
    expectTypeOf<Body[number]["component"]>().toEqualTypeOf<"post">();
  });

  it("should type `default_value` per field type", () => {
    const bool = defineField("default_open", { type: "boolean", default_value: false });
    expectTypeOf(bool.default_value).toEqualTypeOf<false>();

    const text = defineField("title", { type: "text", default_value: "Hello" });
    expectTypeOf(text.default_value).toEqualTypeOf<"Hello">();

    // Numbers are stored as strings, matching what the editor writes.
    const num = defineField("count", { type: "number", default_value: "42" });
    expectTypeOf(num.default_value).toEqualTypeOf<"42">();

    // Bloks and options accept either the JSON-encoded value or the array.
    const bloks = defineField("body", { type: "bloks", default_value: [{ component: "hero" }] });
    expectTypeOf(bloks.default_value[0].component).toEqualTypeOf<"hero">();
    const options = defineField("tags", { type: "options", default_value: "a b" });
    expectTypeOf(options.default_value).toEqualTypeOf<"a b">();
  });

  it("should reject `default_value` values that do not match the field type", () => {
    // @ts-expect-error boolean fields take a boolean, not a string
    void defineField("default_open", { type: "boolean", default_value: "false" });
    // @ts-expect-error text fields take a string, not a boolean
    void defineField("title", { type: "text", default_value: false });
  });

  it("should normalize a `deny` list to a literal tuple of block names", () => {
    const heroBlock = defineBlock({ name: "hero", fields: [] });
    const f = defineField("body", { type: "bloks", deny: [heroBlock, "banner"] });
    expectTypeOf(f.deny).toEqualTypeOf<readonly ["hero", "banner"]>();
  });

  it("should narrow bloks content by `deny` alone", () => {
    const _heroBlock = defineBlock({ name: "hero", is_nestable: true, fields: [] });
    const _bannerBlock = defineBlock({ name: "banner", is_nestable: true, fields: [] });
    const _pageBlock = defineBlock({
      name: "page",
      is_root: true,
      fields: [defineField("body", { type: "bloks", deny: ["banner"] })],
    });
    type Body = FieldValue<
      (typeof _pageBlock)["fields"][0],
      typeof _heroBlock | typeof _bannerBlock
    >;
    expectTypeOf<Body[number]["component"]>().toEqualTypeOf<"hero">();
  });

  it("should compose `allow` and `deny` on the same bloks field", () => {
    const _heroBlock = defineBlock({ name: "hero", is_nestable: true, fields: [] });
    const _teaserBlock = defineBlock({ name: "teaser", is_nestable: true, fields: [] });
    const _bannerBlock = defineBlock({ name: "banner", is_nestable: true, fields: [] });
    const _pageBlock = defineBlock({
      name: "page",
      is_root: true,
      fields: [
        defineField("body", {
          type: "bloks",
          allow: ["hero", "teaser", "banner"],
          deny: ["banner"],
        }),
      ],
    });
    type Body = FieldValue<
      (typeof _pageBlock)["fields"][0],
      typeof _heroBlock | typeof _teaserBlock | typeof _bannerBlock
    >;
    expectTypeOf<Body[number]["component"]>().toEqualTypeOf<"hero" | "teaser">();
  });

  it("should remove every block named in a multi-entry `deny`", () => {
    // Regression: splitting the deny union with a distributive conditional would
    // union the per-entry `Exclude` results back together, re-admitting both.
    const _heroBlock = defineBlock({ name: "hero", is_nestable: true, fields: [] });
    const _teaserBlock = defineBlock({ name: "teaser", is_nestable: true, fields: [] });
    const _bannerBlock = defineBlock({ name: "banner", is_nestable: true, fields: [] });
    const _pageBlock = defineBlock({
      name: "page",
      is_root: true,
      fields: [defineField("body", { type: "bloks", deny: ["teaser", "banner"] })],
    });
    type Body = FieldValue<
      (typeof _pageBlock)["fields"][0],
      typeof _heroBlock | typeof _teaserBlock | typeof _bannerBlock
    >;
    expectTypeOf<Body[number]["component"]>().toEqualTypeOf<"hero">();
  });

  it("should normalize folder refs in `deny` to tagged path entries", () => {
    const heros = defineFolder({ name: "Heros" });
    const f = defineField("body", { type: "bloks", deny: [heros] });
    expectTypeOf(f.deny).toEqualTypeOf<readonly [{ folder: "Heros" }]>();
  });

  it("should narrow bloks content by folder `deny` entries, including nested folders", () => {
    const layout = defineFolder({ name: "Layout" });
    const heros = defineFolder({ name: "Heros", parent: layout });
    const _heroBlock = defineBlock({ name: "hero", folder: heros, fields: [] });
    const _teaserBlock = defineBlock({ name: "teaser", fields: [] });
    const _pageBlock = defineBlock({
      name: "page",
      is_root: true,
      fields: [defineField("body", { type: "bloks", deny: [layout] })],
    });
    type Body = FieldValue<
      (typeof _pageBlock)["fields"][0],
      typeof _heroBlock | typeof _teaserBlock
    >;
    // `hero` sits in a subfolder of the denied `Layout`, so only the unfoldered
    // `teaser` survives.
    expectTypeOf<Body[number]["component"]>().toEqualTypeOf<"teaser">();
  });

  it("should treat a folder `deny` naming no populated folder as inert", () => {
    const empty = defineFolder({ name: "Empty" });
    const _heroBlock = defineBlock({ name: "hero", is_nestable: true, fields: [] });
    const _teaserBlock = defineBlock({ name: "teaser", is_nestable: true, fields: [] });
    const _pageBlock = defineBlock({
      name: "page",
      is_root: true,
      fields: [defineField("body", { type: "bloks", deny: [empty] })],
    });
    type Body = FieldValue<
      (typeof _pageBlock)["fields"][0],
      typeof _heroBlock | typeof _teaserBlock
    >;
    expectTypeOf<Body[number]["component"]>().toEqualTypeOf<"hero" | "teaser">();
  });

  it("should leave foldered blocks alone when `deny` names only block names", () => {
    // Regression: deriving the denied folder set with `Extract<...> extends
    // { folder: infer F extends string }` resolved to `string` rather than `never`
    // for a name-only deny, because `never` takes the true branch and `F` fell back
    // to its constraint. Every block with a `folder` was then denied.
    const layout = defineFolder({ name: "Layout" });
    const _heroBlock = defineBlock({ name: "hero", folder: layout, is_nestable: true, fields: [] });
    const _bannerBlock = defineBlock({
      name: "banner",
      folder: layout,
      is_nestable: true,
      fields: [],
    });
    const _teaserBlock = defineBlock({ name: "teaser", is_nestable: true, fields: [] });
    const _pageBlock = defineBlock({
      name: "page",
      is_root: true,
      fields: [defineField("body", { type: "bloks", deny: ["banner"] })],
    });
    type Body = FieldValue<
      (typeof _pageBlock)["fields"][0],
      typeof _heroBlock | typeof _bannerBlock | typeof _teaserBlock
    >;
    // Only `banner` is denied; `hero` keeps its place despite sharing a folder.
    expectTypeOf<Body[number]["component"]>().toEqualTypeOf<"hero" | "teaser">();
  });

  it("should treat a `deny` entry naming an unknown block as inert", () => {
    const _heroBlock = defineBlock({ name: "hero", is_nestable: true, fields: [] });
    const _teaserBlock = defineBlock({ name: "teaser", is_nestable: true, fields: [] });
    const _pageBlock = defineBlock({
      name: "page",
      is_root: true,
      fields: [defineField("body", { type: "bloks", deny: ["ghost"] })],
    });
    type Body = FieldValue<
      (typeof _pageBlock)["fields"][0],
      typeof _heroBlock | typeof _teaserBlock
    >;
    expectTypeOf<Body[number]["component"]>().toEqualTypeOf<"hero" | "teaser">();
  });

  it("should not include `allow` when not provided on a bloks field", () => {
    const f = defineField("body", { type: "bloks" });
    expectTypeOf(f.type).toEqualTypeOf<"bloks">();
    // @ts-expect-error property does not exist when not supplied
    void f.allow;
  });

  it("should accept a conditional setting on any field type", () => {
    const f = defineField("subtitle", {
      type: "text",
      conditional_settings: [
        {
          modifications: [{ display: "hide" }],
          rule_match: "any",
          rule_conditions: [
            {
              validated_object: { type: "field", field_key: "headline", field_attr: "value" },
              validation: "empty",
              value: null,
            },
          ],
        },
      ],
    });
    expectTypeOf(f.conditional_settings[0].rule_match).toEqualTypeOf<"any">();
  });

  it("should accept the half-configured setting the editor writes before a rule is filled in", () => {
    // Copied verbatim from what the editor persists the moment the operator adds
    // the first rule row: `value` is absent rather than null, and the
    // modification is a bare object. Keep it byte-for-byte, or the test stops
    // pinning the shape it is named after.
    const _f = defineField("subtitle", {
      type: "text",
      conditional_settings: [
        {
          modifications: [{}],
          rule_match: "any",
          rule_conditions: [{ validated_object: null, validation: null }],
        },
      ],
    });
  });

  it("should accept the bare condition the editor appends to an existing setting", () => {
    const _f = defineField("subtitle", {
      type: "text",
      conditional_settings: [
        {
          modifications: [{}],
          rule_match: "any",
          rule_conditions: [{ validated_object: null, validation: null }, {}],
        },
      ],
    });
  });

  it("should accept the `hidden` spelling of a display modification", () => {
    // The editor writes `hide`; the server's conditional-required check reads
    // `hidden`. Both reach spaces, so both have to be expressible.
    const _f = defineField("subtitle", {
      type: "text",
      conditional_settings: [{ modifications: [{ display: "hidden" }] }],
    });
  });

  it("should reject a validation the editor cannot write", () => {
    const _f = defineField("subtitle", {
      type: "text",
      conditional_settings: [
        {
          modifications: [{ display: "hide" }],
          rule_match: "any",
          // @ts-expect-error 'contains' is not one of the six validations
          rule_conditions: [{ validation: "contains", value: null }],
        },
      ],
    });
  });
});

describe("defineField field option checking", () => {
  it("should reject a key no field type owns", () => {
    // @ts-expect-error 'totally_bogus_key' is not a field option
    void defineField("body", { type: "bloks", totally_bogus_key: 123 });
  });

  it("should reject a typo in a key the field type does own", () => {
    // Regression: this compiled clean and was pushed to the Management API
    // verbatim, where it silently did nothing.
    // @ts-expect-error 'component_group_whitlist' is a typo for 'component_group_whitelist'
    void defineField("body", { type: "bloks", component_group_whitlist: ["a"] });
  });

  it("should reject a key belonging to a different field type", () => {
    // @ts-expect-error group whitelists are meaningless on 'text'
    void defineField("title", { type: "text", component_group_whitelist: ["x"] });
    // @ts-expect-error component restrictions are meaningless on 'asset'
    void defineField("hero", { type: "asset", restrict_components: true });
    // @ts-expect-error 'max_length' is a text option, not a bloks one
    void defineField("body", { type: "bloks", max_length: 10 });
  });

  it("should accept the DSL keys on every field type", () => {
    void defineField("title", { type: "text", max_length: 10, required: true });
    void defineField("theme", { type: "option", source: "internal", datasource: "colors" });
    // `required` is not declared on the layout-only variants, but the DSL takes it
    void defineField("divider", { type: "section", required: false });
  });

  it("should accept arbitrary plugin option keys on `custom` fields", () => {
    // `type: 'custom'` extras pass through to the Management API verbatim, so
    // there is no known-key set to check against.
    void defineField("map", {
      type: "custom",
      field_type: "my-plugin",
      whatever_the_plugin_needs: 123,
      nested: { deeply: true },
    });
  });

  it("should accept the wire restriction keys on the field types that own them", () => {
    void defineField("body", { type: "bloks", component_whitelist: ["teaser"] });
    void defineField("body", {
      type: "bloks",
      component_whitelist: ["teaser"],
      component_group_whitelist: ["Heros"],
      component_denylist: ["banner"],
      component_group_denylist: ["Legacy"],
      restrict_components: true,
      restrict_type: "",
    });
    void defineField("body", { type: "richtext", component_group_whitelist: ["Heros"] });
    // A multilink `component_whitelist` selects linkable story content types
    void defineField("link", { type: "multilink", component_whitelist: ["page"] });
  });

  it("should keep `restrict_components: false` legal", () => {
    // Deprecated, but it is how `schema init` represents a legacy space that
    // stored a whitelist with the restriction switched off.
    void defineField("body", { type: "bloks", restrict_components: false });
  });

  it("should keep the tag restriction dimension legal", () => {
    // `restrict_type: 'tags'` is the only way to activate the tag lists, and has
    // no `allow` / `deny` equivalent.
    void defineField("body", {
      type: "bloks",
      restrict_type: "tags",
      component_tag_whitelist: [1, 2],
      component_tag_denylist: [3],
    });
  });

  it("should reject tag lists on a field type that does not own them", () => {
    // @ts-expect-error tag lists are meaningless on 'text'
    void defineField("title", { type: "text", component_tag_whitelist: [1] });
  });

  // Regression: `FieldInput` grafted every wire restriction key onto every
  // variant while the option check runs against the matched `Field` variant, so
  // `FieldInput`'s own `text` member failed that check and `defineField`
  // rejected its own documented input type. The old suite only ever passed fresh
  // object literals, which are checked against the matched variant directly and
  // never go through `FieldInput` at all, so nothing exercised the exported type.
  //
  // `FieldInput` is now assembled one variant at a time, so a regression can hit
  // a single variant. Every one is asserted.
  // The annotation on the const is what makes this bite: `defineField` sees a
  // value whose declared type is `FieldInput` itself, so the check runs against
  // the exported union rather than against a fresh literal. Passing the same
  // value through a `(f: FieldInput) => ...` parameter does *not* reproduce the
  // failure, so do not "simplify" these into a helper.
  it("should accept a value typed as the exported `FieldInput`", () => {
    const text: FieldInput = { type: "text", max_length: 10 };
    void defineField("f", text);
    const textarea: FieldInput = { type: "textarea", max_length: 10 };
    void defineField("f", textarea);
    const richtext: FieldInput = { type: "richtext", component_whitelist: ["teaser"] };
    void defineField("f", richtext);
    const markdown: FieldInput = { type: "markdown", rich_markdown: true };
    void defineField("f", markdown);
    const number: FieldInput = { type: "number", decimals: 2 };
    void defineField("f", number);
    const datetime: FieldInput = { type: "datetime", disable_time: true };
    void defineField("f", datetime);
    const boolean: FieldInput = { type: "boolean", inline_label: true };
    void defineField("f", boolean);
    const option: FieldInput = { type: "option", exclude_empty_option: true };
    void defineField("f", option);
    const options: FieldInput = { type: "options", is_reference_type: true };
    void defineField("f", options);
    const asset: FieldInput = { type: "asset", allow_external_url: true };
    void defineField("f", asset);
    const multiasset: FieldInput = { type: "multiasset", maximum_entries: 3 };
    void defineField("f", multiasset);
    const image: FieldInput = { type: "image", image_crop: true };
    void defineField("f", image);
    const file: FieldInput = { type: "file", add_https: true };
    void defineField("f", file);
    const multilink: FieldInput = { type: "multilink", component_whitelist: ["page"] };
    void defineField("f", multilink);
    const bloks: FieldInput = { type: "bloks", component_whitelist: ["teaser"] };
    void defineField("f", bloks);
    const table: FieldInput = { type: "table", required: true };
    void defineField("f", table);
    const section: FieldInput = { type: "section", keys: ["a"] };
    void defineField("f", section);
    const tab: FieldInput = { type: "tab", keys: ["a"] };
    void defineField("f", tab);
    const link: FieldInput = { type: "link", default_value: "//example.com" };
    void defineField("f", link);
    const group: FieldInput = { type: "group", display_name: "Group" };
    void defineField("f", group);
    const commerce: FieldInput = { type: "commerce", required: true };
    void defineField("f", commerce);
    const custom: FieldInput = { type: "custom", field_type: "unregistered" };
    void defineField("f", custom);
  });

  it("should reject a DSL reference key on a field type with no wire key behind it", () => {
    // `allow`/`deny`/`datasource` map onto `component_whitelist`,
    // `component_denylist` and `datasource_slug`. On a variant that declares none
    // of them the key is a dead wire key, which is the defect this check exists
    // to catch, so it must not be exempted everywhere.
    // @ts-expect-error `text` has no denylist
    void defineField("f", { type: "text", deny: ["teaser"] });
    // @ts-expect-error `asset` has no whitelist
    void defineField("f", { type: "asset", allow: ["teaser"] });
    // @ts-expect-error `bloks` has no datasource
    void defineField("f", { type: "bloks", datasource: "colors" });
  });

  it("should accept each DSL reference key on the variants that own its wire key", () => {
    void defineField("f", { type: "bloks", deny: ["banner"] });
    void defineField("f", { type: "richtext", deny: ["banner"] });
    // `multilink` uses `component_whitelist` for story content types, so `allow`
    // is real there even though there is no denylist to pair it with.
    void defineField("f", { type: "multilink", allow: ["page"] });
    void defineField("f", { type: "option", source: "internal", datasource: "colors" });
    void defineField("f", { type: "options", source: "internal", datasource: "colors" });
  });

  it("should not treat a possibly-undefined allow as conflicting with a raw wire key", () => {
    // A present-but-`undefined` `allow` derives nothing at runtime, so the raw
    // key it would otherwise overwrite is not in conflict with it.
    const maybeAllow: string[] | undefined = undefined;
    void defineField("f", {
      type: "bloks",
      allow: maybeAllow,
      component_whitelist: ["teaser"],
    });
  });

  it("should let a wrapper forward a generic field via CheckedField", () => {
    // The checks are mapped types over the type parameter, which TypeScript
    // cannot prove an unresolved `T` satisfies, so a bare generic cannot be
    // forwarded. `CheckedField` moves the check out to the wrapper's call site.
    function wrap<const T extends FieldInput>(name: string, field: CheckedField<T>) {
      return defineField(name, field);
    }
    expectTypeOf(wrap("f", { type: "text", max_length: 10 }).type).toEqualTypeOf<"text">();
    // @ts-expect-error the check still fires, now at the wrapper's call site
    void wrap("f", { type: "text", totally_bogus_key: 1 });
  });

  // Fixture-driven guard for the overlay spec: every option the Storyblok editor
  // can write must be declared on the matching `Field` variant, or `schema init`
  // emits it verbatim into code that does not compile. Sourced from the editor's
  // per-field-type schema forms. Add a case here when the editor grows an option.
  it("should accept every option the editor writes for each field type", () => {
    // `add_https` and the crop options belong to the legacy `image`/`file`
    // types. `FieldTypeAsset` computes a protocol from `add_https`, but its only
    // consumer runs behind the `deprecated` prop that only `FieldTypeImage` and
    // `FieldTypeFile` pass, so an `asset` created in the editor stays bare.
    void defineField("picture", {
      type: "asset",
      filetypes: ["images"],
      allow_external_url: false,
      asset_folder_id: 12,
    });
    void defineField("gallery", {
      type: "multiasset",
      filetypes: ["images"],
      maximum_entries: 5,
    });
    // The legacy `image`/`file` types own the crop options. The editor no longer
    // offers them when adding a field, but existing spaces hold them and
    // `schema init` has to emit something that compiles.
    void defineField("imageold", {
      type: "image",
      add_https: true,
      image_crop: true,
      image_width: 800,
      image_height: 600,
      keep_image_size: false,
    });
    // A crop dimension is cleared by writing an empty string, not by removing
    // the key.
    void defineField("imageold", { type: "image", image_crop: true, image_width: "" });
    void defineField("fileold", { type: "file", add_https: true });
    void defineField("body", {
      type: "richtext",
      customize_toolbar: true,
      toolbar: ["bold", "italic"],
      style_options: [{ name: "Lead", value: "lead" }],
      allow_target_blank: true,
      allow_custom_attributes: true,
      link_scope: "/blog/",
      max_length: 500,
      rtl: false,
    });
    void defineField("notes", {
      type: "markdown",
      allow_multiline: true,
      customize_toolbar: true,
      rich_markdown: true,
      toolbar: ["bold"],
      max_length: 100,
      rtl: false,
    });
    void defineField("link", {
      type: "multilink",
      allow_target_blank: true,
      allow_custom_attributes: true,
      asset_link_type: true,
      email_link_type: true,
      force_link_scope: true,
      link_scope: "/blog/",
      restrict_content_types: true,
      show_anchor: true,
    });
    void defineField("count", {
      type: "number",
      decimals: 2,
      steps: 1,
      min_value: 0,
      max_value: 10,
    });
    void defineField("title", { type: "text", max_length: 10, regex: "^a", rtl: false });
    void defineField("summary", { type: "textarea", max_length: 100, rtl: false });
    void defineField("enabled", { type: "boolean", inline_label: true });
    void defineField("published", { type: "datetime", disable_time: true });
    void defineField("category", {
      type: "option",
      options: [{ _uid: "a1", name: "News", value: "news" }],
      use_uuid: true,
      exclude_empty_option: true,
    });
    void defineField("categories", {
      type: "options",
      source: "internal_stories",
      is_reference_type: true,
      exclude_empty_option: true,
    });
  });

  it("should still check the value types of known keys", () => {
    // @ts-expect-error 'component_group_whitelist' takes a list, not a string
    void defineField("body", { type: "bloks", component_group_whitelist: "nope" });
    // @ts-expect-error 'component_tag_whitelist' takes tag ids, not names
    void defineField("body", { type: "bloks", component_tag_whitelist: ["one"] });
  });
});

describe("defineField `allow`/`deny` versus the wire restriction keys", () => {
  it("should reject `allow` alongside a wire whitelist key", () => {
    // `schema push` derives the wire keys from `allow`, overwriting whatever was
    // set by hand, so setting both is always a mistake.
    // @ts-expect-error 'component_whitelist' is derived from 'allow'
    void defineField("body", { type: "bloks", allow: ["teaser"], component_whitelist: ["teaser"] });
    const heros = defineFolder({ name: "Heros" });
    void defineField("body", {
      type: "bloks",
      allow: [heros],
      // @ts-expect-error 'component_group_whitelist' is derived from 'allow'
      component_group_whitelist: ["Heros"],
    });
  });

  it("should reject `deny` alongside a wire denylist key", () => {
    // @ts-expect-error 'component_denylist' is derived from 'deny'
    void defineField("body", { type: "bloks", deny: ["banner"], component_denylist: ["banner"] });
    const legacy = defineFolder({ name: "Legacy" });
    void defineField("body", {
      type: "bloks",
      deny: [legacy],
      // @ts-expect-error 'component_group_denylist' is derived from 'deny'
      component_group_denylist: ["Legacy"],
    });
  });

  it("should reject `restrict_components` alongside either DSL key", () => {
    // @ts-expect-error 'restrict_components' is derived from 'allow'
    void defineField("body", { type: "bloks", allow: ["teaser"], restrict_components: true });
    // @ts-expect-error 'restrict_components' is derived from 'deny'
    void defineField("body", { type: "bloks", deny: ["banner"], restrict_components: false });
  });

  it("should reject mixing the two dimensions across the DSL and wire keys", () => {
    // @ts-expect-error the wire denylist is still derived from 'deny'
    void defineField("body", { type: "bloks", allow: ["teaser"], component_denylist: ["banner"] });
  });

  it("should accept either branch on its own", () => {
    void defineField("body", { type: "bloks", allow: ["teaser"], deny: ["banner"] });
    void defineField("body", {
      type: "bloks",
      component_whitelist: ["teaser"],
      component_denylist: ["banner"],
      restrict_components: true,
      restrict_type: "",
    });
  });

  it("should accept the tag keys and `restrict_type` beside the DSL keys", () => {
    // Neither has a DSL replacement, so neither is part of the exclusivity.
    void defineField("body", {
      type: "bloks",
      allow: ["teaser"],
      restrict_type: "",
      component_tag_whitelist: [1],
      component_tag_denylist: [2],
    });
  });
});
