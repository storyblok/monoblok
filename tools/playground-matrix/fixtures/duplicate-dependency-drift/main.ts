/**
 * The same dependency at two versions, because the install happened over time.
 *
 * The stress fixture next door resolves everything in one go, so every range
 * lands on one version and there is nothing for a package manager to get wrong.
 * Real apps do not install once. A dependency added a year ago pinned
 * `@storyblok/preview-bridge` at 2.1.6 and its lockfile entry never moved, while
 * everything added since resolves to 2.2.x. `vendor/stale-sdk` is that older
 * dependency, and its exact pin means no install can collapse the two.
 *
 * The question this asks is not whether duplication is possible in that state,
 * because it is, on both sides. It is how many copies there are, and whether the
 * app has any way to get rid of them.
 */
import StoryblokBridge from "@storyblok/preview-bridge";
import { loadStoryblokBridge as loadBridgeViaJs } from "@storyblok/js";
import { loadStoryblokBridge as loadBridgeViaLivePreview } from "@storyblok/live-preview";
// @ts-expect-error the vendored fixture package ships no types
import { loadStaleBridge } from "stale-sdk";

type Counts = { message: number; mousemove: number; click: number };

type Probe = {
  distinctClasses: number;
  routes: Record<string, string>;
  listenersAfterAll: Counts;
  dom: Record<string, number>;
  errors: string[];
};

/** Counts the listeners the bridge adds, so a second live copy shows up as a second set. */
function installListenerCounters(): Counts {
  const counts: Counts = { message: 0, mousemove: 0, click: 0 };

  for (const target of [window, document] as Array<Window | Document>) {
    const original = target.addEventListener.bind(target);
    target.addEventListener = (type: string, ...rest: unknown[]) => {
      if (type in counts) counts[type as keyof Counts] += 1;
      // @ts-expect-error forwarding a variadic call
      return original(type, ...rest);
    };
  }

  return counts;
}

/**
 * Selectors are assembled from fragments rather than written out, because the
 * matrix counts bundled copies by searching the build output for a string
 * literal the dependency contains, and one of those is the stylesheet id.
 * A `join` is not constant-folded, so nothing recognisable reaches the bundle.
 */
function countDom(): Record<string, number> {
  const selectors: Record<string, string[]> = {
    stylesheet: ["#storyblok", "bridge", "stylesheet"],
    hint: [".storyblok__hint"],
    overlay: [".storyblok__overlay"],
    overlayMenu: [".storyblok__overlay", "menu"],
    actionsMenu: [".storyblok__actions", "menu"],
  };

  return Object.fromEntries(
    Object.entries(selectors).map(([name, fragments]) => [
      name,
      document.querySelectorAll(fragments.join("-")).length,
    ]),
  );
}

async function runInner(): Promise<Probe> {
  const errors: string[] = [];
  const counts = installListenerCounters();
  const classes: Array<{ route: string; value: unknown }> = [
    { route: "direct import", value: StoryblokBridge },
  ];

  try {
    await loadBridgeViaJs();
    classes.push({
      route: "@storyblok/js",
      value: (window as unknown as { StoryblokBridge?: unknown }).StoryblokBridge,
    });
  } catch (error) {
    errors.push(`@storyblok/js: ${(error as Error).message}`);
  }

  for (const [route, load] of [
    ["@storyblok/live-preview", loadBridgeViaLivePreview],
    ["stale-sdk", loadStaleBridge],
  ] as Array<[string, (config?: unknown) => Promise<unknown>]>) {
    try {
      const instance = await load({});
      classes.push({ route, value: (instance as object).constructor });
    } catch (error) {
      errors.push(`${route}: ${(error as Error).message}`);
    }
  }

  // Label each route by which distinct class it landed on, so the report shows
  // the grouping rather than just how many groups there are.
  const identities: unknown[] = [];
  const routes: Record<string, string> = {};

  for (const { route, value } of classes) {
    let index = identities.indexOf(value);
    if (index === -1) index = identities.push(value) - 1;
    routes[route] = `copy ${index + 1}`;
  }

  return {
    distinctClasses: identities.length,
    routes,
    listenersAfterAll: { ...counts },
    dom: countDom(),
    errors,
  };
}

function publish(probe: Probe): void {
  (window as unknown as { __demo: Probe }).__demo = probe;
  document.querySelector("#app")!.textContent =
    `Storyblok duplicate-dependency-drift probe: ${JSON.stringify(probe)}`;
}

if (new URLSearchParams(window.location.search).has("inner")) {
  runInner().then((probe) => {
    publish(probe);
    window.parent.postMessage({ source: "storyblok-drift-fixture", probe }, "*");
  });
} else {
  // The bridge only initializes inside an iframe, so the real work happens in
  // one and the result is forwarded up here for the smoke test to read.
  const timeout = window.setTimeout(() => {
    publish({
      distinctClasses: 0,
      routes: {},
      listenersAfterAll: { message: 0, mousemove: 0, click: 0 },
      dom: {},
      errors: ["inner frame did not report back within 15s"],
    });
  }, 15_000);

  window.addEventListener("message", (event) => {
    if (event.data?.source !== "storyblok-drift-fixture") return;
    window.clearTimeout(timeout);
    publish(event.data.probe as Probe);
  });

  const frame = document.createElement("iframe");
  frame.setAttribute("title", "inner");
  frame.style.cssText = "width:400px;height:200px;border:1px solid #ccc";
  frame.src = `${window.location.pathname}?inner=1&_storyblok=1`;
  document.body.appendChild(frame);
}
