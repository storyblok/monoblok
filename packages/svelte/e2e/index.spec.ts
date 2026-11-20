import { expect, test } from "@playwright/test";

// The parameters `isInEditor` requires to treat a page as opened by the Visual Editor.
const EDITOR_QUERY = "?_storyblok=1&_storyblok_c=page&_storyblok_tk[space_id]=1";

test.describe("@storyblok/svelte", () => {
  test("should render the teaser block", async ({ page }) => {
    await page.goto("/");

    // `data-blok-c` comes from the block's `_editable` data, so this targets
    // the teaser itself without depending on its headline.
    const teaser = page.locator('article[data-blok-c*=\'"name":"teaser"\']').first();
    await expect(teaser).toHaveText(/\S+/);
  });

  test("should fetch the story only on the server", async ({ page }) => {
    const browserApiRequests: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).hostname.endsWith("storyblok.com")) {
        browserApiRequests.push(request.url());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The teaser comes from the story, so the page rendered it, without the
    // browser fetching the story again during hydration.
    await expect(page.locator('article[data-blok-c*=\'"name":"teaser"\']').first()).toBeVisible();
    expect(browserApiRequests.filter((url) => url.includes("/cdn/stories"))).toEqual([]);
  });

  test("should load the bridge when opened in the Visual Editor", async ({ page }) => {
    await page.goto(`/${EDITOR_QUERY}`);

    await expect
      .poll(() =>
        page.evaluate(() => typeof (window as { StoryblokBridge?: unknown }).StoryblokBridge),
      )
      .toBe("function");
  });

  test("should apply live updates only for the story the page renders", async ({
    page,
    baseURL,
  }) => {
    // The Preview Bridge only listens for editor messages inside an iframe,
    // so host the page in one, as the Visual Editor does.
    await page.setContent(
      `<iframe src="${baseURL}/${EDITOR_QUERY}" width="1200" height="800"></iframe>`,
    );
    const preview = page.frameLocator("iframe");

    // The block's `_editable` data carries the ID of the story it belongs to.
    const blokData = await preview
      .locator('article[data-blok-c*=\'"name":"teaser"\']')
      .first()
      .getAttribute("data-blok-c");
    const storyId = Number(JSON.parse(blokData ?? "{}").id);
    expect(storyId).toBeGreaterThan(0);

    // The bridge applies any `message` with an `action`, the way the Visual
    // Editor posts `input` events to the preview. Messages are handled in
    // order, so once a follow-up message arrives, the update has been handled.
    const previewFrame = await (await preview.owner().elementHandle())?.contentFrame();
    if (!previewFrame) throw new Error("The preview iframe has no frame");
    const sendInput = (id: number, headline: string) =>
      previewFrame.evaluate(
        ({ id, headline }) => {
          window.postMessage(
            {
              action: "input",
              story: {
                id,
                content: {
                  _uid: "e2e-page",
                  component: "page",
                  body: [{ _uid: "e2e-teaser", component: "teaser", headline }],
                  richText: { type: "doc", content: [] },
                },
              },
            },
            "*",
          );
          return new Promise<void>((resolve) => {
            const onMessage = (event: MessageEvent) => {
              if (event.data !== "e2e-handled") return;
              window.removeEventListener("message", onMessage);
              // Let Svelte flush the state change to the DOM.
              requestAnimationFrame(() => resolve());
            };
            window.addEventListener("message", onMessage);
            window.postMessage("e2e-handled", "*");
          });
        },
        { id, headline },
      );

    // Repeat until the bridge has subscribed and the update lands.
    await expect
      .poll(async () => {
        await sendInput(storyId, "Live update for this story");
        return preview.getByText("Live update for this story").isVisible();
      })
      .toBe(true);

    await sendInput(storyId + 1, "Live update for another story");

    await expect(preview.getByText("Live update for another story")).toHaveCount(0);
    await expect(preview.getByText("Live update for this story")).toBeVisible();
  });

  test("should not load the bridge outside the Visual Editor", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(
      await page.evaluate(() => typeof (window as { StoryblokBridge?: unknown }).StoryblokBridge),
    ).toBe("undefined");
  });

  test("should render nested blocks when a block component is imported before its registry", async ({
    page,
  }) => {
    const errors: Error[] = [];
    page.on("pageerror", (error) => errors.push(error));

    await page.goto("/import-cycle");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Rendered through the cycle")).toBeVisible();
    expect(errors).toEqual([]);
  });
});
