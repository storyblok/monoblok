import type { Story, StoryContent, StoryListQuery } from '../../types';

export type { Story, StoryContent };

/**
 * Query parameters for retrieving multiple stories from the Management API.
 * Extends the MAPI StoryListQuery with an index signature to allow CLI-specific
 * ad-hoc parameters (e.g. filter_query[...] expansions).
 * @see https://www.storyblok.com/docs/api/management/core-resources/stories/retrieve-multiple-stories
 */
export type StoriesQueryParams = StoryListQuery & {
  // Allow string indexing for dynamic filter_query parameters
  [key: string]: string | number | boolean | undefined;
};

export interface FetchStoriesResult {
  stories: Story[];
  headers: Headers;
}

export type TargetStoryRef = Pick<Story, 'id' | 'uuid' | 'is_folder'>;

export interface ExistingTargetStories {
  // folders and start_page can have the same slug, we need TargetStoryRef[]
  bySlug: Map<string, TargetStoryRef[]>;
  byId: Map<number, TargetStoryRef>;
}

export interface StoryIndexEntry {
  filename: string;
  id: number | string;
  uuid: string;
  slug: string;
  name: string;
  full_slug: string;
  is_folder: boolean;
  is_startpage: boolean;
  parent_id: number | string | null;
  component?: string;
}

export const normalizeFullSlug = (slug: string): string => slug.replace(/\/$/, '');
