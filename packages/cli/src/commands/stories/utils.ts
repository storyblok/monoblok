import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { Component } from '@storyblok/management-api-client/resources/components';
import type { Story } from '@storyblok/management-api-client/resources/stories';

/**
 * @method isStoryPublishedWithoutChanges
 * @param  {object} story
 * @return {boolean}
 */
export const isStoryPublishedWithoutChanges = (story: Partial<Story>) => {
  return story.published && !story.unpublished_changes;
};

/**
 * @method isStoryWithUnpublishedChanges
 * @param  {object} story
 * @return {boolean}
 */
export const isStoryWithUnpublishedChanges = (story: Partial<Story>) => {
  return story.published && story.unpublished_changes;
};

const toComponent = (maybeComponent: { component_group_uuid?: string | null }) => {
  if (maybeComponent.component_group_uuid === undefined) {
    return null;
  }
  return maybeComponent as unknown as Component;
};

export const findComponentSchemas = async (directoryPath: string) => {
  const files = await readdir(directoryPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  });

  const fileContents = files
    .filter(f => path.extname(f) === '.json')
    .map((f) => {
      const filePath = path.join(directoryPath, f);
      const fileContent = readFileSync(filePath, 'utf-8');
      return JSON.parse(fileContent);
    });

  const components: Component[] = [];
  for (const content of fileContents) {
    // Maybe single file with all components:
    if (Array.isArray(content)) {
      for (const maybeComponent of content) {
        const component = toComponent(maybeComponent);
        if (component) {
          components.push(component);
        }
      }
      continue;
    }

    // Maybe component file:
    const component = toComponent(content);
    if (component) {
      components.push(component);
    }
  }

  const schemas: Record<Component['name'], Component['schema']> = {};
  for (const component of components) {
    schemas[component.name] = component.schema;
  }
  return schemas;
};
