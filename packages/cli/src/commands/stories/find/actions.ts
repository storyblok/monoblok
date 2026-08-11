import { JSONPath } from 'jsonpath-plus';
import type { StoriesQueryParams, Story } from '../constants';
import { parseFilterQuery } from '../filter-query';
import type { ClientFilter, FindOptions } from './types';
import {
  matchesPublishStatus,
  publishStatusToQueryParams,
} from './filters';

export function buildQueryParams(text: string | undefined, options: FindOptions): StoriesQueryParams {
  const params: StoriesQueryParams = {};

  // Text search
  if (text) {
    params.text_search = text;
  }

  // Path scope
  if (options.startsWith) {
    params.starts_with = options.startsWith;
  }

  // Filter query and container block (both contribute to filter_query)
  if (options.query || options.containerBlock) {
    params.filter_query = {
      ...options.query ? parseFilterQuery(options.query) : {},
      ...options.containerBlock ? { component: { in: options.containerBlock } } : {},
    };
  }

  // Contains block (server-side contain_component)
  if (options.containsBlock) {
    params.contain_component = options.containsBlock;
  }

  // Publish status (server-side part)
  if (options.publishStatus) {
    Object.assign(params, publishStatusToQueryParams(options.publishStatus));
  }

  // Reference search (server-side)
  if (options.referencesTo) {
    params.reference_search = options.referencesTo;
  }

  // Entry type filter
  if (options.entryType === 'story') {
    params.story_only = true;
  }
  else if (options.entryType === 'folder') {
    params.folder_only = true;
  }

  return params;
}

export function buildClientFilters(options: FindOptions): ClientFilter[] {
  const filters: ClientFilter[] = [];

  // Publish status client-side filter (for 'published' and 'changed')
  if (options.publishStatus && options.publishStatus !== 'draft') {
    filters.push(story => matchesPublishStatus(story, options.publishStatus!));
  }

  // JSONPath --where filters
  if (options.where && options.where.length > 0) {
    for (const expression of options.where) {
      filters.push((story) => {
        return evaluateJsonPath(story, expression);
      });
    }
  }

  return filters;
}

export function applyClientFilters(story: Story, filters: ClientFilter[]): boolean {
  return filters.every(filter => filter(story));
}

/**
 * Evaluates a JSONPath expression against a story.
 * Returns true if the expression resolves to a non-empty result.
 */
function evaluateJsonPath(story: Story, expression: string): boolean {
  const result = JSONPath({ path: expression, json: story });
  return Array.isArray(result) && result.length > 0;
}
