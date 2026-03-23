/**
 * Options for validating Storyblok Visual Editor requests.
 */
interface StoryblokValidationOptions {
  /**
   * Optional space ID to validate against the request.
   * If provided, the request must match this space ID to be considered valid.
   */
  spaceId?: string;
}

/**
 * Required query parameters that must be present in all Storyblok Visual Editor requests.
 */
const REQUIRED_STORYBLOK_PARAMS = ['_storyblok', '_storyblok_c', '_storyblok_tk[space_id]'] as const;

/**
 * Validates whether a given URL is a legitimate request from the Storyblok Visual Editor.
 *
 * This function performs a multi-layered validation to ensure the request originates from
 * the Storyblok Visual Editor by checking for required query parameters and optionally
 * validating the space ID.
 *
 * @param url - The URL object to validate.
 * @param options - Optional validation configuration.
 * @param options.spaceId - If provided, validates that the request's space ID matches this value.
 *
 * @returns `true` if the URL contains all required Storyblok Visual Editor parameters
 *          and passes optional space ID validation; `false` otherwise.
 *
 * @example
 * ```typescript
 * const url = new URL('https://example.com/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789');
 *
 * // Basic validation
 * if (isEditorRequest(url)) {
 *   console.log('Valid Storyblok editor request');
 * }
 *
 * // Validation with space ID check
 * if (isEditorRequest(url, { spaceId: '789' })) {
 *   console.log('Valid request for specific space');
 * }
 * ```
 */
export function isEditorRequest(
  url: URL,
  options: StoryblokValidationOptions = {},
): boolean {
  const params = url.searchParams;

  // Early return: Check all required parameters exist
  const hasRequiredParams = REQUIRED_STORYBLOK_PARAMS.every(param => params.has(param));

  if (!hasRequiredParams) {
    return false;
  }

  // Optional space ID validation
  if (options.spaceId && params.get('_storyblok_tk[space_id]') !== options.spaceId) {
    return false;
  }

  return true;
}
