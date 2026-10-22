import axe from "axe-core";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

import { type AccessibilityChecker, createAccessibilityChecker } from "./index";
import type { AccessibilityCheckResultMessage } from "./types";

const EDITOR_ORIGIN = "https://app.storyblok.com";

const PAGE = `
  <main>
    <section data-blok-c='{"uid":"abc","name":"hero"}'>
      <img src="https://a.storyblok.com/f/1/hero.jpg">
    </section>
  </main>
  <div id="storyblok__overlay"><img src="/bridge-icon.png"></div>`;

describe("createAccessibilityChecker", () => {
  it("should reject an empty list of rule tags", () => {
    expect(() => createAccessibilityChecker({ ruleTags: [] })).toThrow("ruleTags");
  });
});

describe("outside the Visual Editor", () => {
  it("should do nothing and register no listener", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");

    createAccessibilityChecker().enable();
    expect(addEventListener).not.toHaveBeenCalledWith("message", expect.anything());
    addEventListener.mockRestore();
  });
});

describe("inside the Visual Editor", () => {
  // In jsdom the page is the top window, so an iframe's window stands in for the editor.
  let editor: Window;
  let postMessage: MockInstance<Window["postMessage"]>;

  const send = (data: unknown, { origin = EDITOR_ORIGIN, source = editor } = {}): void => {
    window.dispatchEvent(new MessageEvent("message", { data, origin, source }));
  };
  const messages = (): unknown[] => postMessage.mock.calls.map(([message]) => message);
  const waitForReply = (requestId: string): Promise<AccessibilityCheckResultMessage> =>
    vi.waitFor(
      () => {
        const reply = messages().find(
          (message): message is AccessibilityCheckResultMessage =>
            typeof message === "object" &&
            message !== null &&
            "requestId" in message &&
            message.requestId === requestId,
        );
        if (!reply) {
          throw new Error(`No reply to ${requestId} yet`);
        }
        return reply;
      },
      { timeout: 10_000 },
    );

  let checker: AccessibilityChecker;

  beforeAll(() => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    editor = iframe.contentWindow!;
    postMessage = vi.spyOn(editor, "postMessage").mockImplementation(() => {});
    vi.spyOn(window, "parent", "get").mockReturnValue(editor);
    vi.spyOn(document, "referrer", "get").mockReturnValue(`${EDITOR_ORIGIN}/`);
    window.history.replaceState(
      null,
      "",
      "/?_storyblok=1&_storyblok_c=page&_storyblok_tk[space_id]=1",
    );
  });

  beforeEach(() => {
    checker = createAccessibilityChecker({
      allowedOrigins: ["http://localhost:3000", /http:\/\/localhost:\d+/g],
      ruleTags: ["wcag2a", "wcag2aa"],
    });
    checker.enable();
  });

  afterEach(() => {
    checker.disable();
    postMessage.mockClear();
    document.body.innerHTML = "";
  });

  it("should announce itself to the editor on start", () => {
    expect(postMessage).toHaveBeenCalledWith(
      { action: "accessibilityReady", protocolVersion: 1, packageVersion: expect.any(String) },
      EDITOR_ORIGIN,
    );
  });

  it("should answer a ping with ready, on the origin of the ping", () => {
    postMessage.mockClear();
    send({ action: "accessibilityPing" }, { origin: "http://localhost:3000" });

    expect(postMessage).toHaveBeenCalledWith(
      { action: "accessibilityReady", protocolVersion: 1, packageVersion: expect.any(String) },
      "http://localhost:3000",
    );
  });

  it("should answer a ping even when the parent origin was unknown on start", () => {
    checker.disable();
    postMessage.mockClear();
    // Without `ancestorOrigins` (Firefox), the parent origin comes from the referrer, which a
    // navigation inside the iframe replaces with the site's own URL.
    const referrer = vi.spyOn(document, "referrer", "get");
    referrer.mockReturnValue("https://site.example/previous-page");
    checker.enable();
    referrer.mockReturnValue(`${EDITOR_ORIGIN}/`);
    expect(postMessage).not.toHaveBeenCalled();

    send({ action: "accessibilityPing" });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: "accessibilityReady" }),
      EDITOR_ORIGIN,
    );
  });

  it("should ignore a ping from another origin or window", () => {
    postMessage.mockClear();
    send({ action: "accessibilityPing" }, { origin: "https://evil-storyblok.io" });
    send({ action: "accessibilityPing" }, { source: window });

    expect(postMessage).not.toHaveBeenCalled();
  });

  const repliesTo = (requestId: string): unknown[] =>
    messages().filter(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        "requestId" in message &&
        message.requestId === requestId,
    );
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 50));

  it("should remove its listener when disabled, and enable again", async () => {
    checker.disable();
    send({ action: "accessibilityCheck", requestId: "after-disable" });
    await settle();

    expect(repliesTo("after-disable")).toEqual([]);

    checker.enable();
    send({ action: "accessibilityCheck", requestId: "after-enable" });
    await waitForReply("after-enable");
  });

  it("should register one listener when enabled twice", async () => {
    checker.enable();
    send({ action: "accessibilityCheck", requestId: "twice" });
    await waitForReply("twice");
    await settle();

    expect(repliesTo("twice")).toHaveLength(1);
  });

  it("should leave a newer checker alone when an older one is disabled", async () => {
    const older = checker;
    checker = createAccessibilityChecker();
    checker.enable();

    older.disable();
    send({ action: "accessibilityCheck", requestId: "newer" });
    await waitForReply("newer");
    await settle();

    expect(repliesTo("newer")).toHaveLength(1);
  });

  it("should reject a check while a replaced checker's check is still running", async () => {
    send({ action: "accessibilityCheck", requestId: "before-swap" });
    checker.disable();
    checker = createAccessibilityChecker();
    checker.enable();
    send({ action: "accessibilityCheck", requestId: "after-swap" });

    expect(await waitForReply("after-swap")).toMatchObject({
      action: "accessibilityCheckError",
      error: { code: "check-in-progress" },
    });
  });

  it("should replace a checker enabled by another copy of the module", async () => {
    vi.resetModules();
    const copy = (await import("./index")).createAccessibilityChecker();
    copy.enable();
    send({ action: "accessibilityCheck", requestId: "copy" });
    await waitForReply("copy");
    await settle();

    expect(repliesTo("copy")).toHaveLength(1);
    copy.disable();
  });

  it("should run axe and reply with the findings for the request", async () => {
    document.body.innerHTML = PAGE;
    send({ action: "accessibilityCheck", requestId: "r1" });
    const { result } = await waitForReply("r1");
    const imageAlt = result.categories
      .flatMap(({ findings }) => findings.violations)
      .filter(({ ruleId }) => ruleId === "image-alt");
    const [major, minor] = axe.version.split(".");

    // The image inside the Bridge overlay is not reported.
    expect(imageAlt).toEqual([
      {
        id: "violations-image-alt-0",
        ruleId: "image-alt",
        title: "Images must have alternative text",
        description:
          "Ensure <img> elements have alternative text or a role of none or presentation",
        helpUrl: expect.stringContaining(`/axe/${major}.${minor}/image-alt`),
        severity: "critical",
        element: {
          html: '<img src="https://a.storyblok.com/f/1/hero.jpg">',
          blockUid: "abc",
          componentName: "hero",
        },
      },
    ]);
  });

  it("should run only the rules with the configured tags", async () => {
    const run = vi.spyOn(axe, "run");
    send({ action: "accessibilityCheck", requestId: "tags" });
    const { result } = await waitForReply("tags");
    const ruleIds = result.categories.flatMap(({ findings }) =>
      Object.values(findings).flatMap((list) => list.map(({ ruleId }) => ruleId)),
    );
    const allowed = new Set(axe.getRules(["wcag2a", "wcag2aa"]).map(({ ruleId }) => ruleId));

    expect(run).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } }),
    );
    expect(result.ruleTags).toEqual(["wcag2a", "wcag2aa"]);
    expect(ruleIds.every((ruleId) => allowed.has(ruleId))).toBe(true);
    run.mockRestore();
  });

  it("should fail a check when the rule tags select no rules", async () => {
    checker = createAccessibilityChecker({ ruleTags: ["wcag2aaaa"] });
    checker.enable();
    send({ action: "accessibilityCheck", requestId: "unknown-tag" });

    expect(await waitForReply("unknown-tag")).toMatchObject({
      action: "accessibilityCheckError",
      error: { code: "check-failed", message: "No axe rules have any of the tags: wcag2aaaa." },
    });
  });

  it("should reject a second check while one is running", async () => {
    send({ action: "accessibilityCheck", requestId: "first" });
    send({ action: "accessibilityCheck", requestId: "second" });

    expect(await waitForReply("second")).toMatchObject({
      action: "accessibilityCheckError",
      error: { code: "check-in-progress" },
    });
    expect(await waitForReply("first")).toMatchObject({ action: "accessibilityCheckResult" });
  });

  it("should ignore messages from other origins and windows", async () => {
    send(
      { action: "accessibilityCheck", requestId: "foreign" },
      { origin: "https://evil.example" },
    );
    send(
      { action: "accessibilityCheck", requestId: "insecure" },
      { origin: "http://app.storyblok.com" },
    );
    send({ action: "accessibilityCheck", requestId: "sandboxed" }, { origin: "null" });
    send({ action: "accessibilityCheck", requestId: "self" }, { source: window });
    send(
      { action: "accessibilityCheck", requestId: "lookalike" },
      { origin: "https://evil-storyblok.io" },
    );
    send(
      { action: "accessibilityCheck", requestId: "suffixed" },
      { origin: "https://app.storyblok.com.evil.example" },
    );
    await settle();

    for (const requestId of ["foreign", "insecure", "sandboxed", "self", "lookalike", "suffixed"]) {
      expect(messages()).not.toContainEqual(expect.objectContaining({ requestId }));
    }
  });

  it("should accept checks from an extra allowed origin", async () => {
    send({ action: "accessibilityCheck", requestId: "local" }, { origin: "http://localhost:3000" });
    await waitForReply("local");

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: "accessibilityCheckResult", requestId: "local" }),
      "http://localhost:3000",
    );
  });

  it("should match a regular expression against the whole origin, on every request", async () => {
    send(
      { action: "accessibilityCheck", requestId: "regex-1" },
      { origin: "http://localhost:4000" },
    );
    await waitForReply("regex-1");
    send(
      { action: "accessibilityCheck", requestId: "regex-2" },
      { origin: "http://localhost:4000" },
    );
    await waitForReply("regex-2");
    send(
      { action: "accessibilityCheck", requestId: "regex-partial" },
      { origin: "http://localhost:4000.evil.example" },
    );
    await settle();

    expect(repliesTo("regex-partial")).toEqual([]);
  });
});
