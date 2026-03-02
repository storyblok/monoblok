import type { Story } from '@storyblok/management-api-client/resources/stories';

import type { ComponentSchemas } from './map-refs';

const SYSTEM_FIELDS = new Set(['_uid', 'component', '_editable']);

interface RemovedField {
  component: string;
  field: string;
}

function cleanBlok(
  blok: Record<string, unknown>,
  schemaDefinition: ComponentSchemas,
  removedFields: RemovedField[],
): Record<string, unknown> {
  const componentName = blok.component as string | undefined;
  if (!componentName) {
    return blok;
  }

  const schema = schemaDefinition[componentName];
  if (!schema) {
    // Unknown component — leave untouched
    return blok;
  }

  const validFieldSet = new Set(Object.keys(schema));
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(blok)) {
    // Always keep system fields
    if (SYSTEM_FIELDS.has(key)) {
      result[key] = value;
      continue;
    }

    // Strip i18n suffix to get base field name
    const baseFieldName = key.replace(/__i18n__.*/, '');

    // Field not in schema — remove it
    if (!validFieldSet.has(baseFieldName)) {
      removedFields.push({ component: componentName, field: key });
      continue;
    }

    // Check if this is an array of bloks (objects with component property)
    const isBlokArray
      = Array.isArray(value)
        && value.some(
          item =>
            item
            && typeof item === 'object'
            && !Array.isArray(item)
            && (item as Record<string, unknown>).component,
        );

    if (isBlokArray) {
      // Traverse blok arrays and process nested bloks recursively
      result[key] = (value as unknown[]).map((item) => {
        if (
          item
          && typeof item === 'object'
          && !Array.isArray(item)
          && (item as Record<string, unknown>).component
        ) {
          return cleanBlok(
            item as Record<string, unknown>,
            schemaDefinition,
            removedFields,
          );
        }
        return item;
      });
    }
    else {
      // Valid field — keep it
      result[key] = value;
    }
  }

  return result;
}

export function deleteOutOfSchemaFields(
  story: Story,
  schemaDefinition: ComponentSchemas,
): { story: Story; removedFields: RemovedField[] } {
  const removedFields: RemovedField[] = [];

  const newContent = cleanBlok(
    story.content as Record<string, unknown>,
    schemaDefinition,
    removedFields,
  );

  return {
    // cleanBlok returns Record<string,unknown>; runtime shape satisfies Blok
    story: { ...story, content: newContent as unknown as Story['content'] },
    removedFields,
  };
}
