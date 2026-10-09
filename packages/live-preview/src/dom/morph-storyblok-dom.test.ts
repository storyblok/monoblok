import { describe, expect, it, vi } from "vitest";
import { morphStoryblokDom } from "./morph-storyblok-dom";

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

  it('does not treat data-blok-focused="false" as focused', () => {
    document.body.innerHTML = `
      <main>
        <section data-blok-uid="hero" data-blok-focused="false"><h1>Before</h1></section>
        <footer id="outside">Outside before</footer>
      </main>
    `;
    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main>
        <section data-blok-uid="hero"><h1>After</h1></section>
        <footer id="outside">Outside after</footer>
      </main>
    `;

    const result = morphStoryblokDom(document.body, nextBody);

    expect(result).toEqual({ scope: "root" });
    expect(document.querySelector("#outside")?.textContent).toBe("Outside after");
  });

  it("falls back to a full-root morph when an explicit focusedElement is outside currentRoot", () => {
    document.body.innerHTML = `
      <section data-blok-uid="hero">Before</section>
      <main><section data-blok-uid="scoped">Before scoped</section></main>
    `;
    const outsideFocused = document.querySelector('[data-blok-uid="hero"]') as Element;
    const scopedRoot = document.querySelector("main") as Element;

    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `<main><section data-blok-uid="scoped">After scoped</section></main>`;
    const nextRoot = nextBody.querySelector("main") as Element;

    const result = morphStoryblokDom(scopedRoot, nextRoot, {
      focusedElement: outsideFocused,
    });

    expect(result).toEqual({ scope: "root" });
    expect(scopedRoot.textContent).toBe("After scoped");
  });

  it("applies server attribute changes by default (preserveElementAttributes is opt-in)", () => {
    document.body.innerHTML = `
      <main data-blok-uid="main">
        <img data-blok-uid="image" src="old.png" />
        <a data-blok-uid="link" href="/old" target="_blank">Link</a>
      </main>
    `;
    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main data-blok-uid="main">
        <img data-blok-uid="image" src="new.png" />
        <a data-blok-uid="link" href="/new">Link</a>
      </main>
    `;

    morphStoryblokDom(document.body, nextBody);

    expect(document.querySelector('[data-blok-uid="image"]')?.getAttribute("src")).toBe("new.png");
    expect(document.querySelector('[data-blok-uid="link"]')?.getAttribute("href")).toBe("/new");
    expect(document.querySelector('[data-blok-uid="link"]')?.hasAttribute("target")).toBe(false);
  });

  it("preserves matching block attributes when preserveElementAttributes is enabled", () => {
    document.body.innerHTML = `
      <main data-blok-uid="main">
        <div data-blok-uid="block" data-client-state="open">Before</div>
      </main>
    `;
    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main data-blok-uid="main">
        <div data-blok-uid="block">After</div>
      </main>
    `;

    morphStoryblokDom(document.body, nextBody, { preserveElementAttributes: true });

    expect(
      document.querySelector('[data-blok-uid="block"]')?.getAttribute("data-client-state"),
    ).toBe("open");
    expect(document.querySelector('[data-blok-uid="block"]')?.textContent).toBe("After");
  });

  it("skips elements marked with the preserve-state attribute entirely", () => {
    document.body.innerHTML = `
      <main data-blok-uid="main">
        <input data-blok-uid="input" data-preserve-state checked />
      </main>
    `;
    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main data-blok-uid="main">
        <input data-blok-uid="input" />
      </main>
    `;

    morphStoryblokDom(document.body, nextBody);

    expect(document.querySelector<HTMLInputElement>('[data-blok-uid="input"]')?.checked).toBe(true);
  });

  it("treats a framework-island subtree marked with preserve-state as opaque", () => {
    // Reproduces the scenario from PR #823's review: a hydrated island whose
    // client framework owns its DOM. The server re-renders its host element
    // with stale `props` and different inner markup, but since it's marked
    // opaque, neither the attribute nor the framework-owned children change.
    document.body.innerHTML = `
      <main data-blok-uid="main">
        <astro-island data-blok-uid="island" props='{"count":6}' data-preserve-state>
          <button>Clicked: 6</button>
        </astro-island>
      </main>
    `;
    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main data-blok-uid="main">
        <astro-island data-blok-uid="island" props='{"count":100}'>
          <button>Clicked: 100</button>
        </astro-island>
      </main>
    `;

    morphStoryblokDom(document.body, nextBody);

    const island = document.querySelector('[data-blok-uid="island"]');
    expect(island?.getAttribute("props")).toBe('{"count":6}');
    expect(island?.querySelector("button")?.textContent).toBe("Clicked: 6");
  });

  it("keeps a focused input's typed value instead of reverting to the next tree's default", () => {
    document.body.innerHTML = `
      <main data-blok-uid="main"><input data-blok-uid="input" value="server default" /></main>
    `;
    const input = document.querySelector<HTMLInputElement>('[data-blok-uid="input"]');
    // Simulate the user typing — this only changes the live `.value` property,
    // never the `value` attribute.
    input!.value = "user typed this";

    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main data-blok-uid="main"><input data-blok-uid="input" value="new server default" /></main>
    `;

    morphStoryblokDom(document.body, nextBody);

    expect(document.querySelector<HTMLInputElement>('[data-blok-uid="input"]')?.value).toBe(
      "user typed this",
    );
  });

  it("keeps a focused textarea's typed value instead of applying the next tree's value", () => {
    document.body.innerHTML = `
      <main data-blok-uid="main"><textarea data-blok-uid="textarea">server default</textarea></main>
    `;
    const textarea = document.querySelector<HTMLTextAreaElement>('[data-blok-uid="textarea"]');
    textarea!.value = "user typed this";

    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main data-blok-uid="main"><textarea data-blok-uid="textarea">new server default</textarea></main>
    `;

    morphStoryblokDom(document.body, nextBody);

    expect(document.querySelector<HTMLTextAreaElement>('[data-blok-uid="textarea"]')?.value).toBe(
      "user typed this",
    );
  });

  it("keeps a user-checked checkbox checked", () => {
    document.body.innerHTML = `
      <main data-blok-uid="main"><input type="checkbox" data-blok-uid="checkbox" /></main>
    `;
    const checkbox = document.querySelector<HTMLInputElement>('[data-blok-uid="checkbox"]');
    checkbox!.checked = true;

    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main data-blok-uid="main"><input type="checkbox" data-blok-uid="checkbox" /></main>
    `;

    morphStoryblokDom(document.body, nextBody);

    expect(document.querySelector<HTMLInputElement>('[data-blok-uid="checkbox"]')?.checked).toBe(
      true,
    );
  });

  it("applies a legitimate server default change to an input the user never touched", () => {
    document.body.innerHTML = `
      <main data-blok-uid="main"><input data-blok-uid="input" value="old server default" /></main>
    `;
    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main data-blok-uid="main"><input data-blok-uid="input" value="new server default" /></main>
    `;

    morphStoryblokDom(document.body, nextBody);

    expect(document.querySelector<HTMLInputElement>('[data-blok-uid="input"]')?.value).toBe(
      "new server default",
    );
  });

  it("applies a legitimate server default change to a textarea the user never touched", () => {
    document.body.innerHTML = `
      <main data-blok-uid="main"><textarea data-blok-uid="textarea">old server default</textarea></main>
    `;
    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main data-blok-uid="main"><textarea data-blok-uid="textarea">new server default</textarea></main>
    `;

    morphStoryblokDom(document.body, nextBody);

    expect(document.querySelector<HTMLTextAreaElement>('[data-blok-uid="textarea"]')?.value).toBe(
      "new server default",
    );
  });

  it("applies a legitimate server default change to an unchecked checkbox", () => {
    document.body.innerHTML = `
      <main data-blok-uid="main"><input type="checkbox" data-blok-uid="checkbox" /></main>
    `;
    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main data-blok-uid="main"><input type="checkbox" data-blok-uid="checkbox" checked /></main>
    `;

    morphStoryblokDom(document.body, nextBody);

    expect(document.querySelector<HTMLInputElement>('[data-blok-uid="checkbox"]')?.checked).toBe(
      true,
    );
  });

  it("keeps a user-selected option selected, but applies an untouched select's new default", () => {
    document.body.innerHTML = `
      <main data-blok-uid="main">
        <select data-blok-uid="touched">
          <option value="a" selected>A</option>
          <option value="b">B</option>
        </select>
        <select data-blok-uid="untouched">
          <option value="a" selected>A</option>
          <option value="b">B</option>
        </select>
      </main>
    `;
    const touched = document.querySelector<HTMLSelectElement>('[data-blok-uid="touched"]');
    touched!.value = "b";

    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main data-blok-uid="main">
        <select data-blok-uid="touched">
          <option value="a" selected>A</option>
          <option value="b">B</option>
        </select>
        <select data-blok-uid="untouched">
          <option value="a">A</option>
          <option value="b" selected>B</option>
        </select>
      </main>
    `;

    morphStoryblokDom(document.body, nextBody);

    // The user picked "b"; the server still defaults to "a" — the user's pick wins.
    expect(document.querySelector<HTMLSelectElement>('[data-blok-uid="touched"]')?.value).toBe("b");
    // Nobody touched this one; the server's new default ("b") applies.
    expect(document.querySelector<HTMLSelectElement>('[data-blok-uid="untouched"]')?.value).toBe(
      "b",
    );
  });

  it("falls back to id-based keying when the key attribute is absent", () => {
    document.body.innerHTML = `
      <main data-blok-uid="main">
        <ul>
          <li id="a"><input value="a" /></li>
          <li id="b"><input value="b" /></li>
          <li id="c"><input value="c" /></li>
        </ul>
      </main>
    `;
    const inputA = document.querySelector<HTMLInputElement>("#a input");
    inputA!.value = "typed in a";

    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main data-blok-uid="main">
        <ul>
          <li id="c"><input value="c" /></li>
          <li id="a"><input value="a" /></li>
          <li id="b"><input value="b" /></li>
        </ul>
      </main>
    `;

    morphStoryblokDom(document.body, nextBody);

    expect(document.querySelector<HTMLInputElement>("#a input")?.value).toBe("typed in a");
  });

  it("matches nodes from a different realm when keying and finding the focused element", () => {
    document.body.innerHTML = `
      <main>
        <section data-blok-uid="hero" data-blok-focused="true"><h1>Before</h1></section>
        <p id="outside">Outside before</p>
      </main>
    `;

    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const otherDocument = iframe.contentDocument as Document;
    otherDocument.body.innerHTML = `
      <main>
        <section data-blok-uid="hero"><h1>After</h1></section>
        <p id="outside">Outside after</p>
      </main>
    `;
    const nextRoot = otherDocument.body;
    // Sanity check: nextRoot elements are not `instanceof` this realm's Element.
    expect(nextRoot instanceof Element).toBe(false);

    const result = morphStoryblokDom(document.body, nextRoot);

    expect(result).toEqual({ scope: "focused" });
    expect(document.querySelector('[data-blok-uid="hero"]')?.textContent).toContain("After");

    iframe.remove();
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

  it("skips the morph entirely when the root tree is already identical", () => {
    document.body.innerHTML = `
      <main data-blok-uid="main"><p data-blok-uid="text">Same</p></main>
    `;
    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main data-blok-uid="main"><p data-blok-uid="text">Same</p></main>
    `;
    const onBeforeElUpdated = vi.fn();

    const result = morphStoryblokDom(document.body, nextBody, { onBeforeElUpdated });

    expect(result).toEqual({ scope: "root" });
    expect(onBeforeElUpdated).not.toHaveBeenCalled();
  });

  it("skips the morph entirely when the focused subtree is already identical", () => {
    document.body.innerHTML = `
      <main>
        <section data-blok-uid="hero" data-blok-focused="true"><h1>Same</h1></section>
      </main>
    `;
    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main>
        <section data-blok-uid="hero"><h1>Same</h1></section>
      </main>
    `;
    const onBeforeElUpdated = vi.fn();

    const result = morphStoryblokDom(document.body, nextBody, { onBeforeElUpdated });

    expect(result).toEqual({ scope: "focused" });
    expect(onBeforeElUpdated).not.toHaveBeenCalled();
  });

  it("still morphs when trees differ even slightly", () => {
    document.body.innerHTML = `
      <main data-blok-uid="main"><p data-blok-uid="text" class="a">Same text</p></main>
    `;
    const nextBody = document.implementation.createHTMLDocument().body;
    nextBody.innerHTML = `
      <main data-blok-uid="main"><p data-blok-uid="text" class="b">Same text</p></main>
    `;

    morphStoryblokDom(document.body, nextBody);

    expect(document.querySelector('[data-blok-uid="text"]')?.className).toBe("b");
  });
});
