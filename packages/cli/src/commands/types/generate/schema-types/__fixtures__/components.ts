/**
 * Component payloads shared by the fixture-drift test and the type-level test.
 * Chosen to cover every type-level rule the design depends on: a required
 * field, a whitelisted `bloks` field, a self-referencing `bloks` field, a
 * root/non-nestable block, and a `tab` field.
 */
export const FIXTURE_COMPONENTS = [
  {
    id: 1,
    name: 'hero',
    created_at: '',
    updated_at: '',
    is_root: false,
    is_nestable: true,
    schema: {
      headline: { type: 'text', required: true, pos: 0 },
      image: { type: 'asset', pos: 1 },
      nested: { type: 'bloks', component_whitelist: ['grid'], pos: 2 },
      general: { type: 'tab', pos: 3 },
    },
  },
  {
    id: 2,
    name: 'grid',
    created_at: '',
    updated_at: '',
    is_root: false,
    is_nestable: true,
    schema: { columns: { type: 'bloks', pos: 0 } },
  },
  {
    id: 3,
    name: 'page',
    created_at: '',
    updated_at: '',
    is_root: true,
    is_nestable: false,
    schema: { body: { type: 'bloks', pos: 0 } },
  },
];
