/**
 * Retrieves the live Storyblok story and server data from Astro's `locals` during preview mode.
 *
 * This function is primarily useful when working with the Storyblok Visual Editor
 * and live preview updates in an Astro project.
 *
 * @template ServerData - The type of server data
 * @template Story - The type of story data
 * @param {object} params - The function parameters
 * @param {object} params.locals - The Astro locals object
 * @returns {Promise<{ story?: Story; serverData?: ServerData }>} An object containing the story and serverData if available
 *
 * @example
 * ```ts
 * // Basic usage:
 * const payload = await getPayload({ locals: Astro.locals });
 * const story = payload.story ?? null;
 *
 * // With typed server data:
 * interface ServerData {
 *   users?: User[];
 * }
 *
 * const payload = await getPayload<ServerData, MyStory>({ locals: Astro.locals });
 * const story = payload.story ?? null;
 * const users = payload.serverData?.users ?? [];
 * ```
 */
export async function getPayload<ServerData extends object = object, Story = unknown>({
  locals,
}: {
  locals: {
    _storyblok_preview_data?: {
      serverData?: ServerData;
      story?: Story;
    };
  };
}): Promise<{ story?: Story; serverData?: ServerData }> {
  const { story, serverData } = locals._storyblok_preview_data || {};
  return { story, serverData };
}
