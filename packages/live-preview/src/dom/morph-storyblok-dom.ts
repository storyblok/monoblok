import morphdom from "morphdom";

const DEFAULT_KEY_ATTRIBUTE = "data-blok-uid";
const DEFAULT_FOCUSED_ATTRIBUTE = "data-blok-focused";
const DEFAULT_PRESERVE_STATE_ATTRIBUTE = "data-preserve-state";

/** Element node, per the DOM spec. Avoids `instanceof Element`, which fails across realms (e.g. an iframe or a second JSDOM document). */
const ELEMENT_NODE = 1;

export type DomMorphOptions = {
  /**
   * Element currently focused by the Visual Editor. Auto-detected from
   * `currentRoot` via `focusedAttribute` when left `undefined`. Pass `null`
   * explicitly to disable auto-detection and force a full-root morph.
   */
  focusedElement?: Element | null;
  /** Attribute used to match the same block between DOM trees. */
  keyAttribute?: string;
  /** Attribute marking the block currently focused by the Visual Editor. */
  focusedAttribute?: string;
  /**
   * Attribute marking an element (and its subtree) whose DOM must not
   * change: morphing skips it entirely, including its attributes and
   * children. Useful for marking a subtree a client-side framework owns
   * (e.g. a hydrated island) as opaque, so a server-driven update doesn't
   * fight the framework's own DOM writes or block its re-hydration.
   */
  preserveStateAttribute?: string;
  /**
   * Preserve every matching element's attributes from the current tree
   * instead of applying the next tree's. Off by default: a server-driven
   * attribute change (a new image `src`, a toggled `class`) is applied like
   * any other content update. Turning this on blocks legitimate server
   * attribute changes on every matched element; for protecting one specific
   * element or subtree (e.g. a framework island), use
   * `preserveStateAttribute` instead.
   */
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
 *
 * When a focused block is found (see `focusedElement`), only that subtree is
 * morphed and the rest of `currentRoot` is left untouched until an update
 * finds no focused block (or the caller reloads): a sibling block being
 * added, a story title, or other content outside the focused block does not
 * update while a block is focused.
 *
 * If the same key (`keyAttribute`) appears more than once in `nextRoot` (the
 * same blok rendered twice, e.g. in a desktop and a mobile nav), the first
 * match in document order is used.
 *
 * This mutates `nextRoot`: the focused element gets `focusedAttribute` set on
 * it, and, with `preserveElementAttributes` on, matching elements have their
 * attributes rewritten in place. Don't reuse or cache `nextRoot` afterwards.
 *
 * Skips the morph entirely (no DOM mutations, no `onBeforeElUpdated` calls)
 * when the relevant subtree (the focused element, or `currentRoot`/`nextRoot`
 * for a full-root update) is already identical to its counterpart.
 */
export function morphStoryblokDom(
  currentRoot: Element,
  nextRoot: Element,
  options: DomMorphOptions = {},
): DomMorphResult {
  const {
    keyAttribute = DEFAULT_KEY_ATTRIBUTE,
    focusedAttribute = DEFAULT_FOCUSED_ATTRIBUTE,
    preserveStateAttribute = DEFAULT_PRESERVE_STATE_ATTRIBUTE,
    preserveElementAttributes = false,
    onBeforeElUpdated,
  } = options;

  const focusedElement =
    options.focusedElement === undefined
      ? currentRoot.querySelector(`[${focusedAttribute}="true"]`)
      : options.focusedElement;

  if (focusedElement && currentRoot.contains(focusedElement)) {
    const focusedElementId = focusedElement.getAttribute(keyAttribute);
    const nextFocusedElement = focusedElementId
      ? nextRoot.querySelector(
          `[${keyAttribute}="${escapeAttributeSelectorValue(focusedElementId)}"]`,
        )
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

function updateDom(currentRoot: Element, nextRoot: Element, options: UpdateOptions): void {
  // Identical trees would produce zero mutations anyway; skip walking both
  // of them and invoking `onBeforeElUpdated` for every element. Matches
  // Astro's `newBody.outerHTML === currentBody.outerHTML` shortcut, using
  // `isEqualNode` instead of a string comparison (not sensitive to attribute
  // order, and avoids building the serialized strings).
  if (currentRoot.isEqualNode(nextRoot)) {
    return;
  }

  morphdom(currentRoot, nextRoot, {
    getNodeKey: (node) => {
      if (node.nodeType !== ELEMENT_NODE) {
        return undefined;
      }
      const element = node as Element;
      // Falls back to `id`, matching morphdom's own default, so elements
      // keyed only by `id` (no `keyAttribute`) still keep stable identity.
      return element.getAttribute(options.keyAttribute) || element.id || undefined;
    },
    onBeforeElUpdated: (fromEl, toEl) => {
      if (fromEl.hasAttribute(options.preserveStateAttribute)) {
        return false;
      }
      preserveInteractiveState(fromEl, toEl);
      if (options.preserveElementAttributes) {
        preserveMatchingElementAttributes(fromEl, toEl, options.keyAttribute);
      }
      return options.onBeforeElUpdated?.(fromEl, toEl) ?? true;
    },
  });
}

/**
 * Carries over the live value of form controls the user has actually
 * interacted with, so morphdom's own `value`/`checked`/`selected` syncing
 * (which always applies, independent of `onBeforeElUpdated`) doesn't clobber
 * it with the server's next-rendered default. Operates on properties, not
 * attributes: the attribute never reflects what the user typed in the first
 * place.
 *
 * Only overrides when the live property has diverged from the element's own
 * `default*` property (which mirrors its content attribute): an element the
 * user never touched is "not dirty" and still picks up a legitimate
 * server-driven default change instead of getting stuck on the old one.
 *
 * Avoids `instanceof` so it also works across realms (e.g. `nextRoot` built
 * from another document).
 */
function preserveInteractiveState(fromEl: Element, toEl: Element): void {
  if (fromEl.nodeName !== toEl.nodeName) {
    return;
  }

  switch (fromEl.nodeName) {
    case "INPUT": {
      const fromInput = fromEl as HTMLInputElement;
      const toInput = toEl as HTMLInputElement;
      if (fromInput.value !== fromInput.defaultValue) {
        toInput.value = fromInput.value;
      }
      if (fromInput.checked !== fromInput.defaultChecked) {
        toInput.checked = fromInput.checked;
      }
      return;
    }
    case "TEXTAREA": {
      const fromTextarea = fromEl as HTMLTextAreaElement;
      if (fromTextarea.value !== fromTextarea.defaultValue) {
        (toEl as HTMLTextAreaElement).value = fromTextarea.value;
      }
      return;
    }
    case "SELECT": {
      const fromSelect = fromEl as HTMLSelectElement;
      const defaultOption = Array.from(fromSelect.options).find((option) => option.defaultSelected);
      const defaultValue = defaultOption?.value ?? fromSelect.options[0]?.value;
      if (fromSelect.value !== defaultValue) {
        (toEl as HTMLSelectElement).value = fromSelect.value;
      }
      return;
    }
    case "OPTION": {
      const fromOption = fromEl as HTMLOptionElement;
      if (fromOption.selected !== fromOption.defaultSelected) {
        (toEl as HTMLOptionElement).selected = fromOption.selected;
      }
      return;
    }
    default:
      return;
  }
}

/** Attributes whose live state lives on properties handled by `preserveInteractiveState`, not on the attribute copied here. */
const INTERACTIVE_STATE_ATTRIBUTES = new Set(["value", "checked", "selected"]);

function preserveMatchingElementAttributes(
  fromEl: Element,
  toEl: Element,
  keyAttribute: string,
): void {
  if (fromEl.getAttribute(keyAttribute) !== toEl.getAttribute(keyAttribute)) {
    return;
  }

  Array.from(fromEl.attributes).forEach((attribute) => {
    if (attribute.name === keyAttribute || INTERACTIVE_STATE_ATTRIBUTES.has(attribute.name)) {
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

/** Escapes a value for interpolation into an attribute-value CSS selector. */
function escapeAttributeSelectorValue(value: string): string {
  return value.replace(/["\\]/g, (char) => `\\${char}`);
}
