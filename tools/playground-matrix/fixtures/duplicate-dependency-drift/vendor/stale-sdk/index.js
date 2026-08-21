/**
 * Stands in for a dependency that was resolved at an earlier point in time.
 *
 * The exact pin is the whole point: it is what a lockfile written months ago
 * leaves behind once another dependency moves on to a newer range. No package
 * manager can collapse this into one copy without an override.
 */
export async function loadStaleBridge(config) {
  const { default: StoryblokBridge } = await import("@storyblok/preview-bridge");
  return new StoryblokBridge(config);
}
