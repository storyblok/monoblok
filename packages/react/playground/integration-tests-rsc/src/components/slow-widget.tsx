/**
 * Demo async Server Component with an artificial delay, standing in for a
 * real slow data source (e.g. a weather API). Rendered wrapped in
 * `<Suspense>` on the catch-all page, alongside `StoryblokPreview` — not a
 * Storyblok component, so it never goes through the bridge.
 *
 * Proves two things Visual Editor QA otherwise never exercises on this
 * playground: the page streams the fallback immediately instead of blocking
 * on this component, and the live-editing bridge keeps working on the rest
 * of the tree while this component is still pending.
 */
export default async function SlowWidget({ delayMs = 2000 }: { delayMs?: number }) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  return <div data-test="slow-widget">Weather: 21°C, sunny (loaded after {delayMs}ms)</div>;
}
