/**
 * Three dependencies, each reached by more than one route, in one app.
 *
 * `@storyblok/preview-bridge` is reached three ways: imported directly, loaded
 * by `@storyblok/js`, and loaded by `@storyblok/live-preview`. `@storyblok/richtext`
 * is reached three ways: directly, re-exported by `@storyblok/js`, and re-exported
 * by `@storyblok/vue`. `storyblok-js-client` is reached two ways: directly and
 * through the `@storyblok/js` api plugin.
 *
 * Counting copies in the build output is one half of the answer, and the matrix
 * does that by fingerprint. This is the other half: whether the routes land on
 * the same module at run time, and what a duplicated bridge actually does to the
 * page. The bridge only initializes inside an iframe, so the page loads itself
 * into one and the inner frame reports back.
 */
import StoryblokBridge from "@storyblok/preview-bridge";
import {
  apiPlugin,
  loadStoryblokBridge as loadBridgeViaJs,
  renderRichText as renderRichTextViaJs,
  storyblokInit,
} from "@storyblok/js";
import { loadStoryblokBridge as loadBridgeViaLivePreview } from "@storyblok/live-preview";
import { renderRichText as renderRichTextDirect } from "@storyblok/richtext";
import { renderRichText as renderRichTextViaVue } from "@storyblok/vue";
import StoryblokClient from "storyblok-js-client";

type Counts = { message: number; mousemove: number; click: number };

type Probe = {
  bridge: {
    jsClassIsDirectClass: boolean;
    livePreviewClassIsDirectClass: boolean;
    distinctClasses: number;
    listenersAfterFirst: Counts;
    listenersAfterSecond: Counts;
    dom: Record<string, number>;
  };
  richtext: { jsIsDirect: boolean; vueIsDirect: boolean; sameHtml: boolean };
  client: { jsIsDirect: boolean };
  errors: string[];
};

const RICH_TEXT_DOC = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "duplicate dependency",
          marks: [{ type: "link", attrs: { href: "https://example.com", target: "_blank" } }],
        },
      ],
    },
  ],
};

/** Counts the listeners the bridge adds, so a second copy would show up as a second set. */
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
 * Selectors are assembled from fragments rather than written out.
 *
 * The matrix counts bundled copies of a dependency by searching the build
 * output for a string literal that dependency contains, and one of those
 * literals is the bridge's stylesheet id. Spelling it out here would put a
 * second occurrence in the bundle and inflate the count by one. A `join` is
 * not constant-folded, so nothing recognisable survives into the output.
 */
function countDom(): Record<string, number> {
  const selectors: Record<string, string[]> = {
    stylesheet: ["#storyblok", "bridge", "stylesheet"],
    hint: [".storyblok__hint"],
    overlay: [".storyblok__overlay"],
    overlayMenu: [".storyblok__overlay", "menu"],
    actionsMenu: [".storyblok__actions", "menu"],
    breadcrumbsMenu: [".storyblok__breadcrumbs", "menu"],
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

  // Route 1 and 2: the app's own import, and the class `@storyblok/js` exposes.
  await loadBridgeViaJs();
  const jsClass = (window as unknown as { StoryblokBridge?: unknown }).StoryblokBridge;

  let firstInstance: unknown;
  try {
    firstInstance = new (jsClass as new (config?: unknown) => unknown)({});
  } catch (error) {
    errors.push(`js bridge: ${(error as Error).message}`);
  }
  const listenersAfterFirst = { ...counts };

  // Route 3: `@storyblok/live-preview` instantiates its own bridge.
  let livePreviewInstance: unknown;
  try {
    livePreviewInstance = await loadBridgeViaLivePreview();
  } catch (error) {
    errors.push(`live-preview bridge: ${(error as Error).message}`);
  }
  const listenersAfterSecond = { ...counts };

  const classes = new Set(
    [
      StoryblokBridge,
      jsClass,
      livePreviewInstance ? (livePreviewInstance as object).constructor : undefined,
      firstInstance ? (firstInstance as object).constructor : undefined,
    ].filter(Boolean),
  );

  // Richtext, reached three ways.
  let sameHtml = false;
  try {
    const rendered = [renderRichTextDirect, renderRichTextViaJs, renderRichTextViaVue].map(
      (render) =>
        // @ts-expect-error the fixture doc is structurally a rich text doc
        render(RICH_TEXT_DOC),
    );
    sameHtml = new Set(rendered).size === 1;
  } catch (error) {
    errors.push(`richtext: ${(error as Error).message}`);
  }

  // The api client, reached two ways.
  let clientIsDirect = false;
  try {
    const { storyblokApi } = storyblokInit({
      accessToken: "fixture-token",
      bridge: false,
      use: [apiPlugin],
    }) as { storyblokApi?: object };
    clientIsDirect = storyblokApi?.constructor === StoryblokClient;
  } catch (error) {
    errors.push(`client: ${(error as Error).message}`);
  }

  return {
    bridge: {
      jsClassIsDirectClass: jsClass === StoryblokBridge,
      livePreviewClassIsDirectClass: livePreviewInstance
        ? (livePreviewInstance as object).constructor === StoryblokBridge
        : false,
      distinctClasses: classes.size,
      listenersAfterFirst,
      listenersAfterSecond,
      dom: countDom(),
    },
    richtext: {
      jsIsDirect: renderRichTextViaJs === renderRichTextDirect,
      vueIsDirect: renderRichTextViaVue === renderRichTextDirect,
      sameHtml,
    },
    client: { jsIsDirect: clientIsDirect },
    errors,
  };
}

function publish(probe: Probe): void {
  (window as unknown as { __demo: Probe }).__demo = probe;
  document.querySelector("#app")!.textContent =
    `Storyblok duplicate-dependency-stress probe: ${JSON.stringify(probe)}`;
}

if (new URLSearchParams(window.location.search).has("inner")) {
  runInner().then((probe) => {
    publish(probe);
    window.parent.postMessage({ source: "storyblok-stress-fixture", probe }, "*");
  });
} else {
  // The bridge only initializes inside an iframe, so the real work happens in
  // one and the result is forwarded up here for the smoke test to read.
  const timeout = window.setTimeout(() => {
    publish({
      bridge: {
        jsClassIsDirectClass: false,
        livePreviewClassIsDirectClass: false,
        distinctClasses: 0,
        listenersAfterFirst: { message: 0, mousemove: 0, click: 0 },
        listenersAfterSecond: { message: 0, mousemove: 0, click: 0 },
        dom: {},
      },
      richtext: { jsIsDirect: false, vueIsDirect: false, sameHtml: false },
      client: { jsIsDirect: false },
      errors: ["inner frame did not report back within 15s"],
    });
  }, 15_000);

  window.addEventListener("message", (event) => {
    if (event.data?.source !== "storyblok-stress-fixture") return;
    window.clearTimeout(timeout);
    publish(event.data.probe as Probe);
  });

  const frame = document.createElement("iframe");
  frame.setAttribute("title", "inner");
  frame.style.cssText = "width:400px;height:200px;border:1px solid #ccc";
  frame.src = `${window.location.pathname}?inner=1&_storyblok=1`;
  document.body.appendChild(frame);
}
