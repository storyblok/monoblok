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
   * Keep attributes the client changed, added, or removed since the last
   * server render (an opened `<details>`, a class toggled by a script)
   * instead of resetting them to the next render's values. Attributes the
   * client never touched still follow the server, so a server-driven change
   * (a new image `src`, a `class` derived from a field) is applied either
   * way. When the client and the server both changed the same attribute,
   * the client's value wins.
   *
   * Off by default: the next render's attributes are applied verbatim. To
   * protect one specific element or subtree completely (e.g. a framework
   * island), use `preserveStateAttribute` instead.
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
 * it, and, with `preserveElementAttributes` on, elements carrying client-side
 * attribute changes have them written onto their `nextRoot` counterpart.
 * Don't reuse or cache `nextRoot` afterwards.
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
      if (!options.preserveElementAttributes) {
        return options.onBeforeElUpdated?.(fromEl, toEl) ?? true;
      }
      // Read before `preserveClientAttributes` writes client state onto `toEl`.
      const nextServerAttributes = readAttributes(toEl);
      preserveClientAttributes(fromEl, toEl, options.keyAttribute);
      const shouldUpdate = options.onBeforeElUpdated?.(fromEl, toEl) ?? true;
      if (shouldUpdate !== false) {
        // morphdom keeps `fromEl` and syncs it to `toEl`, so `fromEl` now
        // stands for this server render.
        serverAttributes.set(fromEl, nextServerAttributes);
      }
      return shouldUpdate;
    },
    onNodeAdded: (node) => {
      if (options.preserveElementAttributes && node.nodeType === ELEMENT_NODE) {
        serverAttributes.set(node as Element, readAttributes(node as Element));
      }
      reviveInsertedScript(node);
      return node;
    },
  });
}

/**
 * A `<script>` morphdom inserts never runs: it was parsed by `DOMParser`
 * (see `get-new-html-body.ts`), which keeps the HTML spec's "already
 * started" flag even once moved into the live document. Replace it with a
 * freshly created script element — `cloneNode` carries the flag over too.
 */
function reviveInsertedScript(node: Node): void {
  if (node.nodeType !== ELEMENT_NODE || node.nodeName !== "SCRIPT") {
    return;
  }
  const inert = node as HTMLScriptElement;
  const script = (inert.ownerDocument ?? document).createElement("script");
  for (const attribute of Array.from(inert.attributes)) {
    script.setAttribute(attribute.name, attribute.value);
  }
  script.textContent = inert.textContent;
  inert.replaceWith(script);
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
      // A file input's value is a read-only fakepath: assigning it throws
      // `InvalidStateError`, which would abort the whole morph.
      if (fromInput.type !== "file" && fromInput.value !== fromInput.defaultValue) {
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
      // A multiple select has no single value; its options carry the state (`OPTION` case).
      if (fromSelect.multiple) {
        return;
      }
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

/**
 * Attributes of each live element as the server last rendered them: the base
 * of the three-way merge in `preserveClientAttributes`. A `WeakMap`, so
 * elements removed from the page don't leak.
 */
const serverAttributes = new WeakMap<Element, Map<string, string>>();

function readAttributes(element: Element): Map<string, string> {
  return new Map(Array.from(element.attributes, (attribute) => [attribute.name, attribute.value]));
}

/**
 * Records the attributes of `root` and its descendants as server-rendered,
 * so client-side changes made afterwards (before the first live update) can
 * be told apart from the server's. Call it while the DOM still matches the
 * server render, e.g. when the live-preview handler is created. Elements
 * that already have a record keep it.
 */
export function captureServerAttributes(root: Element): void {
  for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
    if (!serverAttributes.has(element)) {
      serverAttributes.set(element, readAttributes(element));
    }
  }
}

/**
 * Writes attributes the client changed since the last server render onto
 * `toEl`, so morphdom keeps them, and leaves every other attribute at the
 * next render's value. Without a record of the last render (an element the
 * client inserted), only attributes the next render doesn't define are kept.
 */
function preserveClientAttributes(fromEl: Element, toEl: Element, keyAttribute: string): void {
  // A different block reusing this element: none of its state applies.
  if (fromEl.getAttribute(keyAttribute) !== toEl.getAttribute(keyAttribute)) {
    return;
  }
  const isMergeable = (name: string) =>
    name !== keyAttribute && !INTERACTIVE_STATE_ATTRIBUTES.has(name);
  const base = serverAttributes.get(fromEl);

  for (const { name, value } of Array.from(fromEl.attributes)) {
    if (!isMergeable(name)) {
      continue;
    }
    const isClientChange = base ? base.get(name) !== value : !toEl.hasAttribute(name);
    if (isClientChange) {
      toEl.setAttribute(name, value);
    }
  }

  // Attributes the client removed stay removed, unless the server changed them too.
  base?.forEach((value, name) => {
    if (isMergeable(name) && !fromEl.hasAttribute(name) && toEl.getAttribute(name) === value) {
      toEl.removeAttribute(name);
    }
  });
}

/** Escapes a value for interpolation into an attribute-value CSS selector. */
function escapeAttributeSelectorValue(value: string): string {
  return value.replace(/["\\]/g, (char) => `\\${char}`);
}
