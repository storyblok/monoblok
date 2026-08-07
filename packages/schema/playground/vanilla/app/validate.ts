import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
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

// ── 4. validateStory — custom field plugins ──────────────────────────────────
//
// `hero.accent_color` is a `custom` field whose `field_type` matches the
// registered `storyblokColorField` plugin. `validateStory` runs the plugin's
// Standard Schema validator against the value, so a malformed color is caught
// here — not at push time or in the browser.

const validColor = validateStory({
  content: {
    component: 'page',
    title: 'Colors',
    body: [{ component: 'hero', headline: 'Welcome', accent_color: { plugin: 'storyblok-colorpicker', color: '#0ea5e9' } }],
  },
}, schema);
console.log(`valid color ok: ${validColor.ok}`); // true

const badColor = validateStory({
  content: {
    component: 'page',
    title: 'Colors',
    // `color` must be a string → the plugin validator flags it as invalid_value.
    body: [{ component: 'hero', headline: 'Welcome', accent_color: { plugin: 'storyblok-colorpicker', color: 12345 } }],
  },
}, schema);
console.log(`bad color ok: ${badColor.ok}`); // false
for (const issue of badColor.issues) {
  console.log(`${issue.severity} [${issue.code}] ${issue.path.join('.')}: ${issue.message}`);
}

// ── 5. createStoryValidator — hand the validator to a framework ──────────────
//
// `createStoryValidator` returns a Standard Schema, so any Standard-Schema-aware
// library validates stories for you — you never touch the `['~standard']`
// accessor yourself. Here it guards a Hono JSON route via
// `@hono/standard-validator`; the same object drops into a tRPC `.input()` or a
// form resolver unchanged. The validator also asserts the root `component`
// matches `pageBlock`.

const pageValidator = createStoryValidator(pageBlock, schema);

const app = new Hono();
app.post('/pages', sValidator('json', pageValidator), (c) => {
  // Reached only when the body is a valid `page` story.
  return c.json({ saved: true });
});

// Valid `page` story → handler runs → 200.
const okResponse = await app.request('/pages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: { component: 'page', title: 'Hello world' } }),
});
console.log(`POST valid story → ${okResponse.status}`); // 200

// Wrong root component → Hono rejects before the handler runs → 400.
const badResponse = await app.request('/pages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: { component: 'article', title: 'Wrong root' } }),
});
console.log(`POST invalid story → ${badResponse.status}`); // 400
