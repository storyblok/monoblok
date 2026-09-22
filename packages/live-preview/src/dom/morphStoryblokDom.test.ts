import { describe, expect, it } from "vitest";
import { morphStoryblokDom } from "./morphStoryblokDom";

describe("morphStoryblokDom", () => {
  it("morphs only the focused Storyblok block", () => {
    document.body.innerHTML = `
      <main>
        <section data-blok-uid="hero" data-blok-focused="true"><h1>Before</h1></section>
        <p id="outside">Outside before</p>
      </main>
    `;
    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main>
        <section data-blok-uid="hero"><h1>After</h1></section>
        <p id="outside">Outside after</p>
      </main>
    `;

    const result = morphStoryblokDom(document.body, nextBody);

    expect(result).toEqual({ scope: "focused" });
    expect(document.querySelector('[data-blok-uid="hero"]')?.textContent).toContain("After");
    expect(document.querySelector("#outside")?.textContent).toBe("Outside before");
  });

  it("updates the full root when the focused block no longer exists", () => {
    document.body.innerHTML = `
      <main>
        <section data-blok-uid="removed" data-blok-focused="true">Before</section>
        <p id="outside">Outside before</p>
      </main>
    `;
    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main>
        <section data-blok-uid="new">New block</section>
        <p id="outside">Outside after</p>
      </main>
    `;

    const result = morphStoryblokDom(document.body, nextBody);

    expect(result).toEqual({ scope: "root" });
    expect(document.querySelector('[data-blok-uid="removed"]')).toBeNull();
    expect(document.querySelector('[data-blok-uid="new"]')?.textContent).toBe("New block");
    expect(document.querySelector("#outside")?.textContent).toBe("Outside after");
  });

  it("preserves interactive state and matching block attributes", () => {
    document.body.innerHTML = `
      <main data-blok-uid="main">
        <input data-blok-uid="input" data-preserve-state checked />
        <div data-blok-uid="block" data-client-state="open">Before</div>
      </main>
    `;
    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main data-blok-uid="main">
        <input data-blok-uid="input" data-preserve-state />
        <div data-blok-uid="block">After</div>
      </main>
    `;

    morphStoryblokDom(document.body, nextBody);

    expect(document.querySelector<HTMLInputElement>('[data-blok-uid="input"]')?.checked).toBe(true);
    expect(
      document.querySelector('[data-blok-uid="block"]')?.getAttribute("data-client-state"),
    ).toBe("open");
    expect(document.querySelector('[data-blok-uid="block"]')?.textContent).toBe("After");
  });

  it("accepts a focused element explicitly", () => {
    document.body.innerHTML = `
      <main><section data-key="hero"><p>Before</p></section><p id="outside">Before</p></main>
    `;
    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main><section data-key="hero"><p>After</p></section><p id="outside">After</p></main>
    `;

    const result = morphStoryblokDom(document.body, nextBody, {
      focusedElement: document.querySelector("[data-key=hero]"),
      keyAttribute: "data-key",
      focusedAttribute: "data-focused",
    });

    expect(result).toEqual({ scope: "focused" });
    expect(document.querySelector("[data-key=hero]")?.textContent).toBe("After");
    expect(document.querySelector("#outside")?.textContent).toBe("Before");
  });
});
