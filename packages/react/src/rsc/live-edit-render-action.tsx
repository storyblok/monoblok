'use server';
import type { ReactNode } from 'react';
import type { ISbStoryData, SbBlokData } from '@/types';
import { type LiveEditRenderProps, toLiveEditRenderProps } from './live-edit-props';
import StoryblokServerComponent from './server-component';
import { getComponentsMap, isReactServerEnvironment } from './state';

/**
 * - `ok: true`: the rendered story.
 * - `retry`: this server instance hadn't run the app's `storyblokInit` yet, so
 *   no components were registered. The response re-renders the page, which runs
 *   it; sending the story again then succeeds.
 * - `unsupported`: this module runs in the browser instead of as a Server
 *   Action, so it can't render the story with the app's server components.
 */
export type LiveEditRenderResult =
  | { ok: true; node: ReactNode }
  | { ok: false; retry?: boolean; unsupported?: boolean };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isBlok = (value: unknown): value is SbBlokData =>
  isRecord(value) && typeof value.component === 'string';

const toBlok = (content: unknown): SbBlokData | null => {
  if (typeof content !== 'string') {
    return isBlok(content) ? content : null;
  }
  try {
    const parsed: unknown = JSON.parse(content);
    return isBlok(parsed) ? parsed : null;
  }
  catch {
    return null;
  }
};

/** Never set: deleting it is only how the action asks for a re-render. */
const WARM_UP_COOKIE = '__storyblok_live_edit';

/**
 * Makes Next.js re-render the current page in this action's response. Next.js
 * does that whenever an action changes a cookie. It only affects the caller's
 * response: unlike `revalidatePath`, it doesn't touch any cache.
 */
const rerenderCurrentPage = async (): Promise<void> => {
  if (!process.env.NEXT_RUNTIME) {
    return;
  }
  try {
    const { cookies } = await import('next/headers');
    // Synchronous before Next.js 15, a promise since.
    (await cookies()).delete(WARM_UP_COOKIE);
  }
  catch (error) {
    console.error('renderLiveEditStory: couldn\'t re-render the page', error);
  }
};

/**
 * Server Action used by `StoryblokStory` to render a Visual Editor update on
 * the server.
 *
 * It returns the rendered tree to the caller and keeps no state: no shared
 * cache, no `revalidatePath`. A call can only change what the caller itself
 * sees, so a request that didn't come from the Visual Editor can't change the
 * page for anyone else. Treat the story as untrusted input all the same:
 * Server Actions are public HTTP endpoints, and the caller chooses its content.
 */
export async function renderLiveEditStory(input: {
  story: Pick<ISbStoryData, 'content'>;
  props?: LiveEditRenderProps;
}): Promise<LiveEditRenderResult> {
  // Next.js 13 bundles a `'use server'` module imported by a client component
  // into the browser as plain code, even with `experimental.serverActions`. A
  // real Server Action always runs under `react-server`.
  if (!isReactServerEnvironment()) {
    return { ok: false, unsupported: true };
  }

  // The payload comes from the network: check every level instead of trusting the type.
  const story: unknown = isRecord(input) ? input.story : null;
  const blok = isRecord(story) ? toBlok(story.content) : null;
  if (!blok) {
    return { ok: false };
  }

  if (getComponentsMap().size === 0) {
    await rerenderCurrentPage();
    return { ok: false, retry: true };
  }

  return {
    ok: true,
    node: <StoryblokServerComponent blok={blok} {...toLiveEditRenderProps(input.props)} />,
  };
}
