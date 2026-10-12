import { isBrowser, isInEditor } from "@storyblok/live-preview";

import { version as pluginVersion } from "../package.json";
import { clearHighlight, highlight } from "./highlight";
import { buildResult } from "./results";
import { accessibilityProtocolVersion } from "./types";

export * from "./types";

/** axe rule tags, such as WCAG conformance levels. Any other axe tag works too. */
export type AccessibilityRuleTag =
  | "wcag2a"
  | "wcag2aa"
  | "wcag2aaa"
  | "wcag21a"
  | "wcag21aa"
  | "wcag22a"
  | "wcag22aa"
  | "best-practice"
  | (string & {});

const DEFAULT_RULE_TAGS: AccessibilityRuleTag[] = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
  "best-practice",
];

// Overlays that @storyblok/preview-bridge appends to the page. Scanning them
// would report the editor's UI instead of the website.
const BRIDGE_OVERLAYS = ["#storyblok__overlay", ".storyblok__hint", ".storyblok__highlight"];

// The Visual Editor runs on an HTTPS host with "storyblok" in its name, such as
// https://app.storyblok.com.
function isStoryblokOrigin(origin: string): boolean {
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === "https:" && hostname.includes("storyblok");
  } catch {
    // Sandboxed frames send the origin "null".
    return false;
  }
}

export type AccessibilityCheckerConfig = {
  /**
   * Origins allowed to request checks in addition to Storyblok's, as exact
   * origins (`"http://localhost:3000"`) or regular expressions. A regular
   * expression must match the whole origin.
   */
  allowedOrigins?: Array<string | RegExp>;
  /**
   * axe rules to run, selected by tag. A rule runs when it has any of the
   * tags. Default: WCAG 2.0, 2.1, and 2.2 levels A and AA, and best practices.
   */
  ruleTags?: AccessibilityRuleTag[];
};

function isMessage(data: unknown, action: string): data is Record<string, unknown> {
  return typeof data === "object" && data !== null && "action" in data && data.action === action;
}

function isInVisualEditor(): boolean {
  return isBrowser() && window.parent !== window && isInEditor(new URL(window.location.href));
}

function getEditorOrigin(isAllowedOrigin: (origin: string) => boolean): string | undefined {
  const origin =
    window.location.ancestorOrigins?.[0] ??
    (document.referrer ? new URL(document.referrer).origin : undefined);
  return origin && isAllowedOrigin(origin) ? origin : undefined;
}

type SharedState = {
  /** Stops the active checker. */
  stop?: () => void;
  /** axe runs one check at a time per page, whichever checker started it. */
  isChecking: boolean;
};

function isSharedState(value: unknown): value is SharedState {
  return typeof value === "object" && value !== null && "isChecking" in value;
}

// Kept on `globalThis` so that a second copy of this module (a duplicate
// install, or a hot reload of the module) can still replace the active checker
// instead of leaving its listener behind, and sees a check it started.
const SHARED_STATE = Symbol.for("@storyblok/accessibility-checker");

function getSharedState(): SharedState {
  const existing: unknown = Reflect.get(globalThis, SHARED_STATE);
  if (isSharedState(existing)) {
    return existing;
  }
  const state: SharedState = { isChecking: false };
  Reflect.set(globalThis, SHARED_STATE, state);
  return state;
}

/**
 * Starts answering the Visual Editor and replaces any other active checker.
 * Returns a function that stops it, or `undefined` outside the Visual Editor.
 */
function startChecker({
  allowedOrigins = [],
  ruleTags = DEFAULT_RULE_TAGS,
}: AccessibilityCheckerConfig): (() => void) | undefined {
  if (!isInVisualEditor()) {
    return undefined;
  }
  const shared = getSharedState();
  shared.stop?.();

  const isAllowedOrigin = (origin: string): boolean =>
    isStoryblokOrigin(origin) ||
    allowedOrigins.some((allowed) =>
      // `match` instead of `test`: it ignores a `g` or `y` flag's `lastIndex`.
      typeof allowed === "string" ? allowed === origin : origin.match(allowed)?.[0] === origin,
    );
  let elements = new Map<string, Element>();
  let isDisabled = false;

  const onMessage = async (event: MessageEvent): Promise<void> => {
    // Only the Visual Editor that embeds this page may talk to the checker.
    if (event.source !== window.parent || !isAllowedOrigin(event.origin)) {
      return;
    }
    const { data } = event;

    if (isMessage(data, "accessibilityHighlight")) {
      // Also for an unknown finding or a removed element, so nothing stale stays outlined.
      clearHighlight();
      const element = typeof data.findingId === "string" ? elements.get(data.findingId) : undefined;
      if (element?.isConnected) {
        highlight(element);
      }
      return;
    }

    if (!isMessage(data, "accessibilityCheck") || typeof data.requestId !== "string") {
      return;
    }
    const reply = (message: object): void => {
      // A check that finishes after the checker stopped has nobody to report to.
      if (isDisabled) {
        return;
      }
      window.parent.postMessage(
        { ...message, requestId: data.requestId, protocolVersion: accessibilityProtocolVersion },
        event.origin,
      );
    };

    if (shared.isChecking) {
      reply({
        action: "accessibilityCheckError",
        error: { code: "check-in-progress", message: "Another check is still running." },
      });
      return;
    }

    shared.isChecking = true;
    clearHighlight();
    try {
      // Lazy import: axe-core is large and must not load until a check is requested.
      const { default: axe } = await import("axe-core");
      // Tags that select no rules (such as typos) would look like a clean page.
      if (axe.getRules(ruleTags).length === 0) {
        throw new Error(`No axe rules have any of the tags: ${ruleTags.join(", ")}.`);
      }
      const results = await axe.run(
        { exclude: BRIDGE_OVERLAYS },
        { runOnly: { type: "tag", values: ruleTags }, elementRef: true },
      );
      if (isDisabled) {
        return;
      }
      const check = buildResult(results, window.location.href);
      elements = check.elements;
      reply({ action: "accessibilityCheckResult", result: check.result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply({ action: "accessibilityCheckError", error: { code: "check-failed", message } });
    } finally {
      shared.isChecking = false;
    }
  };

  window.addEventListener("message", onMessage);

  const editorOrigin = getEditorOrigin(isAllowedOrigin);
  if (editorOrigin) {
    window.parent.postMessage(
      {
        action: "accessibilityReady",
        protocolVersion: accessibilityProtocolVersion,
        pluginVersion,
      },
      editorOrigin,
    );
  }

  const stop = (): void => {
    // Idempotent: a stale `stop` must not clear the highlight of a newer checker.
    if (isDisabled) {
      return;
    }
    isDisabled = true;
    window.removeEventListener("message", onMessage);
    clearHighlight();
    elements = new Map();
    if (shared.stop === stop) {
      shared.stop = undefined;
    }
  };
  shared.stop = stop;
  return stop;
}

export type AccessibilityChecker = {
  /**
   * Starts running checks when the Visual Editor requests them. Does nothing
   * outside the Visual Editor (including on the server) or when already
   * enabled. Replaces any other enabled checker on the page.
   */
  enable: () => void;
  /** Stops listening and removes the highlight. Safe to call at any time. */
  disable: () => void;
};

/**
 * Creates an accessibility checker for the Visual Editor. Nothing happens
 * until `enable()` is called in the browser, and axe-core is loaded only
 * when the editor requests the first check.
 *
 * @example
 * const accessibilityChecker = createAccessibilityChecker({ ruleTags: ["wcag2a", "wcag2aa"] });
 * accessibilityChecker.enable();
 * // later
 * accessibilityChecker.disable();
 */
export function createAccessibilityChecker(
  config: AccessibilityCheckerConfig = {},
): AccessibilityChecker {
  if (config.ruleTags?.length === 0) {
    throw new Error("`ruleTags` must list at least one tag.");
  }
  let stop: (() => void) | undefined;

  return {
    enable: () => {
      // Still the active checker on the page: nothing to do.
      if (stop && getSharedState().stop === stop) {
        return;
      }
      stop = startChecker(config);
    },
    disable: () => {
      stop?.();
      stop = undefined;
    },
  };
}
