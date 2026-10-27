<!-- target: src/content/docs/docs/libraries/js/experiments/index.mdx#related-stories (new h2 after "Factory") -->

## Related stories

<Badge text="1.3.0" variant="success" /> _Introduced in_

A page can include other stories through `resolve_relations`, such as a call-to-action story
referenced from a page. The Content Delivery API resolves the original version of each related
story, so an experiment on a related story needs one more step: fetch the variant stories the
visitor is assigned to, and apply their content to the response.

`resolveRelations` takes the UUIDs of the related stories and returns a map of the original story
UUIDs to the UUIDs of the variant stories to render. `applyRelationVariants` returns a copy of the
response in which each of those stories carries the content of its variant story. The story keeps
its own ID, UUID, and slug.

```ts
import { applyRelationVariants, createExperiments } from "@storyblok/experiments";
import { fetchAdapter } from "@storyblok/experiments/adapters";

const exp = createExperiments({ experiments, adapters: [fetchAdapter(url)] });
const resolve_relations = "page.cta";

// This example uses @storyblok/api-client@alpha.
const { data: page } = await client.stories.get("home", { query: { resolve_relations } });

// Exposure auto-fired for each experiment on a related story.
let rels = page.rels ?? [];
const resolution = exp.resolveRelations({ uuids: rels.map((rel) => rel.uuid), visitorId });

if (resolution.variants.size > 0) {
  const { data } = await client.stories.list({
    query: { by_uuids: [...resolution.variants.values()].join(","), resolve_relations },
  });
  rels = applyRelationVariants(rels, data.stories, resolution);
}
```

The extra request only happens when the visitor is assigned to a variant of a related story. A
control visitor renders the original stories with no further request.

`applyRelationVariants` accepts any value that holds stories: the `rels` array, the whole response,
or a story whose relations the API client already inlined with `inlineRelations: true`. It never
mutates its input, because API clients can cache and share a response between visitors. A story
whose variant story is missing from the fetched stories keeps its original content, for example when
a variant story is not published.

`resolveRelations` is also available as a standalone function that fires nothing, and the factory
method accepts `exposure: false` to return the exposures without delivering them:

```ts
import { resolveRelations } from "@storyblok/experiments";

const { variants, exposures } = resolveRelations({ experiments, uuids, visitorId });
```

<Aside type="note">
  A related story inside a variant story renders its original version. `resolveRelations` resolves only the stories passed in `uuids`.
</Aside>
