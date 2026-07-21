import type { BlokContent, Story, StoryListQuery } from '../../types';

export type { BlokContent, Story };

/**
 * Query parameters for retrieving multiple stories from the Management API.
 *
 * Matches the MAPI query contract exactly. `filter_query` is the structured
 * object form; the CLI's `--query` string is parsed into it via
 * {@link parseFilterQuery} before reaching this type.
 * @see https://www.storyblok.com/docs/api/management/core-resources/stories/retrieve-multiple-stories
 */
export type StoriesQueryParams = StoryListQuery;

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
