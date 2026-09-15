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

type BrokerQaState = {
  active: string[];
  updatesA: number;
  updatesB: number;
};

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    if (location.origin === "https://localhost:4200") {
      localStorage.setItem("storyblok-live-preview-qa", "true");
    }
  });
});

declare global {
  interface Window {
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

const editArticleTitle = async (page: import("@playwright/test").Page, editor: StoryblokEditor) => {
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
  await expect(article).toContainText(value, { timeout: 30_000 });

  await expect
    .poll(
      async () => {
        const after = await getBrokerState(page);
        return Math.max(after.updatesA - before.updatesA, after.updatesB - before.updatesB);
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
};

for (const [scenario, description] of scenarios) {
  test(`keeps live preview working for ${description}`, async ({ page, request }) => {
    const editor = new StoryblokEditor(page, QA_CONFIG);
    await editor.openStory(await resolveStoryId(QA_CONFIG, request, "angular/live-preview-qa"));
    await expect(editor.preview.locator("body")).not.toContainText("No content found");

    await runScenario(page, scenario);
    const state = await getBrokerState(page);
    expect(state.active).toHaveLength(scenario === "singleA" || scenario === "singleB" ? 1 : 2);

    await editArticleTitle(page, editor);
  });
}

test("keeps the remaining subscriber alive and supports re-subscription", async ({
  page,
  request,
}) => {
  const editor = new StoryblokEditor(page, QA_CONFIG);
  await editor.openStory(await resolveStoryId(QA_CONFIG, request, "angular/live-preview-qa"));
  await runScenario(page, "sameTick");

  const frame = await getPreviewFrame(page);
  await frame.evaluate(() => window.__storyblokBrokerQa?.clearA());
  expect((await getBrokerState(page)).active).toEqual(["B"]);

  await editArticleTitle(page, editor);

  await frame.evaluate(() => window.__storyblokBrokerQa?.clear());
  expect((await getBrokerState(page)).active).toEqual([]);

  await frame.evaluate(() => window.__storyblokBrokerQa?.run("singleB"));
  expect((await getBrokerState(page)).active).toEqual(["B"]);
  await editArticleTitle(page, editor);
});
