// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPreviewHandler } from "../src/live-preview/preview-handler";

describe("createPreviewHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("preserves client-added DOM state (open/aria-expanded/class) across an input update", async () => {
    vi.useFakeTimers();

    document.body.innerHTML = `
      <main data-blok-uid="main">
        <details data-blok-uid="accordion">
          <summary>Toggle</summary>
          <p>Content</p>
        </details>
      </main>
    `;
    const details = document.querySelector("details") as HTMLDetailsElement;
    details.open = true;
    details.setAttribute("aria-expanded", "true");
    details.classList.add("client-added");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          `
            <main data-blok-uid="main">
              <details data-blok-uid="accordion">
                <summary>Toggle</summary>
                <p>Updated content</p>
              </details>
            </main>
          `,
          { status: 200 },
        ),
      ),
    );

    const handler = createPreviewHandler({ debounceMs: 0 });
    await handler.handle({
      action: "input",
      story: { id: 1, content: { component: "page", _uid: "1" } },
    });
    await vi.advanceTimersByTimeAsync(0);
    // Flush the microtasks the fetch/morph chain schedules after the timer fires.
    await Promise.resolve();
    await Promise.resolve();

    const after = document.querySelector("details") as HTMLDetailsElement;
    expect(after.open).toBe(true);
    expect(after.getAttribute("aria-expanded")).toBe("true");
    expect(after.classList.contains("client-added")).toBe(true);
    expect(after.querySelector("p")?.textContent).toBe("Updated content");
  });
});
