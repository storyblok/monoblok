import type { Component } from '../components/constants';
import type { Story } from './constants';
import { loadComponents } from '../components/loader';

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

export const findComponentSchemas = async (directoryPath: string) => {
  try {
    const { components } = await loadComponents(directoryPath);
    const schemas: Record<Component['name'], Component['schema']> = {};
    for (const component of components) {
      schemas[component.name] = component.schema;
    }
    return schemas;
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw error;
  }
};

/**
 * @method getStoryFilename
 * @param  {object} story - Story object with slug and uuid
 * @return {string} Filename in the format {slug}_{uuid}.json
 */
export const getStoryFilename = (story: Pick<Story, 'slug' | 'uuid'>) => {
  return `${story.slug}_${story.uuid}.json`;
};
