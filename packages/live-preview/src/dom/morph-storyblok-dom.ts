import morphdom from "morphdom";

const DEFAULT_KEY_ATTRIBUTE = "data-blok-uid";
const DEFAULT_FOCUSED_ATTRIBUTE = "data-blok-focused";
const DEFAULT_PRESERVE_STATE_ATTRIBUTE = "data-preserve-state";

export type DomMorphOptions = {
  /** Element currently focused by the Visual Editor. */
  focusedElement?: Element | null;
  /** Attribute used to match the same block between DOM trees. */
  keyAttribute?: string;
  /** Attribute marking the block currently focused by the Visual Editor. */
  focusedAttribute?: string;
  /** Attribute marking an element whose interactive state must not change. */
  preserveStateAttribute?: string;
  /** Preserve matching element attributes from the current tree by default. */
  preserveElementAttributes?: boolean;
  /** Additional element update policy applied after the default policy. */
  onBeforeElUpdated?: (fromEl: Element, toEl: Element) => boolean | void;
};

export type DomMorphResult = {
  /** Whether the focused subtree or the complete root was updated. */
  scope: "focused" | "root";
};

/**
 * Morphs a new Storyblok-rendered DOM tree into the current tree.
 *
 * This function only operates on DOM nodes. It does not fetch content, inspect
 * stories, dispatch browser events, or depend on a framework's rendering or
 * server conventions.
 */
export function morphStoryblokDom(
  currentRoot: Node,
  nextRoot: Node,
  options: DomMorphOptions = {},
): DomMorphResult {
  const {
    focusedElement = findElement(currentRoot, (element) =>
      element.hasAttribute(options.focusedAttribute ?? DEFAULT_FOCUSED_ATTRIBUTE),
    ),
    keyAttribute = DEFAULT_KEY_ATTRIBUTE,
    focusedAttribute = DEFAULT_FOCUSED_ATTRIBUTE,
    preserveStateAttribute = DEFAULT_PRESERVE_STATE_ATTRIBUTE,
    preserveElementAttributes = true,
    onBeforeElUpdated,
  } = options;

  if (focusedElement) {
    const focusedElementId = focusedElement.getAttribute(keyAttribute);
    const nextFocusedElement = focusedElementId
      ? findElement(nextRoot, (element) => element.getAttribute(keyAttribute) === focusedElementId)
      : null;

    if (nextFocusedElement) {
      nextFocusedElement.setAttribute(focusedAttribute, "true");
      updateDom(focusedElement, nextFocusedElement, {
        keyAttribute,
        preserveStateAttribute,
        preserveElementAttributes,
        onBeforeElUpdated,
      });
      return { scope: "focused" };
    }
  }

  updateDom(currentRoot, nextRoot, {
    keyAttribute,
    preserveStateAttribute,
    preserveElementAttributes,
    onBeforeElUpdated,
  });
  return { scope: "root" };
}

type UpdateOptions = Required<
  Pick<DomMorphOptions, "keyAttribute" | "preserveStateAttribute" | "preserveElementAttributes">
> &
  Pick<DomMorphOptions, "onBeforeElUpdated">;

function updateDom(currentRoot: Node, nextRoot: Node, options: UpdateOptions): void {
  morphdom(currentRoot, nextRoot, {
    getNodeKey: (node) => {
      if (!(node instanceof Element)) {
        return undefined;
      }
      return node.getAttribute(options.keyAttribute) ?? undefined;
    },
    onBeforeElUpdated: (fromEl, toEl) => {
      if (fromEl.hasAttribute(options.preserveStateAttribute)) {
        return false;
      }
      if (options.preserveElementAttributes) {
        preserveMatchingElementAttributes(fromEl, toEl, options.keyAttribute);
      }
      return options.onBeforeElUpdated?.(fromEl, toEl) ?? true;
    },
  });
}

function preserveMatchingElementAttributes(
  fromEl: Element,
  toEl: Element,
  keyAttribute: string,
): void {
  if (fromEl.getAttribute(keyAttribute) !== toEl.getAttribute(keyAttribute)) {
    return;
  }

  Array.from(fromEl.attributes).forEach((attribute) => {
    if (attribute.name === keyAttribute) {
      return;
    }
    if (
      !toEl.hasAttribute(attribute.name) ||
      toEl.getAttribute(attribute.name) !== attribute.value
    ) {
      toEl.setAttribute(attribute.name, attribute.value);
    }
  });
}

function findElement(root: Node, predicate: (element: Element) => boolean): Element | null {
  if (root instanceof Element && predicate(root)) {
    return root;
  }

  for (const child of Array.from(root.childNodes)) {
    const match = findElement(child, predicate);
    if (match) {
      return match;
    }
  }

  return null;
}
