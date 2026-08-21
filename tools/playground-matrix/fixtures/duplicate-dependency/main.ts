/**
 * Two routes to the same dependency, in one app.
 *
 * The app imports `@storyblok/preview-bridge` directly, the way a second SDK
 * or the app's own code would. `@storyblok/js` reaches the same dependency
 * through `loadStoryblokBridge()`. Whether those two land on one copy or two
 * is decided entirely by how `@storyblok/js` was packaged, which is what this
 * fixture exists to show.
 *
 * Counting the copies is a build-output job, not a runtime one: once a
 * dependency is inlined it has no module identity left to compare against. The
 * matrix counts them by fingerprint. What this probe adds is the other half,
 * that both routes still reach a working bridge at all, which is exactly what
 * a badly externalized dynamic import would break.
 */
import StoryblokBridge from "@storyblok/preview-bridge";
import { loadStoryblokBridge } from "@storyblok/js";

type Probe = {
  directBridgeLoaded: boolean;
  jsBridgeLoaded: boolean;
  error?: string;
};

async function probeBridges(): Promise<Probe> {
  const probe: Probe = {
    directBridgeLoaded: typeof StoryblokBridge === "function",
    jsBridgeLoaded: false,
  };

  try {
    await loadStoryblokBridge();

    // `loadStoryblokBridge` resolving at all is the interesting part: it is a
    // bare dynamic import of an externalized dependency, so it only works if
    // the consumer's install actually provides the package.
    probe.jsBridgeLoaded = typeof window.storyblokRegisterEvent === "function";
  } catch (error) {
    probe.error = (error as Error).message;
  }

  return probe;
}

probeBridges().then((probe) => {
  (window as unknown as { __demo: Probe }).__demo = probe;
  document.querySelector("#app")!.textContent =
    `Storyblok duplicate-dependency probe: ${JSON.stringify(probe)}`;
});
