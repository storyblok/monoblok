import type { AxeResults, NodeResult, Result } from "axe-core";

import type {
  AccessibilityCategory,
  AccessibilityCategoryId,
  AccessibilityCheckResult,
  AccessibilityFinding,
  AccessibilityFindingStatus,
} from "./types";

// Display order of the A11y tab.
const CATEGORIES: AccessibilityCategoryId[] = [
  "aria",
  "structure",
  "text-alternatives",
  "color",
  "forms",
  "keyboard",
  "language",
  "name-role-value",
  "parsing",
  "semantics",
  "sensory-and-visual-cues",
  "tables",
  "time-and-media",
  "other",
];

const MAX_HTML_LENGTH = 200;

function getCategoryId(tags: string[]): AccessibilityCategoryId {
  const category = tags.find((tag) => tag.startsWith("cat."))?.slice("cat.".length);
  return CATEGORIES.find((id) => id === category) ?? "other";
}

// `storyblokEditable()` writes the block's uid and component name into `data-blok-c`.
function getBlock(element: Element | undefined): { blockUid?: string; componentName?: string } {
  try {
    const { uid, name } = JSON.parse(
      element?.closest("[data-blok-c]")?.getAttribute("data-blok-c") ?? "{}",
    );
    return {
      ...(typeof uid === "string" && { blockUid: uid }),
      ...(typeof name === "string" && { componentName: name }),
    };
  } catch {
    return {};
  }
}

function toFinding(
  rule: Result,
  node: NodeResult,
  status: AccessibilityFindingStatus,
  index: number,
): AccessibilityFinding {
  return {
    id: `${status}-${rule.id}-${index}`,
    ruleId: rule.id,
    title: rule.help,
    description: rule.description,
    helpUrl: rule.helpUrl,
    ...(status !== "passed" && rule.impact && { severity: rule.impact }),
    element: {
      html: node.html.slice(0, MAX_HTML_LENGTH),
      ...getBlock(node.element),
    },
  };
}

export type CheckOutput = {
  result: AccessibilityCheckResult;
  /** Element of each finding, for highlight requests. */
  elements: Map<string, Element>;
};

/**
 * Converts axe results into the result the A11y tab renders: one finding per
 * element, grouped by the rule's `cat.*` tag, in display order.
 */
export function buildResult(
  results: Pick<AxeResults, "violations" | "incomplete" | "passes">,
  url: string,
): CheckOutput {
  const categories = new Map<AccessibilityCategoryId, AccessibilityCategory>();
  const elements = new Map<string, Element>();
  const counts = { violations: 0, warnings: 0, passed: 0 };

  const collect = (rules: Result[], status: AccessibilityFindingStatus): void => {
    for (const rule of rules) {
      const id = getCategoryId(rule.tags);
      rule.nodes.forEach((node, index) => {
        // Created on the first node, so categories without findings never appear.
        const category = categories.get(id) ?? {
          id,
          findings: { violations: [], warnings: [], passed: [] },
        };
        categories.set(id, category);

        const finding = toFinding(rule, node, status, index);
        category.findings[status].push(finding);
        counts[status] += 1;
        if (node.element) {
          elements.set(finding.id, node.element);
        }
      });
    }
  };

  // axe's `inapplicable` outcome has no elements to show and is dropped.
  collect(results.violations, "violations");
  collect(results.incomplete, "warnings");
  collect(results.passes, "passed");

  return {
    result: {
      checkedAt: new Date().toISOString(),
      url,
      totalChecks: counts.violations + counts.warnings + counts.passed,
      counts,
      categories: CATEGORIES.flatMap((id) => categories.get(id) ?? []),
    },
    elements,
  };
}
