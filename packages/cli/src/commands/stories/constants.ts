import type { Stories } from '@storyblok/management-api-client';

export type Story = Stories.Story;

export interface StoryAlternate {
  id: number;
  name: string;
  slug: string;
  published: boolean;
  full_slug: string;
  is_folder: boolean;
  parent_id?: number;
}

export interface TranslatedSlug {
  story_id?: number;
  lang: string;
  slug: string;
  name: string | null;
  published: boolean | null;
}

export interface TranslatedSlugAttributes extends TranslatedSlug {
  id?: number;
}

export interface LocalizedPath {
  path: string;
  name: string | null;
  lang: string;
  published: boolean;
}

export interface StoryContent {
  _uid: string;
  component: string;
  [key: string]: any;
}

export interface ParentInfo {
  id: number;
  slug: string;
  name: string;
  disable_fe_editor?: boolean;
  uuid: string;
}

export interface PreviewToken {
  token: string;
  timestamp: string;
}

export interface LastAuthor {
  id: number;
  userid: string;
  friendly_name: string;
}

export interface BreadcrumbItem {
  id: number;
  name: string;
  parent_id: number;
  disable_fe_editor: boolean;
  path: string;
  slug: string;
  translated_slugs?: TranslatedSlug[];
}

/**
 * Query parameters for retrieving multiple stories from the Management API
 * @see https://www.storyblok.com/docs/api/management/core-resources/stories/retrieve-multiple-stories
 */
export interface StoriesQueryParams {
  // Pagination
  page?: number;

  // Content filtering
  contain_component?: string;
  text_search?: string;
  sort_by?: string;
  pinned?: boolean;
  excluding_ids?: string;
  by_ids?: string;
  by_uuids?: string;
  with_tag?: string;
  folder_only?: boolean;
  story_only?: boolean;
  with_parent?: number;
  starts_with?: string;
  in_trash?: boolean;
  search?: string;
  filter_query?: string;
  in_release?: number;
  is_published?: boolean;
  by_slugs?: string;
  mine?: boolean;
  excluding_slugs?: string;
  in_workflow_stages?: string;
  by_uuids_ordered?: string;
  with_slug?: string;
  with_summary?: number;
  scheduled_at_gt?: string;
  scheduled_at_lt?: string;
  favourite?: boolean;
  reference_search?: string;

  // Allow string indexing for filter_query parameters
  [key: string]: string | number | boolean | undefined;
}

export interface StoriesFilterOptions {
  componentName?: string;
  query?: string;
  starts_with?: string;
}
