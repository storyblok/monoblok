/**
 * Ad-hoc benchmark reproducing the methodology from PR #823's review
 * comments: compares this implementation (querySelector-based focus/key
 * lookup) against a full-root plain morphdom call, at a few tree sizes.
 *
 * Not part of the regular suite (uses `console.log` for human-readable
 * output, not assertions). Run manually with:
 *   pnpm vitest run scripts/benchmark-morph.manual.ts
 * when touching morph performance.
 */
import { describe, it } from "vitest";
import morphdom from "morphdom";
import { morphStoryblokDom } from "../src/dom/morph-storyblok-dom";

function buildTree(size: number, focusedIndex: number): string {
  const items: string[] = [];
  for (let i = 0; i < size; i++) {
    const focused = i === focusedIndex ? ' data-blok-focused="true"' : "";
    items.push(
      `<div data-blok-uid="item-${i}"${focused}><span>Item ${i}</span><a href="/link-${i}">link</a></div>`,
    );
  }
  return items.join("");
}

function buildNextTree(size: number): string {
  const items: string[] = [];
  for (let i = 0; i < size; i++) {
    items.push(
      `<div data-blok-uid="item-${i}"><span>Item ${i} updated</span><a href="/link-${i}-new">link</a></div>`,
    );
  }
  return items.join("");
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function time(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function freshBody(html: string): HTMLElement {
  const body = document.implementation.createHTMLDocument().body;
  body.innerHTML = html;
  return body;
}

function run(size: number, runs = 7): void {
  const focusedTimes: number[] = [];
  const noFocusTimes: number[] = [];
  const fullRootTimes: number[] = [];

  for (let i = 0; i < runs; i++) {
    // This PR, focused.
    {
      const current = freshBody(buildTree(size, Math.floor(size / 2)));
      const next = freshBody(buildNextTree(size));
      focusedTimes.push(time(() => morphStoryblokDom(current, next)));
    }

    // This PR, no focus (falls back to full-root morph).
    {
      const current = freshBody(buildTree(size, -1));
      const next = freshBody(buildNextTree(size));
      noFocusTimes.push(time(() => morphStoryblokDom(current, next)));
    }

    // Plain morphdom, full root (uid keys only, no focused-subtree logic).
    {
      const current = freshBody(buildTree(size, -1));
      const next = freshBody(buildNextTree(size));
      fullRootTimes.push(
        time(() =>
          morphdom(current, next, {
            getNodeKey: (node) =>
              node.nodeType === 1
                ? ((node as Element).getAttribute("data-blok-uid") ?? undefined)
                : undefined,
          }),
        ),
      );
    }
  }

  // eslint-disable-next-line no-console -- intentional benchmark output
  console.log(
    `${size.toString().padStart(6)} elements | focused: ${median(focusedTimes).toFixed(2).padStart(7)}ms` +
      ` | no-focus: ${median(noFocusTimes).toFixed(2).padStart(7)}ms` +
      ` | plain morphdom full-root: ${median(fullRootTimes).toFixed(2).padStart(7)}ms`,
  );
}

describe.skip("morph-storyblok-dom benchmark (manual)", () => {
  it("reports median morph time at a few tree sizes", () => {
    // eslint-disable-next-line no-console -- intentional benchmark output
    console.log("\nMedian of 5 runs, jsdom environment:\n");
    for (const size of [2000, 10000]) {
      run(size, 5);
    }
  }, 60_000);
});
