import type { Story } from '@storyblok/management-api-client/resources/stories';

interface ComponentToUpdate {
  field: string;
  name: string;
}

interface Change {
  component: string;
  field: string;
  path: string;
}

function traverseObject(
  obj: Record<string, unknown>,
  componentsToUpdate: ComponentToUpdate[],
  oldValue: string,
  newValue: string,
  changes: Change[],
  path: string,
): Record<string, unknown> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  const result = { ...obj };
  const componentName = obj.component as string | undefined;

  if (componentName) {
    for (const { field, name } of componentsToUpdate) {
      if (name !== componentName) {
        continue;
      }

      const fieldValue = result[field];

      if (typeof fieldValue === 'string' && fieldValue === oldValue) {
        result[field] = newValue;
        changes.push({
          component: componentName,
          field,
          path: `${path}.${field}`,
        });
      }
      else if (Array.isArray(fieldValue)) {
        const newArray = fieldValue.map((item) => {
          if (item === oldValue) {
            changes.push({
              component: componentName,
              field,
              path: `${path}.${field}[]`,
            });
            return newValue;
          }
          return item;
        });
        result[field] = newArray;
      }
    }
  }

  // Traverse nested arrays (bloks fields)
  for (const [key, value] of Object.entries(result)) {
    if (Array.isArray(value)) {
      result[key] = value.map((item, index) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return traverseObject(
            item as Record<string, unknown>,
            componentsToUpdate,
            oldValue,
            newValue,
            changes,
            `${path}.${key}[${index}]`,
          );
        }
        return item;
      });
    }
  }

  return result;
}

export function renameDataSourceValue(
  story: Story,
  componentsToUpdate: ComponentToUpdate[],
  oldValue: string,
  newValue: string,
): { story: Story; changes: Change[] } {
  const changes: Change[] = [];

  const newContent = traverseObject(
    story.content as Record<string, unknown>,
    componentsToUpdate,
    oldValue,
    newValue,
    changes,
    'content',
  );

  return {
    // traverseObject returns Record<string,unknown>; runtime shape satisfies Blok
    story: { ...story, content: newContent as unknown as Story['content'] },
    changes,
  };
}
