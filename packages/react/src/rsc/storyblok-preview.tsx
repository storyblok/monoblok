import type { BridgeParams, LivePreviewStory } from "@storyblok/live-preview";
import type { ReactNode } from "react";
import type { Story } from "../types";
import { StoryblokPreviewServerRuntime } from "../client/storyblok-preview-server-runtime";

/** Props for the {@link StoryblokPreview} component. */
export interface StoryblokPreviewProps {
  /**
   * Initial story fetched by the application.
   */
  story: Story;
  /**
   * Server Action responsible for rendering the story. Called once, awaited,
   * for the initial render, and again on every subsequent Visual Editor
   * update.
   */
  renderContent: (story: LivePreviewStory) => Promise<ReactNode>;
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
}

/**
 * Server Component that enables live preview for RSC routes.
 *
 * Awaits `renderContent(story)` once to produce the initial server-rendered
 * output, then hands off to a client-side runtime that re-invokes
 * `renderContent` — a Server Action — on every Storyblok Visual Editor
 * update, streaming the result in via Suspense while keeping the current
 * tree on screen (no full page reload, no duplicate-DOM flash).
 *
 * Same props shape as `StoryblokPreview` from `@storyblok/react/client`
 * (`story` + `renderContent`) — the only difference is that `renderContent`
 * here is `async` and reruns on the server. Requires React 19 (`React.use`)
 * and Server Actions; use `@storyblok/react/client` on React 17/18 or with
 * `output: 'export'`.
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
export async function StoryblokPreview({
  story,
  renderContent,
  debounceMs,
  bridgeOptions,
}: StoryblokPreviewProps): Promise<ReactNode> {
  // The bridge only ever sends the LivePreviewStory shape (id, and
  // optionally uuid/content) to renderContent on updates. The initially
  // fetched Story is always a superset of that, so this first call is safe.
  const content = await renderContent(story as unknown as LivePreviewStory);

  return (
    <StoryblokPreviewServerRuntime
      renderContent={renderContent}
      debounceMs={debounceMs}
      bridgeOptions={bridgeOptions}
    >
      {content}
    </StoryblokPreviewServerRuntime>
  );
}
