import type { ReactNode } from "react";
import type { BridgeParams, LivePreviewStory } from "@storyblok/live-preview";
import type { Story } from "../types";
import { StoryblokPreviewServerRuntime } from "../client/storyblok-preview-server-runtime";

/** Props for the {@link StoryblokPreview} component. */
export type StoryblokPreviewProps<TStory extends Story = Story> = {
  /**
   * Initial story fetched by the application.
   */
  story: TStory;
  /**
   * Server Action responsible for rendering the story. Called once, awaited,
   * for the initial render, and again on every subsequent Visual Editor
   * update.
   *
   * This is a public Server Action: it is reachable in production and
   * renders whatever story the caller sends. It also renders the initial
   * content, for every visitor that gets `StoryblokPreview`. To limit it to
   * the Visual Editor, render `StoryblokPreview` only in draft mode (plain
   * `StoryblokBlock` otherwise), and reject calls outside draft mode in the
   * action. Rejecting them in the action alone fails every page render
   * outside draft mode.
   *
   * Receives only the story. Pass extra props by binding them:
   * `renderContent.bind(null, locale)`. Bound arguments travel through the
   * browser, so treat them as untrusted input too.
   */
  renderContent: (story: LivePreviewStory<TStory>) => Promise<ReactNode>;
  /**
   * Milliseconds to wait after the last editor event before triggering a
   * re-render. Prevents a Server Action call on every individual keystroke.
   *
   * Defaults to 200 ms.
   */
  debounceMs?: number;
  /**
   * Configuration forwarded to the Preview Bridge constructor.
   * Captured at mount time — changes after mount have no effect.
   */
  bridgeOptions?: BridgeParams;
};

/**
 * Server Component that enables live preview for RSC routes.
 *
 * Awaits `renderContent(story)` once to produce the initial server-rendered
 * output, then hands off to a client-side runtime that re-invokes
 * `renderContent` — a Server Action — on every Storyblok Visual Editor
 * update, streaming the result in via Suspense while keeping the current
 * tree on screen (no full page reload, no duplicate-DOM flash).
 *
 * Same props shape as `StoryblokPreview` from `@storyblok/react`
 * (`story` + `renderContent`) — the only difference is that `renderContent`
 * here is `async` and reruns on the server. Requires `React.use` and Server
 * Actions: React 19, or the Next.js App Router 14 or later, which bundles a
 * React version with both. Use the client `StoryblokPreview` elsewhere, such
 * as with `output: 'export'`.
 *
 * In React Server Components, the root `@storyblok/react` import resolves
 * to this component too, through the `react-server` export condition.
 *
 * Saving or publishing in the Visual Editor reloads the page. A server render
 * of a newer version of the same story that arrives without a reload (a
 * changed `updated_at`, e.g. from a `router.refresh()` the app triggers)
 * replaces the live render and resets client state inside the preview. A
 * server render of the same version keeps the live render, so it doesn't
 * discard unsaved edits.
 *
 * @example
 * ```tsx
 * // app/[slug]/page.tsx (Server Component)
 * export default async function Page({ params }) {
 *   const story = await fetchStory(params.slug);
 *   return <StoryblokPreview story={story} renderContent={renderStory} />;
 * }
 * ```
 */
export async function StoryblokPreview<TStory extends Story = Story>({
  story,
  renderContent,
  debounceMs,
  bridgeOptions,
}: StoryblokPreviewProps<TStory>): Promise<ReactNode> {
  const content = await renderContent(story);

  return (
    <StoryblokPreviewServerRuntime
      // Keyed by story so a reused instance (e.g. in a layout) drops the live
      // render, last good render, and queued story from the previous story.
      // `updated_at` is part of the key so a server render of a newer version
      // of the same story that arrives without a page reload (e.g. a
      // `router.refresh()` the app triggers) replaces the live render instead
      // of being hidden behind it. Unsaved edits don't change `updated_at`,
      // so they never remount the runtime.
      key={`${story.id}:${story.updated_at ?? ""}`}
      storyId={story.id}
      renderContent={renderContent}
      debounceMs={debounceMs}
      bridgeOptions={bridgeOptions}
    >
      {content}
    </StoryblokPreviewServerRuntime>
  );
}
