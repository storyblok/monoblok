import { describe, expect, it } from 'vitest';

import { FIXTURE_COMPONENTS } from './__fixtures__/components';
import { renderSchemaTypes } from './render';
import { serializeBlockDefinition } from './serialize';

/**
 * The committed fixture is what `emitted-types.test-d.ts` typechecks. If the
 * renderer changes, this test fails and the fixture must be regenerated (`-u`),
 * which re-runs the type-level assertions against the new output. Without this
 * test the fixture could silently rot into a file the CLI no longer produces.
 */
describe('emitted type fixture', () => {
  it('matches what the renderer currently produces', async () => {
    const blocks = FIXTURE_COMPONENTS.map(component =>
      serializeBlockDefinition(component as never, { displayPathByUuid: new Map() }));

    const rendered = renderSchemaTypes({ blocks, fieldPlugins: { kind: 'none' }, space: '295018' });

    await expect(rendered).toMatchFileSnapshot('./__fixtures__/expected-types.d.ts');
  });

  /**
   * Same components, but with `__fixtures__/plugins.ts` registered as the
   * `colorpicker` field plugin. `emitted-types.test-d.ts` typechecks this
   * fixture to prove `custom` fields resolve through `Story`/`StoryMapi`, not
   * just through `Block<TName>`, see the "emitted `Story`" describe block.
   */
  it('matches what the renderer produces with field plugins registered', async () => {
    const blocks = FIXTURE_COMPONENTS.map(component =>
      serializeBlockDefinition(component as never, { displayPathByUuid: new Map() }));

    const rendered = renderSchemaTypes({
      blocks,
      fieldPlugins: { kind: 'record', modulePath: '/abs/plugins.ts', fieldTypes: ['colorpicker'] },
      fieldPluginsImportPath: './plugins',
      space: '295018',
    });

    await expect(rendered).toMatchFileSnapshot('./__fixtures__/expected-types-with-plugins.d.ts');
  });
});
