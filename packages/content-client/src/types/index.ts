/**
 * Raw API response from Storyblok (snake_case)
 */
export interface StoryblokRawResponse<T> {
  cv: number;
  rels: unknown[];
  links: unknown[];
  stories: StoryblokRawStory<T>[];
}

/**
 * Raw story from Storyblok API (snake_case)
 */
export interface StoryblokRawStory<T> {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  full_slug: string;
  path: string;
  content: StoryblokContentBase & T;
  position: number;
  tag_list: string[];
  is_startpage: boolean;
  group_id: string;
  parent_id: number;
  meta_title: string;
  meta_description: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  published_at: string;
  alternates: string[];
}

/**
 * Base interface for Storyblok story content
 */
export interface StoryblokStory<T> {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  full_slug: string;
  path: string;
  content: StoryblokContentBase & T;
  position: number;
  tag_list: string[];
  is_startpage: boolean;
  group_id: string;
  parent_id: number;
  meta_title: string;
  meta_description: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  published_at: string;
  alternates: string[];
}

/**
 * Base interface for Storyblok API response
 */
export interface StoryblokBaseResponse<T> {
  cv: number;
  rels: unknown[];
  links: unknown[];
  stories: StoryblokStory<T>[];
}

export interface StoryblokContentBase {
  _uid?: string;
  component: string;
  _editable?: string;
}

/**
 * Storyblok Link Object as returned by the /links endpoint
 * @see https://www.storyblok.com/docs/api/content-delivery/v2/links/retrieve-multiple-links
 */
export interface StoryblokLink {
  id: number;
  uuid: string;
  slug: string;
  path: string | null;
  real_path: string;
  name: string;
  published: boolean;
  parent_id: number | null;
  is_folder: boolean;
  is_startpage: boolean;
  position: number;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  alternates?: Array<{
    path: string;
    name: string;
    lang: string;
    published: boolean;
    translated_slug: string;
  }>;
}

/**
 * Response from the Storyblok /links endpoint
 */
export interface StoryblokLinksResponse {
  links: Record<string, StoryblokLink>;
}


