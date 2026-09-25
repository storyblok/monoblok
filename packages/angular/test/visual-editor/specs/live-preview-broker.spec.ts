import { expect, test } from "@playwright/test";
import { resolveStoryId, StoryblokEditor } from "@storyblok/visual-editor-qa";
import { QA_CONFIG } from "../qa.config";

type BrokerQaScenario =
  | "singleA"
  | "singleB"
  | "sameTick"
  | "sequential"
  | "reverseSequential"
  | "delayed";

type BrokerQaSubscriber = "A" | "B";

type BrokerQaState = {
  active: BrokerQaSubscriber[];
  updatesA: number;
  updatesB: number;
};

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    if (location.origin === "https://localhost:4200") {
      localStorage.setItem("storyblok-live-preview-qa", "true");
    }

    const messageListeners = new Set<EventListenerOrEventListenerObject>();
    const addEventListener = window.addEventListener.bind(window);
    const removeEventListener = window.removeEventListener.bind(window);
    window.addEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) => {
      // A null listener is a no-op for the DOM too, so dropping it changes nothing.
      if (!listener) return;
      if (type === "message") messageListeners.add(listener);
      addEventListener(type, listener, options);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ) => {
      if (!listener) return;
      if (type === "message") messageListeners.delete(listener);
      removeEventListener(type, listener, options);
    }) as typeof window.removeEventListener;
    Object.defineProperty(window, "__storyblokMessageListenerCount", {
      configurable: true,
      get: () => messageListeners.size,
    });
  });
});

declare global {
  interface Window {
    __storyblokMessageListenerCount?: number;
    __storyblokBrokerQa?: {
      run: (scenario: BrokerQaScenario) => Promise<void>;
      clear: () => void;
      clearA: () => void;
      clearB: () => void;
      state: () => BrokerQaState;
    };
  }
}

const scenarios: readonly [BrokerQaScenario, string][] = [
  ["singleA", "single subscriber A"],
  ["singleB", "single subscriber B"],
  ["sameTick", "both subscribers in the same tick"],
  ["sequential", "A awaited, then B"],
  ["reverseSequential", "B awaited, then A"],
  ["delayed", "A, then B three seconds later"],
];

const expectedSubscribers: Record<BrokerQaScenario, BrokerQaSubscriber[]> = {
  singleA: ["A"],
  singleB: ["B"],
  sameTick: ["A", "B"],
  sequential: ["A", "B"],
  reverseSequential: ["A", "B"],
  delayed: ["A", "B"],
};

/**
 * What a single keystroke in the editor must produce.
 *
 * `fanOut` and `resolved` are deliberately separate: a subscriber that
 * unsubscribed still contributes its relations to the live bridge, so "both
 * relations resolved" and "both callbacks fired" are different claims.
 */
type EditExpectation = {
  /** Subscribers whose update counter must advance on that one event. */
  fanOut: BrokerQaSubscriber[];
  /** Subscribers whose relation must arrive as a story, not as a uuid. */
  resolved: BrokerQaSubscriber[];
};

/** The story both seeded relation fields point at. */
const RELATION_TARGET = "QA broker author";

const getPreviewFrame = async (page: import("@playwright/test").Page) => {
  await expect
    .poll(() => page.frames().some((frame) => frame.url().startsWith(QA_CONFIG.previewBaseUrl)), {
      timeout: 30_000,
    })
    .toBe(true);
  return page.frames().find((frame) => frame.url().startsWith(QA_CONFIG.previewBaseUrl))!;
};

const getBrokerState = async (page: import("@playwright/test").Page): Promise<BrokerQaState> => {
  const frame = await getPreviewFrame(page);

  return frame.evaluate(async () => {
    const deadline = Date.now() + 30_000;
    while (!window.__storyblokBrokerQa && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!window.__storyblokBrokerQa) throw new Error("Angular broker QA API is not installed");
    return window.__storyblokBrokerQa.state();
  });
};

const runScenario = async (
  page: import("@playwright/test").Page,
  scenario: BrokerQaScenario,
): Promise<void> => {
  const frame = await getPreviewFrame(page);

  await frame.evaluate(async (selectedScenario) => {
    const deadline = Date.now() + 30_000;
    while (!window.__storyblokBrokerQa && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!window.__storyblokBrokerQa) throw new Error("Angular broker QA API is not installed");
    await window.__storyblokBrokerQa.run(selectedScenario);
  }, scenario);
};

const messageListenerCount = async (page: import("@playwright/test").Page): Promise<number> => {
  const frame = await getPreviewFrame(page);
  return frame.evaluate(() => window.__storyblokMessageListenerCount ?? 0);
};

/**
 * Both blocks render either way: an unresolved relation is a uuid string, and
 * the templates then interpolate `undefined` into an empty label. So only the
 * text proves that the bridge resolved the relation, never the element count.
 */
const expectRelations = async (
  editor: StoryblokEditor,
  resolved: BrokerQaSubscriber[],
): Promise<void> => {
  const featured = editor.preview.locator("app-feature-posts h4");
  const author = editor.preview.locator("app-article > article > p");

  await expect(featured).toHaveText(resolved.includes("A") ? RELATION_TARGET : "");
  await expect(author).toHaveText(
    resolved.includes("B") ? `Author: ${RELATION_TARGET}` : "Author:",
  );
};

const expectFanOut = async (
  page: import("@playwright/test").Page,
  before: BrokerQaState,
  fanOut: BrokerQaSubscriber[],
): Promise<void> => {
  await expect
    .poll(
      async () => {
        const after = await getBrokerState(page);
        return {
          A: after.updatesA - before.updatesA,
          B: after.updatesB - before.updatesB,
        };
      },
      { timeout: 30_000 },
    )
    .toEqual({ A: fanOut.includes("A") ? 1 : 0, B: fanOut.includes("B") ? 1 : 0 });
};

const editArticleTitle = async (
  page: import("@playwright/test").Page,
  editor: StoryblokEditor,
  expected: EditExpectation,
) => {
  const article = editor.preview.locator("app-article").last();
  const uid = await article.getAttribute("data-blok-uid");
  if (!uid) throw new Error("Could not find the editable article block");

  const blockUid = uid.slice(uid.indexOf("-") + 1);
  await editor.selectBlock(blockUid, "title");
  const title = editor.textField("title");
  await expect.poll(() => title.getAttribute("id"), { timeout: 15_000 }).toContain(blockUid);

  const value = `QA broker edit ${Date.now()}`;
  const before = await getBrokerState(page);
  await title.fill(value);
  // The edit landing in the preview proves the story now comes from the bridge
  // rather than from the server render, so the relation assertions below are
  // about what the bridge resolved.
  await expect(article).toContainText(value, { timeout: 30_000 });

  await expectRelations(editor, expected.resolved);
  await expectFanOut(page, before, expected.fanOut);
};

for (const [scenario, description] of scenarios) {
  test(`keeps live preview working for ${description}`, async ({ page, request }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    await editor.openStory(await resolveStoryId(QA_CONFIG, request, "live-preview"));
    await expect(editor.preview.locator("body")).not.toContainText("No content found");

    // Taken before any subscription, so the assertion below is about the
    // listeners the broker adds, not about whatever the dev server registers.
    const listenersBeforeSubscribing = await messageListenerCount(page);

    await runScenario(page, scenario);
    const state = await getBrokerState(page);
    expect(state.active).toEqual(expectedSubscribers[scenario]);

    // One bridge per page, whatever the number of subscribers. This is what
    // separates the broker from one-bridge-per-subscriber on `main`.
    await expect.poll(() => messageListenerCount(page)).toBe(listenersBeforeSubscribing + 1);

    await editArticleTitle(page, editor, {
      fanOut: state.active,
      resolved: state.active,
    });
  });
}

test("keeps the remaining subscriber alive and supports re-subscription", async ({
  page,
  request,
}) => {
  const editor = new StoryblokEditor(page, QA_CONFIG);
  await editor.openStory(await resolveStoryId(QA_CONFIG, request, "live-preview"));
  const listenersBeforeSubscribing = await messageListenerCount(page);
  await runScenario(page, "sameTick");

  const frame = await getPreviewFrame(page);
  await frame.evaluate(() => window.__storyblokBrokerQa?.clearA());
  expect((await getBrokerState(page)).active).toEqual(["B"]);

  // Dropping a subscriber must not rebuild the bridge, so the union of relation
  // options survives while only the remaining subscriber is called.
  await editArticleTitle(page, editor, { fanOut: ["B"], resolved: ["A", "B"] });
  await expect.poll(() => messageListenerCount(page)).toBe(listenersBeforeSubscribing + 1);

  await frame.evaluate(() => window.__storyblokBrokerQa?.clear());
  expect((await getBrokerState(page)).active).toEqual([]);

  // `active` is the playground's own bookkeeping, so it cannot show that the
  // bridge went away. The listener returning to its pre-subscription baseline
  // is what proves the last cleanup actually destroyed it.
  await expect.poll(() => messageListenerCount(page)).toBe(listenersBeforeSubscribing);

  // A fresh broker is built from B's options alone, so A's relation is back to
  // an unresolved uuid.
  await frame.evaluate(() => window.__storyblokBrokerQa?.run("singleB"));
  expect((await getBrokerState(page)).active).toEqual(["B"]);
  await expect.poll(() => messageListenerCount(page)).toBe(listenersBeforeSubscribing + 1);
  await editArticleTitle(page, editor, { fanOut: ["B"], resolved: ["B"] });
});
