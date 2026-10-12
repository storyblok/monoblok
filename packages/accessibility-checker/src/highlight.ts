// Inline styles instead of an injected stylesheet, so the highlight also works
// under a Content Security Policy without `style-src 'unsafe-inline'`.
const HIGHLIGHT_STYLES: Record<string, string> = {
  outline: "3px solid #ff5630",
  "outline-offset": "2px",
};

let restoreHighlighted: (() => void) | undefined;

export function clearHighlight(): void {
  restoreHighlighted?.();
  restoreHighlighted = undefined;
}

export function highlight(element: Element): void {
  clearHighlight();
  if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
    return;
  }
  const { style } = element;
  // Remember the element's own inline values, so clearing restores them.
  const previous = Object.keys(HIGHLIGHT_STYLES).map((property) => ({
    property,
    value: style.getPropertyValue(property),
    priority: style.getPropertyPriority(property),
  }));
  for (const [property, value] of Object.entries(HIGHLIGHT_STYLES)) {
    style.setProperty(property, value, "important");
  }
  restoreHighlighted = () => {
    for (const { property, value, priority } of previous) {
      if (value) {
        style.setProperty(property, value, priority);
      } else {
        style.removeProperty(property);
      }
    }
  };

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView?.({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
}
