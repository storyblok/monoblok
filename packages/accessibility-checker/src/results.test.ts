import type { ImpactValue, Result } from "axe-core";
import { afterEach, describe, expect, it } from "vitest";

import { buildResult } from "./results";

function rule(
  id: string,
  tags: string[],
  impact: ImpactValue,
  nodes: Array<{ html: string; element?: HTMLElement }>,
): Result {
  return {
    id,
    tags,
    impact,
    help: `${id} help`,
    description: `${id} description`,
    helpUrl: `https://dequeuniversity.com/rules/axe/4.14/${id}`,
    nodes: nodes.map((node) => ({ ...node, target: [], any: [], all: [], none: [] })),
  };
}

const URL = "https://example.com/?_storyblok=1";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("buildResult", () => {
  it("should map axe outcomes to buckets with one finding per element", () => {
    const { result } = buildResult(
      {
        violations: [
          rule("image-alt", ["cat.text-alternatives"], "critical", [
            { html: "<img>" },
            { html: "<img>" },
          ]),
        ],
        incomplete: [rule("color-contrast", ["cat.color"], "serious", [{ html: "<p></p>" }])],
        passes: [rule("button-name", ["cat.name-role-value"], null, [{ html: "<button>" }])],
      },
      URL,
    );

    expect(result.url).toBe(URL);
    expect(result.counts).toEqual({ violations: 2, warnings: 1, passed: 1 });
    expect(result.totalChecks).toBe(4);
    const category = (id: string) => result.categories.find((category) => category.id === id);
    expect(category("text-alternatives")?.findings.violations.map(({ id }) => id)).toEqual([
      "violations-image-alt-0",
      "violations-image-alt-1",
    ]);
    expect(category("color")?.findings.warnings[0]?.severity).toBe("serious");
  });

  it("should order categories for display, drop empty ones, and fall back to other", () => {
    const { result } = buildResult(
      {
        violations: [
          rule("no-category", ["wcag2a"], "minor", [{ html: "<div>" }]),
          rule("tables-rule", ["cat.tables"], "minor", [{ html: "<td>" }]),
          rule("no-nodes", ["cat.forms"], "minor", []),
          rule("aria-rule", ["cat.aria"], "minor", [{ html: "<div>" }]),
        ],
        incomplete: [],
        passes: [],
      },
      URL,
    );

    expect(result.categories.map(({ id }) => id)).toEqual(["aria", "tables", "other"]);
  });

  it("should truncate html and omit severity for passed findings or a null impact", () => {
    const { result } = buildResult(
      {
        violations: [rule("long", ["cat.aria"], null, [{ html: `<p>${"a".repeat(300)}</p>` }])],
        incomplete: [],
        passes: [rule("ok", ["cat.aria"], "critical", [{ html: "<p>" }])],
      },
      URL,
    );
    const [violation] = result.categories[0]?.findings.violations ?? [];
    const [passed] = result.categories[0]?.findings.passed ?? [];

    expect(violation?.element.html).toHaveLength(200);
    expect(violation).not.toHaveProperty("severity");
    expect(passed).not.toHaveProperty("severity");
  });

  it("should add the block of the element, if it has one", () => {
    document.body.innerHTML = `
      <section data-blok-c='{"uid":"abc","name":"hero"}'>
        <img id="in-block" src="/hero.jpg">
      </section>
      <img id="outside" src="/footer.jpg">`;
    const inBlock = document.querySelector<HTMLElement>("#in-block") ?? undefined;
    const outside = document.querySelector<HTMLElement>("#outside") ?? undefined;

    const { result, elements } = buildResult(
      {
        violations: [
          rule("image-alt", ["cat.text-alternatives"], "critical", [
            { html: "<img>", element: inBlock },
            { html: "<img>", element: outside },
          ]),
        ],
        incomplete: [],
        passes: [],
      },
      URL,
    );
    const [first, second] = result.categories[0]?.findings.violations ?? [];

    expect(first?.element).toEqual({ html: "<img>", blockUid: "abc", componentName: "hero" });
    expect(second?.element).toEqual({ html: "<img>" });
    expect(elements.get("violations-image-alt-0")).toBe(inBlock);
  });
});
