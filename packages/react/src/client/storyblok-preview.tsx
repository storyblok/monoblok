"use client";

import type { ReactNode } from "react";
import type { LivePreviewStory } from "@storyblok/live-preview";
import type { Story } from "../types";
import { useStoryblokState, type UseStoryblokStateOptions } from "./use-storyblok-state";

/** Props for the {@link StoryblokPreview} component. */
export type StoryblokPreviewProps<TStory extends Story = Story> = UseStoryblokStateOptions & {
  /**
   * Initial story fetched by the application.
   */
  story: TStory;
  /**
   * Render function that receives the latest story on every Visual Editor
   * update and returns the UI for it.
   *
   * The `Promise` return type is for React Server Components: there, the
   * root `@storyblok/react` import resolves to the Server Component
   * `StoryblokPreview` (the `react-server` export condition), where
   * `renderContent` is an async Server Action. TypeScript resolves the root
   * types without that condition, so these props accept both.
   */
  renderContent: (story: LivePreviewStory<TStory>) => ReactNode | Promise<ReactNode>;
};

/**
 * Client component that subscribes to Storyblok Visual Editor events and
 * re-renders its content with the latest story on every editor update.
 *
 * Pass the initially fetched story and a `renderContent` function. The
 * component holds the live story in state and calls `renderContent` with it
 * on every editor update, so your UI stays in sync with the Visual Editor
 * without a full page reload.
 *
 * In a React Server Component, the same import resolves to the Server
 * Component `StoryblokPreview` (also exported from `@storyblok/react/rsc`):
 * same props shape (`story` + `renderContent`), but `renderContent` there is
 * an async Server Action and reruns on the server.
 *
 * @example
 * ```tsx
 * <StoryblokPreview
 *   story={story}
 *   renderContent={(live) => (live.content ? <StoryblokBlock block={live.content} /> : null)}
 * />
 * ```
 */
export function StoryblokPreview<TStory extends Story = Story>({
  story,
  renderContent,
  ...options
}: StoryblokPreviewProps<TStory>): ReactNode {
  const current = useStoryblokState<TStory>(story, options);
  return <>{renderContent(current)}</>;
}
