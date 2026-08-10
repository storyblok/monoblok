import { JSONPath } from 'jsonpath-plus';
import type { StoriesQueryParams, Story } from '../constants';
import { parseFilterQuery } from '../filter-query';
import type { ClientFilter, FindOptions } from './types';
import {
  matchesPublishStatus,
  matchesTranslationStatus,
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

  // Filter query and root block (both contribute to filter_query)
  if (options.query || options.rootBlock) {
    params.filter_query = {
      ...options.query ? parseFilterQuery(options.query) : {},
      ...options.rootBlock ? { component: { in: options.rootBlock } } : {},
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

  // Translation status
  if (options.translationStatus) {
    const languages = options.language
      ? options.language.split(',').map(l => l.trim())
      : [];

    if (languages.length === 0) {
      // Check across all available translations
      filters.push((story) => {
        const translations = (story as Story & { translated_stories?: Array<{ lang: string }> }).translated_stories ?? [];
        const allLangs = translations.map(t => t.lang);
        if (allLangs.length === 0) {
          // No translations at all — 'missing' should match, 'complete' should not
          return options.translationStatus === 'missing';
        }
        return matchesTranslationStatus(story, options.translationStatus!, allLangs);
      });
    }
    else {
      filters.push(story => matchesTranslationStatus(story, options.translationStatus!, languages));
    }
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
