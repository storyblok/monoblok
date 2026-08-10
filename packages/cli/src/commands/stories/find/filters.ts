import type { Story } from '../constants';
import { isStoryPublishedWithoutChanges, isStoryWithUnpublishedChanges } from '../utils';

export type PublishStatus = 'published' | 'changed' | 'draft';
export type TranslationStatus = 'missing' | 'stale' | 'unpublished' | 'complete';

interface TranslatedStoryMeta {
  lang: string;
  published_at: string | null;
  first_published_at: string | null;
  unpublished_changes: boolean;
}

/**
 * Filters a story by publish status (client-side).
 *
 * Server-side narrowing (is_published) is applied at the query level.
 * This filter handles the client-side distinction:
 * - `published`: is_published=true + unpublished_changes === false
 * - `changed`: is_published=true + unpublished_changes === true
 * - `draft`: fully server-side, no client filter needed
 */
export function matchesPublishStatus(story: Story, status: PublishStatus): boolean {
  switch (status) {
    case 'published':
      return isStoryPublishedWithoutChanges(story) === true;
    case 'changed':
      return isStoryWithUnpublishedChanges(story) === true;
    case 'draft':
      return true; // fully server-side filtered
  }
}

/**
 * Filters a story by translation status (client-side).
 *
 * Semantics:
 * - `missing` / `stale` / `unpublished`: ANY of the specified languages matches -> include
 * - `complete`: ALL of the specified languages must match -> include
 */
export function matchesTranslationStatus(
  story: Story,
  status: TranslationStatus,
  languages: string[],
): boolean {
  const translations = (story as Story & { translated_stories?: TranslatedStoryMeta[] }).translated_stories ?? [];

  const getTranslation = (lang: string): TranslatedStoryMeta | undefined =>
    translations.find(t => t.lang === lang);

  switch (status) {
    case 'missing':
      // ANY specified language is missing or never published
      return languages.some((lang) => {
        const t = getTranslation(lang);
        return !t || t.published_at === null;
      });

    case 'stale':
      // ANY specified language has translation.published_at < story.published_at
      return languages.some((lang) => {
        const t = getTranslation(lang);
        if (!t || t.published_at === null) { return false; }
        if (!story.published_at) { return false; }
        return t.published_at < story.published_at;
      });

    case 'unpublished':
      // ANY specified language has unpublished changes
      return languages.some((lang) => {
        const t = getTranslation(lang);
        return t?.unpublished_changes === true;
      });

    case 'complete':
      // ALL specified languages must be published and current
      return languages.every((lang) => {
        const t = getTranslation(lang);
        if (!t || t.published_at === null) { return false; }
        if (!story.published_at) { return true; } // draft story, translation exists
        return t.published_at >= story.published_at;
      });
  }
}

/**
 * Returns the MAPI query params for server-side publish status filtering.
 */
export function publishStatusToQueryParams(status: PublishStatus): { is_published?: boolean } {
  switch (status) {
    case 'published':
    case 'changed':
      return { is_published: true };
    case 'draft':
      return { is_published: false };
  }
}
