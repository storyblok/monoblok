import { createStoryValidator, validateSchema, validateStory } from '@storyblok/schema';
import { pageBlock } from '../base/blocks/page';
import { schema } from '../base/schema';

// ── 1. validateSchema — check the definitions themselves ─────────────────────
//
// Catches authoring mistakes (duplicate names, `allow` entries or `datasource`
// slugs that don't resolve) before anything is pushed to a space.

const schemaResult = validateSchema(schema);
console.log(`schema ok: ${schemaResult.ok}`); // true — every ref resolves
console.log(schemaResult.issues);

// ── 2. validateStory — happy path ────────────────────────────────────────────
//
// Walks content against the schema: unknown components (error), unknown fields
// (warning), missing required fields (error), value shapes, and field
// constraints (max_length, number min/max/decimals/steps, bloks allow list, …).

const ok = validateStory({
  content: {
    component: 'page',
    title: 'Hello world',
    body: [{ component: 'hero', headline: 'Welcome' }],
  },
}, schema);
console.log(`valid story ok: ${ok.ok}`); // true

// ── 3. validateStory — surfaces problems instead of failing at push time ──────

const bad = validateStory({
  content: {
    component: 'page',
    // `title` over its 70-char max_length → constraint_violation
    title: 'x'.repeat(80),
    body: [
      // `hero.headline` is required and missing → missing_required_field
      { component: 'hero' },
      // `empty_block` is not in page.body's allow list → disallowed_component
      { component: 'empty_block' },
    ],
  },
}, schema);
console.log(`bad story ok: ${bad.ok}`); // false
for (const issue of bad.issues) {
  console.log(`${issue.severity} [${issue.code}] ${issue.path.join('.')}: ${issue.message}`);
}

// ── 4. createStoryValidator — a Standard Schema for `page` ────────────────────
//
// Composes with any Standard Schema tooling (tRPC inputs, form resolvers, …).
// Also asserts the root `component` matches the given block.

const pageValidator = createStoryValidator(pageBlock, schema);
const standardResult = pageValidator['~standard'].validate({
  content: { component: 'article', title: 'Wrong root' },
});
if (!(standardResult instanceof Promise) && standardResult.issues) {
  console.log(standardResult.issues); // root-component mismatch
}
