export const HIGHLIGHT_ATTRIBUTE = "data-a11y-highlight";

/** Adds the highlight outline styles and returns a function that removes them. */
export function injectHighlightStyles(): () => void {
  const style = document.createElement("style");
  style.textContent = `[${HIGHLIGHT_ATTRIBUTE}] { outline: 3px solid #ff5630 !important; outline-offset: 2px !important; }`;
  document.head.append(style);
  return () => style.remove();
}

export function clearHighlight(): void {
  document.querySelectorAll(`[${HIGHLIGHT_ATTRIBUTE}]`).forEach((element) => {
    element.removeAttribute(HIGHLIGHT_ATTRIBUTE);
  });
}

export function highlight(element: Element): void {
  clearHighlight();
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView?.({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  element.setAttribute(HIGHLIGHT_ATTRIBUTE, "");
}
