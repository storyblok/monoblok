import type { StandardSchemaV1 } from '@standard-schema/spec';
import { defineFieldPlugin } from '../helpers/define-field-plugin';
import { isRecord } from '../utils/is-record';

/** Value stored by Storyblok's official Colorpicker field plugin. */
export interface StoryblokColorFieldValue {
  color: string;
}

/**
 * Hand-written [Standard Schema](https://standardschema.dev) validator for
 * {@link StoryblokColorFieldValue}. Implemented directly (no external validator)
 * so the package stays validator-agnostic and adds no runtime dependency.
 */
const storyblokColorFieldValue: StandardSchemaV1<StoryblokColorFieldValue> = {
  '~standard': {
    version: 1,
    vendor: 'storyblok-schema',
    validate(value) {
      if (isRecord(value) && typeof value.color === 'string') {
        return { value: { color: value.color } };
      }
      return { issues: [{ message: 'Expected a string `color` property.', path: ['color'] }] };
    },
  },
};

/**
 * Official Storyblok Colorpicker field plugin (`storyblok-colorpicker`).
 * Register it in a schema's `fieldPlugins` to type matching custom fields.
 */
export const storyblokColorField = defineFieldPlugin({
  fieldType: 'storyblok-colorpicker',
  value: storyblokColorFieldValue,
});
