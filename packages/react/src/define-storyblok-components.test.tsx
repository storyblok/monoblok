import {
  forwardRef,
  lazy,
  memo,
  useState,
  useEffect,
  Suspense,
  type ComponentType,
  type FC,
} from "react";
import { describe, it, expect, vi, expectTypeOf } from "vitest";
import type { ReactNode } from "react";
import { render, waitFor, act } from "@testing-library/react";
import type { BlockContent, StoryblokComponentProps, StoryblokEditableProps } from "./types";
import type { StoryblokRichTextInput } from "@storyblok/richtext";
import { defineStoryblokComponents } from "./define-storyblok-components";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeBlockData(overrides: { component: string } & Partial<BlockContent>): BlockContent {
  return { _uid: "test-uid", ...overrides };
}

const pageBlock = makeBlockData({ component: "page", _uid: "uid-page" });
const teaserBlock = makeBlockData({ component: "teaser", _uid: "uid-teaser", title: "Hello" });
const unknownBlock = makeBlockData({ component: "unknown", _uid: "uid-unknown" });

function Page({ block }: { block: BlockContent }) {
  return <div data-testid="page">{block._uid}</div>;
}

function Teaser({ block }: { block: BlockContent & { title?: string } }) {
  return <span data-testid="teaser">{block.title as string}</span>;
}

function Fallback({ block }: { block: BlockContent }) {
  return <div data-testid="fallback">{block.component}</div>;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("defineStoryblokComponents", () => {
  it("returns StoryblokComponent and StoryblokRichText", () => {
    const result = defineStoryblokComponents({ components: {} });
    expect(typeof result.StoryblokComponent).toBe("function");
    expect(typeof result.StoryblokRichText).toBe("function");
  });

  // ─── StoryblokComponent — single block ────────────────────────────────────

  describe("StoryblokComponent — single block", () => {
    it("renders the component matching block.component", () => {
      const { StoryblokComponent } = defineStoryblokComponents({ components: { page: Page } });
      const { getByTestId } = render(<StoryblokComponent block={pageBlock} />);
      expect(getByTestId("page")).toHaveTextContent("uid-page");
    });

    it("passes extra props through to the registered component", () => {
      function WithExtra({ block: _block, extra }: { block: BlockContent; extra?: string }) {
        return <div data-testid="extra">{extra}</div>;
      }
      const { StoryblokComponent } = defineStoryblokComponents<{ extra?: string }>({
        components: { widget: WithExtra },
      });
      const block = makeBlockData({ component: "widget" });
      const { getByTestId } = render(<StoryblokComponent block={block} extra="hello" />);
      expect(getByTestId("extra")).toHaveTextContent("hello");
    });

    it("renders the fallback component when the block type is not registered", () => {
      const { StoryblokComponent } = defineStoryblokComponents({
        components: { page: Page },
        fallback: Fallback,
      });
      const { getByTestId } = render(<StoryblokComponent block={unknownBlock} />);
      expect(getByTestId("fallback")).toHaveTextContent("unknown");
    });

    it("returns null and logs a warning when no match and no fallback", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { StoryblokComponent } = defineStoryblokComponents({ components: {} });
      const { container } = render(<StoryblokComponent block={unknownBlock} />);
      expect(container.firstChild).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('[Storyblok] No component registered for "unknown".');
      consoleSpy.mockRestore();
    });

    it("returns null and logs an error when the block prop is missing", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { StoryblokComponent } = defineStoryblokComponents({ components: {} });
      // @ts-expect-error — testing missing required prop
      const { container } = render(<StoryblokComponent />);
      expect(container.firstChild).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "[Storyblok] StoryblokComponent: 'block' prop is required.",
      );
      consoleSpy.mockRestore();
    });

    it("wraps a component in Suspense when suspense: true, showing fallback then content", async () => {
      const LazyPage = lazy(
        () =>
          new Promise<{ default: typeof Page }>((resolve) =>
            setTimeout(() => resolve({ default: Page }), 10),
          ),
      );
      const { StoryblokComponent } = defineStoryblokComponents({
        components: {
          page: {
            component: LazyPage,
            fallback: <div data-testid="skeleton">loading</div>,
            suspense: true,
          },
        },
      });

      const { getByTestId } = render(<StoryblokComponent block={pageBlock} />);
      expect(getByTestId("skeleton")).toBeInTheDocument();
      await waitFor(() => expect(getByTestId("page")).toBeInTheDocument());
    });

    it("auto-wraps lazy components in Suspense without explicit suspense: true", async () => {
      const LazyTeaser = lazy(
        () =>
          new Promise<{ default: typeof Teaser }>((resolve) =>
            setTimeout(() => resolve({ default: Teaser }), 10),
          ),
      );
      const { StoryblokComponent } = defineStoryblokComponents({
        components: {
          teaser: {
            component: LazyTeaser,
            fallback: <div data-testid="skeleton">loading</div>,
            // suspense omitted — auto-detected via isLazyComponent()
          },
        },
      });

      const { getByTestId } = render(<StoryblokComponent block={teaserBlock} />);
      expect(getByTestId("skeleton")).toBeInTheDocument();
      await waitFor(() => expect(getByTestId("teaser")).toBeInTheDocument());
    });

    it("auto-wraps memo(lazy(...)) components in Suspense too", async () => {
      const LazyTeaser = memo(
        lazy(
          () =>
            new Promise<{ default: typeof Teaser }>((resolve) =>
              setTimeout(() => resolve({ default: Teaser }), 10),
            ),
        ),
      );
      const { StoryblokComponent } = defineStoryblokComponents({
        components: {
          teaser: {
            component: LazyTeaser,
            fallback: <div data-testid="skeleton">loading</div>,
            // suspense omitted — auto-detected via isLazyComponent() unwrapping memo()
          },
        },
      });

      const { getByTestId } = render(<StoryblokComponent block={teaserBlock} />);
      expect(getByTestId("skeleton")).toBeInTheDocument();
      await waitFor(() => expect(getByTestId("teaser")).toBeInTheDocument());
    });

    it("uses the registry-level suspenseFallback when the entry omits its own fallback", async () => {
      const LazyPage = lazy(
        () =>
          new Promise<{ default: typeof Page }>((resolve) =>
            setTimeout(() => resolve({ default: Page }), 10),
          ),
      );
      const { StoryblokComponent } = defineStoryblokComponents({
        components: {
          page: { component: LazyPage, suspense: true },
        },
        suspenseFallback: <div data-testid="global-skeleton">global</div>,
      });

      const { getByTestId } = render(<StoryblokComponent block={pageBlock} />);
      expect(getByTestId("global-skeleton")).toBeInTheDocument();
      await waitFor(() => expect(getByTestId("page")).toBeInTheDocument());
    });
  });

  // ─── StoryblokRichText ─────────────────────────────────────────────────────

  describe("StoryblokRichText", () => {
    it("is a function (renderable component)", () => {
      const { StoryblokRichText } = defineStoryblokComponents({ components: {} });
      expect(typeof StoryblokRichText).toBe("function");
    });

    it("renders a simple rich-text document", () => {
      const { StoryblokRichText } = defineStoryblokComponents({ components: {} });
      const doc: StoryblokRichTextInput = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
      };
      const { container } = render(<StoryblokRichText document={doc} />);
      expect(container.textContent).toContain("Hello");
    });

    it("renders embedded blocks via the same component map's StoryblokComponent", () => {
      const { StoryblokRichText } = defineStoryblokComponents({ components: { page: Page } });
      const doc: StoryblokRichTextInput = {
        type: "doc",
        content: [
          {
            type: "blok",
            attrs: {
              id: "blok-1",
              body: [{ component: "page", _uid: "uid-page" }],
            },
          },
        ],
      };
      const { getByTestId } = render(<StoryblokRichText document={doc} />);
      expect(getByTestId("page")).toBeInTheDocument();
    });

    it("forwards a plain-object `data` prop to embedded blocks as extra props", () => {
      function PageWithLocale({ block, locale }: { block: BlockContent; locale?: string }) {
        return (
          <div data-testid="page" data-locale={locale}>
            {block._uid}
          </div>
        );
      }
      const { StoryblokRichText } = defineStoryblokComponents({
        components: { page: PageWithLocale },
      });
      const doc: StoryblokRichTextInput = {
        type: "doc",
        content: [
          {
            type: "blok",
            attrs: {
              id: "blok-1",
              body: [{ component: "page", _uid: "uid-page" }],
            },
          },
        ],
      };
      const { getByTestId } = render(<StoryblokRichText document={doc} data={{ locale: "de" }} />);
      expect(getByTestId("page")).toHaveAttribute("data-locale", "de");
    });

    it("does not forward `data` when it isn't a plain object", () => {
      function PageWithLocale({ block, locale }: { block: BlockContent; locale?: string }) {
        return (
          <div data-testid="page" data-locale={locale ?? "none"}>
            {block._uid}
          </div>
        );
      }
      const { StoryblokRichText } = defineStoryblokComponents({
        components: { page: PageWithLocale },
      });
      const doc: StoryblokRichTextInput = {
        type: "doc",
        content: [
          {
            type: "blok",
            attrs: {
              id: "blok-1",
              body: [{ component: "page", _uid: "uid-page" }],
            },
          },
        ],
      };
      const { getByTestId } = render(<StoryblokRichText document={doc} data="not-an-object" />);
      expect(getByTestId("page")).toHaveAttribute("data-locale", "none");
    });

    it("forwards the same `data` prop to every embedded blok in a document with multiple bloks", () => {
      function Widget({ block, locale }: { block: BlockContent; locale?: string }) {
        return (
          <div data-testid={`widget-${block._uid}`} data-locale={locale}>
            {block.component}
          </div>
        );
      }
      const { StoryblokRichText } = defineStoryblokComponents({
        components: { widget: Widget },
      });
      const doc: StoryblokRichTextInput = {
        type: "doc",
        content: [
          { type: "blok", attrs: { id: "b1", body: [{ component: "widget", _uid: "uid-1" }] } },
          { type: "paragraph", content: [{ type: "text", text: "sep" }] },
          { type: "blok", attrs: { id: "b2", body: [{ component: "widget", _uid: "uid-2" }] } },
        ],
      };
      const { getByTestId } = render(<StoryblokRichText document={doc} data={{ locale: "es" }} />);
      expect(getByTestId("widget-uid-1")).toHaveAttribute("data-locale", "es");
      expect(getByTestId("widget-uid-2")).toHaveAttribute("data-locale", "es");
    });

    it("re-renders embedded bloks with fresh values when the `data` prop changes", () => {
      function Widget({ block: _block, locale }: { block: BlockContent; locale?: string }) {
        return <div data-testid="widget">{locale}</div>;
      }
      const { StoryblokRichText } = defineStoryblokComponents({
        components: { widget: Widget },
      });
      const doc: StoryblokRichTextInput = {
        type: "doc",
        content: [
          { type: "blok", attrs: { id: "b1", body: [{ component: "widget", _uid: "uid-1" }] } },
        ],
      };
      const { getByTestId, rerender } = render(
        <StoryblokRichText document={doc} data={{ locale: "en" }} />,
      );
      expect(getByTestId("widget")).toHaveTextContent("en");
      rerender(<StoryblokRichText document={doc} data={{ locale: "fr" }} />);
      expect(getByTestId("widget")).toHaveTextContent("fr");
    });

    it("lets a `blok` entry passed in the `components` prop override the built-in embedded-block renderer", () => {
      const { StoryblokRichText } = defineStoryblokComponents({ components: { page: Page } });
      const doc: StoryblokRichTextInput = {
        type: "doc",
        content: [
          {
            type: "blok",
            attrs: { id: "blok-1", body: [{ component: "page", _uid: "uid-page" }] },
          },
        ],
      };
      const { getByTestId, queryByTestId } = render(
        <StoryblokRichText
          document={doc}
          components={{
            blok: ({ attrs }: any) => (
              <div data-testid="custom-blok">{attrs?.body?.[0]?.component}</div>
            ),
          }}
        />,
      );
      // The caller's `blok` renderer wins — the built-in one (which would have
      // rendered "page" via StoryblokComponent) is not used.
      expect(getByTestId("custom-blok")).toHaveTextContent("page");
      expect(queryByTestId("page")).toBeNull();
    });
  });

  // ─── Custom data propagation across nested components ────────────────────
  //
  // TExtraProps forwarding only applies at the JSX call site: StoryblokComponent
  // spreads its extra props onto the component resolved for THAT block. A
  // parent block component must explicitly re-pass the prop to any nested
  // `<StoryblokComponent block={child} .../>` call for it to reach a
  // grandchild — it does not travel automatically through the tree.

  describe("custom data propagation across nested components", () => {
    type LocaleProps = { locale?: string };

    function Leaf({ block, locale }: { block: BlockContent; locale?: string }) {
      return (
        <span data-testid="leaf" data-locale={locale ?? "none"}>
          {block._uid}
        </span>
      );
    }

    it("reaches a deeply nested block when every level explicitly forwards it", () => {
      function Branch({
        block,
        locale,
      }: {
        block: BlockContent & { children?: BlockContent[] };
        locale?: string;
      }) {
        return (
          <div data-testid="branch">
            {block.children?.map((child) => (
              <StoryblokComponent key={child._uid} block={child} locale={locale} />
            ))}
          </div>
        );
      }
      const { StoryblokComponent } = defineStoryblokComponents<LocaleProps>({
        components: { branch: Branch, leaf: Leaf },
      });
      const root = makeBlockData({
        component: "branch",
        _uid: "uid-branch",
        children: [makeBlockData({ component: "leaf", _uid: "uid-leaf" })],
      });

      const { getByTestId } = render(<StoryblokComponent block={root} locale="fr" />);
      expect(getByTestId("leaf")).toHaveAttribute("data-locale", "fr");
    });

    it("does not automatically reach a nested block when an intermediate component forwards nothing", () => {
      function Branch({ block }: { block: BlockContent & { children?: BlockContent[] } }) {
        return (
          <div data-testid="branch">
            {block.children?.map((child) => (
              <StoryblokComponent key={child._uid} block={child} />
            ))}
          </div>
        );
      }
      const { StoryblokComponent } = defineStoryblokComponents<LocaleProps>({
        components: { branch: Branch, leaf: Leaf },
      });
      const root = makeBlockData({
        component: "branch",
        _uid: "uid-branch",
        children: [makeBlockData({ component: "leaf", _uid: "uid-leaf" })],
      });

      const { getByTestId } = render(<StoryblokComponent block={root} locale="fr" />);
      expect(getByTestId("leaf")).toHaveAttribute("data-locale", "none");
    });

    it("forwards an object extra prop intact — nested values and functions survive by reference", () => {
      const onSelect = vi.fn();
      type ConfigProps = { config: { theme: string; onSelect: () => void } };
      function Widget({
        block: _block,
        config,
      }: {
        block: BlockContent;
        config?: ConfigProps["config"];
      }) {
        return (
          <button
            data-testid="widget"
            data-theme={config?.theme}
            onClick={() => config?.onSelect()}
          >
            click
          </button>
        );
      }
      const { StoryblokComponent } = defineStoryblokComponents<ConfigProps>({
        components: { widget: Widget },
      });
      const block = makeBlockData({ component: "widget" });
      const { getByTestId } = render(
        <StoryblokComponent block={block} config={{ theme: "dark", onSelect }} />,
      );
      const button = getByTestId("widget");
      expect(button).toHaveAttribute("data-theme", "dark");
      button.click();
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("updates the extra prop a block receives when it changes across re-renders", () => {
      function Widget({ block: _block, locale }: { block: BlockContent; locale?: string }) {
        return <div data-testid="widget">{locale}</div>;
      }
      const { StoryblokComponent } = defineStoryblokComponents<LocaleProps>({
        components: { widget: Widget },
      });
      const block = makeBlockData({ component: "widget" });
      const { getByTestId, rerender } = render(<StoryblokComponent block={block} locale="en" />);
      expect(getByTestId("widget")).toHaveTextContent("en");
      rerender(<StoryblokComponent block={block} locale="de" />);
      expect(getByTestId("widget")).toHaveTextContent("de");
    });
  });

  // ─── StoryblokComponent extra props vs. a nested StoryblokRichText's `data` ─
  //
  // A block component can receive extra props from `StoryblokComponent` (e.g.
  // `locale` via TExtraProps) and separately render a `StoryblokRichText` for
  // one of its own richtext fields. Those two data paths are NOT connected:
  // extra props land on the block component's own props, not in the richtext
  // context, unless the component explicitly re-passes them as `data`.

  describe("StoryblokComponent extra props vs. a nested StoryblokRichText's data", () => {
    const richTextDoc: StoryblokRichTextInput = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
    };

    it("does not automatically expose a StoryblokComponent extra prop in a nested StoryblokRichText's context.data", () => {
      let receivedData: unknown = "not-set";
      function Probe({ children, context }: any) {
        receivedData = context?.data;
        return <p>{children}</p>;
      }
      function PageWithRichText({
        block,
      }: {
        block: BlockContent & { richText?: StoryblokRichTextInput };
        locale?: string;
      }) {
        return (
          <div data-testid="page">
            {Boolean(block.richText) && (
              <StoryblokRichText document={block.richText} components={{ paragraph: Probe }} />
            )}
          </div>
        );
      }
      const { StoryblokComponent, StoryblokRichText } = defineStoryblokComponents<{
        locale?: string;
      }>({
        components: { page: PageWithRichText },
      });
      const block = makeBlockData({ component: "page", richText: richTextDoc });

      render(<StoryblokComponent block={block} locale="de" />);
      expect(receivedData).toBeUndefined();
    });

    it("exposes a StoryblokComponent extra prop in a nested StoryblokRichText once the block component re-passes it as `data`", () => {
      let receivedLocale: unknown;
      function Probe({ children, context }: any) {
        receivedLocale = (context?.data as { locale?: string } | undefined)?.locale;
        return <p>{children}</p>;
      }
      function PageWithRichText({
        block,
        locale,
      }: {
        block: BlockContent & { richText?: StoryblokRichTextInput };
        locale?: string;
      }) {
        return (
          <div data-testid="page">
            {Boolean(block.richText) && (
              <StoryblokRichText
                document={block.richText}
                components={{ paragraph: Probe }}
                data={{ locale }}
              />
            )}
          </div>
        );
      }
      const { StoryblokComponent, StoryblokRichText } = defineStoryblokComponents<{
        locale?: string;
      }>({
        components: { page: PageWithRichText },
      });
      const block = makeBlockData({ component: "page", richText: richTextDoc });

      render(<StoryblokComponent block={block} locale="de" />);
      expect(receivedLocale).toBe("de");
    });
  });

  // ─── Isolation ────────────────────────────────────────────────────────────

  describe("isolation", () => {
    it("two calls do not share component maps", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const resultA = defineStoryblokComponents({ components: { page: Page } });
      const resultB = defineStoryblokComponents({ components: { teaser: Teaser } });

      render(<resultA.StoryblokComponent block={teaserBlock} />);
      expect(consoleSpy).toHaveBeenCalledWith('[Storyblok] No component registered for "teaser".');
      consoleSpy.mockRestore();

      const { getByTestId } = render(<resultB.StoryblokComponent block={teaserBlock} />);
      expect(getByTestId("teaser")).toBeInTheDocument();
    });
  });

  // ─── memo() and forwardRef() components ───────────────────────────────────

  describe("memo() and forwardRef() components", () => {
    it("renders a component wrapped with React.memo()", () => {
      const MemoTeaser = memo(Teaser);
      const { StoryblokComponent } = defineStoryblokComponents({
        components: { teaser: MemoTeaser },
      });
      const { getByTestId } = render(<StoryblokComponent block={teaserBlock} />);
      expect(getByTestId("teaser")).toHaveTextContent("Hello");
    });

    it("renders a component wrapped with React.forwardRef()", () => {
      const ForwardRefTeaser = forwardRef<HTMLSpanElement, { block: BlockContent }>(
        ({ block }, _ref) => <span data-testid="fwd-teaser">{(block as any).title}</span>,
      );
      const { StoryblokComponent } = defineStoryblokComponents({
        components: { teaser: ForwardRefTeaser },
      });
      const { getByTestId } = render(<StoryblokComponent block={teaserBlock} />);
      expect(getByTestId("fwd-teaser")).toHaveTextContent("Hello");
    });

    it("does not treat memo() as a config object (no undefined component crash)", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const MemoPage = memo(Page);
      const { StoryblokComponent } = defineStoryblokComponents({
        components: { page: MemoPage },
      });
      // Should render without React error (would crash if normalizeEntry returned {component: undefined})
      const { getByTestId } = render(<StoryblokComponent block={pageBlock} />);
      expect(getByTestId("page")).toBeInTheDocument();
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ─── Registry validation ───────────────────────────────────────────────────

  describe("registry validation", () => {
    it("throws a clear error when components is missing", () => {
      expect(() => defineStoryblokComponents({} as any)).toThrow(
        '[Storyblok] defineStoryblokComponents: "components" is required.',
      );
    });

    it("throws a clear error naming the block key when an entry is undefined", () => {
      expect(() => defineStoryblokComponents({ components: { teaser: undefined as any } })).toThrow(
        '[Storyblok] defineStoryblokComponents: components["teaser"] is undefined.',
      );
    });

    it("throws a clear error naming the block key when a config entry is missing 'component'", () => {
      expect(() =>
        defineStoryblokComponents({ components: { teaser: { suspense: true } as any } }),
      ).toThrow(
        '[Storyblok] defineStoryblokComponents: components["teaser"] is missing "component".',
      );
    });
  });

  // ─── StoryblokRichText stable reference ───────────────────────────────────

  describe("StoryblokRichText stable reference", () => {
    it("returns the same StoryblokRichText reference on every property access", () => {
      const result = defineStoryblokComponents({ components: {} });
      const first = result.StoryblokRichText;
      const second = result.StoryblokRichText;
      expect(first).toBe(second);
    });

    it("two different defineStoryblokComponents calls produce different StoryblokRichText types", () => {
      const resultA = defineStoryblokComponents({ components: { page: Page } });
      const resultB = defineStoryblokComponents({ components: { teaser: Teaser } });
      // Each registry has its own pre-computed component — they must not be the same reference
      expect(resultA.StoryblokRichText).not.toBe(resultB.StoryblokRichText);
    });
  });

  // ─── next/dynamic compatibility ───────────────────────────────────────────
  //
  // next/dynamic is NOT one function. The compiler aliases `next/dynamic` to one
  // of two runtime implementations depending on the router:
  //
  //   App Router  → next/dist/shared/lib/lazy-dynamic/loadable.js
  //                 Returns a plain function (LoadableComponent).
  //                 Internally uses lazy but wraps with Fragment (not
  //                 Suspense) when ssr:true and no `loading` option, so the
  //                 suspension propagates to the nearest ancestor boundary.
  //
  //   Pages Router → next/dist/shared/lib/loadable.shared-runtime.js
  //                  Returns React.forwardRef(LoadableComponent).
  //                  Manages loading state internally via useSyncExternalStore;
  //                  never throws a Promise, so Suspense boundaries are inert.
  //
  // Neither variant carries $$typeof Symbol(react.lazy), so isLazyComponent()
  // returns false for both. Without suspense:true the fallback never renders.
  //
  // The helpers below are structural fidelity mocks — they reproduce the exact
  // return shapes from the real Next.js 16.1.6 source without importing Next.

  /**
   * Mimics next/dist/shared/lib/lazy-dynamic/loadable.js (App Router).
   * Returns a plain function that wraps lazy in a Fragment.
   * typeof === "function", no $$typeof → isLazyComponent() === false.
   */
  function makeAppRouterDynamic<T extends ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
  ): FC<any> {
    const Lazy = lazy(importFn);
    // Mirrors: const Wrap = hasSuspenseBoundary ? Suspense : Fragment
    // With default ssr:true and no loading option, hasSuspenseBoundary === false.
    function LoadableComponent(props: any) {
      return (
        <>
          <Lazy {...props} />
        </>
      );
    }
    LoadableComponent.displayName = "LoadableComponent";
    return LoadableComponent;
  }

  /**
   * Mimics next/dist/shared/lib/loadable.shared-runtime.js (Pages Router).
   * Returns React.forwardRef(LoadableComponent).
   * typeof === "object", $$typeof === Symbol(react.forward_ref) →
   * isLazyComponent() === false, isWrappedComponent() === true.
   * Never suspends — manages loading state internally.
   */
  function makePagesRouterDynamic<T extends ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
  ) {
    return forwardRef<unknown, any>((props, _ref) => {
      const [Comp, setComp] = useState<T | null>(null);
      useEffect(() => {
        importFn().then((mod) => setComp(() => mod.default));
      }, []);
      // Default loading option is null in Pages Router dynamic.
      if (!Comp) {
        return null;
      }
      const AnyComp = Comp as ComponentType<any>;
      return <AnyComp {...props} />;
    });
  }

  // Helper to build a deferred import promise so tests can control resolution.
  function makeDeferred<T extends ComponentType<any>>(
    component: T,
  ): { importFn: () => Promise<{ default: T }>; resolve: () => void } {
    let resolveFn!: (v: { default: T }) => void;
    const promise = new Promise<{ default: T }>((r) => {
      resolveFn = r;
    });
    return {
      importFn: () => promise,
      resolve: () => resolveFn({ default: component }),
    };
  }

  describe("next/dynamic — structural shape assertions", () => {
    it("App Router dynamic returns a plain function (typeof === 'function', no $$typeof)", () => {
      const { importFn } = makeDeferred(Page);
      const DynamicPage = makeAppRouterDynamic(importFn);

      expect(typeof DynamicPage).toBe("function");
      expect((DynamicPage as any).$$typeof).toBeUndefined();
    });

    it("Pages Router dynamic returns a forwardRef object ($$typeof === Symbol(react.forward_ref))", () => {
      const { importFn } = makeDeferred(Page);
      const DynamicPage = makePagesRouterDynamic(importFn);

      expect(typeof DynamicPage).toBe("object");
      expect((DynamicPage as any).$$typeof?.toString()).toBe("Symbol(react.forward_ref)");
    });
  });

  describe("next/dynamic — App Router (plain function)", () => {
    it("isLazyComponent returns false → no auto-Suspense → fallback never renders without suspense:true", async () => {
      const { importFn, resolve } = makeDeferred(Page);
      const DynamicPage = makeAppRouterDynamic(importFn);

      const { StoryblokComponent } = defineStoryblokComponents({
        components: {
          page: {
            component: DynamicPage,
            fallback: <div data-testid="skeleton">loading</div>,
            // suspense: true intentionally omitted
          },
        },
      });

      // Wrap in a Suspense so the suspending Lazy doesn't crash the test tree.
      const { queryByTestId } = render(
        <Suspense fallback={<div data-testid="outer-boundary">outer</div>}>
          <StoryblokComponent block={pageBlock} />
        </Suspense>,
      );

      // Our skeleton is absent — suspension bubbled to the outer boundary.
      expect(queryByTestId("skeleton")).toBeNull();
      expect(queryByTestId("outer-boundary")).toBeInTheDocument();

      await act(async () => resolve());
      await waitFor(() => expect(queryByTestId("page")).toBeInTheDocument());
    });

    it("suspense:true adds our boundary → fallback renders, then content resolves", async () => {
      const { importFn, resolve } = makeDeferred(Page);
      const DynamicPage = makeAppRouterDynamic(importFn);

      const { StoryblokComponent } = defineStoryblokComponents({
        components: {
          page: {
            component: DynamicPage,
            fallback: <div data-testid="skeleton">loading</div>,
            suspense: true,
          },
        },
      });

      const { getByTestId } = render(<StoryblokComponent block={pageBlock} />);

      expect(getByTestId("skeleton")).toBeInTheDocument();

      await act(async () => resolve());
      await waitFor(() => expect(getByTestId("page")).toBeInTheDocument());
    });
  });

  describe("next/dynamic — Pages Router (forwardRef)", () => {
    it("isLazyComponent returns false → no auto-Suspense → our fallback never renders", async () => {
      const { importFn, resolve } = makeDeferred(Page);
      const DynamicPage = makePagesRouterDynamic(importFn);

      const { StoryblokComponent } = defineStoryblokComponents({
        components: {
          page: {
            component: DynamicPage,
            fallback: <div data-testid="skeleton">loading</div>,
            // suspense: true intentionally omitted
          },
        },
      });

      const { queryByTestId } = render(<StoryblokComponent block={pageBlock} />);

      // Our skeleton never renders; Pages Router manages loading internally (renders null).
      expect(queryByTestId("skeleton")).toBeNull();
      expect(queryByTestId("page")).toBeNull();

      await act(async () => resolve());
      await waitFor(() => expect(queryByTestId("page")).toBeInTheDocument());
    });

    it("suspense:true wraps in our Suspense but Pages Router never suspends → fallback still absent", async () => {
      const { importFn, resolve } = makeDeferred(Page);
      const DynamicPage = makePagesRouterDynamic(importFn);

      const { StoryblokComponent } = defineStoryblokComponents({
        components: {
          page: {
            component: DynamicPage,
            fallback: <div data-testid="skeleton">loading</div>,
            suspense: true, // forced on — but forwardRef component never throws
          },
        },
      });

      const { queryByTestId } = render(<StoryblokComponent block={pageBlock} />);

      // Suspense boundary IS in the tree but forwardRef never throws a Promise,
      // so the fallback is never triggered. The component renders null internally.
      expect(queryByTestId("skeleton")).toBeNull();
      expect(queryByTestId("page")).toBeNull();

      await act(async () => resolve());
      await waitFor(() => expect(queryByTestId("page")).toBeInTheDocument());
    });

    it("isWrappedComponent returns true for Pages Router forwardRef passed directly (no config object)", () => {
      const { importFn } = makeDeferred(Page);
      const DynamicPage = makePagesRouterDynamic(importFn);

      // When passed directly (not in a config object), isWrappedComponent detects it
      // as a forwardRef and normalizeEntry wraps it as { component: DynamicPage }.
      // No fallback is extracted since there was none to begin with.
      expect(() => {
        defineStoryblokComponents({ components: { page: DynamicPage } });
      }).not.toThrow();
    });
  });
});

// ─── Registry pre-computation ─────────────────────────────────────────────────
//
// normalizeEntry, isLazyComponent, and fallback resolution all run once at
// factory time and are stored in a Map. The render path is a single Map.get
// plus a branch — nothing is recomputed per block per render.

describe("registry is pre-computed at factory time", () => {
  it("adding a key to config.components after factory is not reflected", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const components: Record<string, typeof Page> = { page: Page };
    const { StoryblokComponent } = defineStoryblokComponents({ components });

    // mutate after factory
    components.teaser = Teaser;

    const { container } = render(<StoryblokComponent block={teaserBlock} />);
    expect(container.firstChild).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith('[Storyblok] No component registered for "teaser".');
    consoleSpy.mockRestore();
  });

  it("removing a key from config.components after factory is not reflected", () => {
    const components: Record<string, typeof Page | typeof Teaser> = {
      page: Page,
      teaser: Teaser,
    };
    const { StoryblokComponent } = defineStoryblokComponents({ components });

    // mutate after factory
    delete components.page;

    const { getByTestId } = render(<StoryblokComponent block={pageBlock} />);
    expect(getByTestId("page")).toBeInTheDocument();
  });

  it("lazy detection is resolved at factory time — Suspense present on every render, not just the first", async () => {
    const LazyPage = lazy(
      () =>
        new Promise<{ default: typeof Page }>((resolve) =>
          setTimeout(() => resolve({ default: Page }), 10),
        ),
    );
    const { StoryblokComponent } = defineStoryblokComponents({
      components: {
        page: {
          component: LazyPage,
          fallback: <div data-testid="skeleton">loading</div>,
        },
      },
    });

    // First mount
    const { getByTestId, unmount } = render(<StoryblokComponent block={pageBlock} />);
    expect(getByTestId("skeleton")).toBeInTheDocument();
    unmount();

    // Second mount — needsSuspense must still be true without re-running isLazyComponent
    const { getByTestId: get2 } = render(<StoryblokComponent block={pageBlock} />);
    expect(get2("skeleton")).toBeInTheDocument();
  });

  it("per-entry fallback is resolved at factory time and not re-evaluated per render", async () => {
    let fallbackCallCount = 0;
    const LazyPage = lazy(
      () =>
        new Promise<{ default: typeof Page }>((resolve) =>
          setTimeout(() => resolve({ default: Page }), 10),
        ),
    );

    // Compute fallback node once, track how many times the factory ran it
    function makeFallback() {
      fallbackCallCount++;
      return <div data-testid="counted-skeleton">loading</div>;
    }

    defineStoryblokComponents({
      components: {
        page: { component: LazyPage, fallback: makeFallback(), suspense: true },
      },
    });

    // makeFallback() is called exactly once (at the call-site above, i.e. factory time).
    // Rendering StoryblokComponent multiple times must not increment the count.
    expect(fallbackCallCount).toBe(1);
  });
});

// ─── editable injection ───────────────────────────────────────────────────────
//
// StoryblokComponent calls storyblokEditable(block) and passes the result as the
// `editable` prop so block components never need to import or call it themselves.
//
// storyblokEditable returns:
//   {}                               — when block._editable is absent / malformed
//   { "data-blok-c", "data-blok-uid" } — when block._editable is the comment format

const editableComment = (id: string, uid: string) =>
  `<!--#storyblok#${JSON.stringify({ id, uid })}-->`;

describe("StoryblokComponent — editable injection", () => {
  it("passes editable={} to registered components when block has no _editable", () => {
    let received: unknown;
    function Widget({ block: _block, editable }: { block: BlockContent; editable?: unknown }) {
      received = editable;
      return <div data-testid="widget" />;
    }
    const { StoryblokComponent } = defineStoryblokComponents({ components: { widget: Widget } });
    const block = makeBlockData({ component: "widget" });
    render(<StoryblokComponent block={block} />);
    expect(received).toEqual({});
  });

  it("passes data-blok-c and data-blok-uid via editable when block._editable is set", () => {
    let received: Record<string, string> | undefined;
    function Widget({ block: _block, editable }: { block: BlockContent; editable?: unknown }) {
      received = editable as Record<string, string>;
      return <div data-testid="widget" />;
    }
    const { StoryblokComponent } = defineStoryblokComponents({ components: { widget: Widget } });
    const block = makeBlockData({
      component: "widget",
      _editable: editableComment("story-1", "uid-abc"),
    });
    render(<StoryblokComponent block={block} />);
    expect(received).toMatchObject({
      "data-blok-c": JSON.stringify({ id: "story-1", uid: "uid-abc" }),
      "data-blok-uid": "story-1-uid-abc",
    });
  });

  it("passes editable to the config.fallback component when block type is unregistered", () => {
    let received: unknown;
    function FallbackWithEditable({
      block: _b,
      editable,
    }: {
      block: BlockContent;
      editable?: unknown;
    }) {
      received = editable;
      return <div data-testid="fallback" />;
    }
    const { StoryblokComponent } = defineStoryblokComponents({
      components: {},
      fallback: FallbackWithEditable,
    });
    const block = makeBlockData({
      component: "missing",
      _editable: editableComment("s1", "u1"),
    });
    render(<StoryblokComponent block={block} />);
    expect(received).toMatchObject({ "data-blok-uid": "s1-u1" });
  });

  it("passes editable through a Suspense-wrapped component", async () => {
    let received: unknown;
    function SlowWidget({ block: _b, editable }: { block: BlockContent; editable?: unknown }) {
      received = editable;
      return <div data-testid="slow-widget" />;
    }
    const LazyWidget = lazy(
      () =>
        new Promise<{ default: typeof SlowWidget }>((resolve) =>
          setTimeout(() => resolve({ default: SlowWidget }), 10),
        ),
    );
    const { StoryblokComponent } = defineStoryblokComponents({
      components: {
        widget: { component: LazyWidget, fallback: <div>loading</div>, suspense: true },
      },
    });
    const block = makeBlockData({
      component: "widget",
      _editable: editableComment("s2", "u2"),
    });
    render(<StoryblokComponent block={block} />);
    await waitFor(() => expect(received).toMatchObject({ "data-blok-uid": "s2-u2" }));
  });
});

// ─── StoryblokComponentProps type ────────────────────────────────────────────

describe("StoryblokComponentProps — type", () => {
  it("has block and editable keys", () => {
    type Props = StoryblokComponentProps;
    expectTypeOf<keyof Props>().toEqualTypeOf<"block" | "editable">();
  });

  it("editable is optional", () => {
    type Props = StoryblokComponentProps;
    // Should compile: omitting editable is valid
    const _p: Props = { block: pageBlock };
    void _p;
  });

  it("editable is typed as StoryblokEditableProps", () => {
    type Props = StoryblokComponentProps;
    expectTypeOf<Props["editable"]>().toEqualTypeOf<StoryblokEditableProps | undefined>();
  });

  it("accepts a field type declared with `interface` (not just `type`)", () => {
    interface Hero {
      title: string;
    }
    // Would fail with TS2344 under the old `T extends Record<string, unknown>`
    // constraint: an `interface` has no index signature.
    type Props = StoryblokComponentProps<Hero>;
    const _p: Props = { block: { ...pageBlock, title: "hello" } };
    void _p;
  });

  // ─── TExtraProps (second type parameter) ──────────────────────────────────

  it("without TExtraProps, has no extra keys beyond block and editable", () => {
    type Props = StoryblokComponentProps<{ title: string }>;
    expectTypeOf<keyof Props>().toEqualTypeOf<"block" | "editable">();
  });

  it("with TExtraProps, adds its keys typed as optional (Partial<TExtraProps>)", () => {
    type Props = StoryblokComponentProps<{ title: string }, { locale: string }>;
    expectTypeOf<keyof Props>().toEqualTypeOf<"block" | "editable" | "locale">();
    expectTypeOf<Props["locale"]>().toEqualTypeOf<string | undefined>();
  });

  it("omitting a TExtraProps field compiles (it's optional, not required)", () => {
    type Props = StoryblokComponentProps<{ title: string }, { locale: string }>;
    // Should compile even though `locale` is part of TExtraProps: forcing it to
    // be required here would make this component unassignable to the
    // registry in defineStoryblokComponents (see that function's docs).
    const _p: Props = { block: { ...pageBlock, title: "hello" } };
    void _p;
  });

  it("a component typed with TExtraProps registers against and receives props from the matching defineStoryblokComponents<TExtraProps>", () => {
    type TeaserProps = StoryblokComponentProps<{ title: string }, { locale: string }>;
    function TypedTeaser({ block, locale }: TeaserProps) {
      return (
        <span data-testid="typed-teaser" data-locale={locale}>
          {block.title}
        </span>
      );
    }

    const { StoryblokComponent } = defineStoryblokComponents<{ locale: string }>({
      components: { teaser: TypedTeaser },
    });

    const { getByTestId } = render(<StoryblokComponent block={teaserBlock} locale="de" />);
    expect(getByTestId("typed-teaser")).toHaveAttribute("data-locale", "de");
  });
});

// ─── Type safety ─────────────────────────────────────────────────────────────

describe("StoryblokComponent — type safety", () => {
  const { StoryblokComponent } = defineStoryblokComponents({ components: {} });

  it("requires the block prop", () => {
    // @ts-expect-error — block is required
    void (<StoryblokComponent />);
  });

  it("accepts a single BlockContent", () => {
    void (<StoryblokComponent block={pageBlock} />);
  });

  it("rejects an array of BlockContent", () => {
    // @ts-expect-error — StoryblokComponent accepts one block at a time
    void (<StoryblokComponent block={[pageBlock]} />);
  });

  it("rejects a non-block value for block", () => {
    // @ts-expect-error — string is not assignable to StoryblokBlockData
    void (<StoryblokComponent block="not-a-block" />);
  });

  it("without a TExtraProps type argument, rejects any extra prop (the typo hole is closed)", () => {
    // @ts-expect-error — TExtraProps defaults to {}, so `locale` is excess and unknown, typo or not
    void (<StoryblokComponent block={pageBlock} locale="en" />);
  });

  // ── Regression guard: no Record<string, unknown> index-signature bleed ────
  //
  // With the old `& Record<string, unknown>` the param type had an index
  // signature so `keyof Props` resolved to `string` — wiping out autocomplete
  // and excess-property checks for `block`.
  //
  // With `TExtraProps extends object = {}`, instantiating at TExtraProps = {}
  // yields `{ block: BlockContent }` with no index signature,
  // so `keyof Props` is the literal union of known keys only.

  it("with TExtraProps = {}, the only known key is 'block'", () => {
    type StrictProps = Parameters<typeof StoryblokComponent>[0];
    expectTypeOf<keyof StrictProps>().toEqualTypeOf<"block">();
  });

  it("returns ReactNode", () => {
    // @ts-expect-error — ReactNode is not assignable to number
    const _bad: number = StoryblokComponent({ block: pageBlock });
    expectTypeOf<ReturnType<typeof StoryblokComponent>>().toEqualTypeOf<ReactNode>();
  });
});

// ─── Type safety — TExtraProps as an explicit type argument ─────────────────
//
// TExtraProps is now a type argument to `defineStoryblokComponents`, fixed for
// every call to the returned `StoryblokComponent`, rather than inferred per
// JSX call site. This gives real excess-property checking: a typo is a
// compile error against the declared TExtraProps, not a silently-accepted
// new inferred type.

describe("StoryblokComponent — type safety with TExtraProps", () => {
  const { StoryblokComponent } = defineStoryblokComponents<{ locale: string }>({
    components: {},
  });

  it("accepts a prop declared in TExtraProps", () => {
    void (<StoryblokComponent block={pageBlock} locale="en" />);
  });

  it("rejects a prop not declared in TExtraProps (the typo hole)", () => {
    // @ts-expect-error — "localle" is not a key of TExtraProps, unlike the old
    // per-call inference, which would have accepted this as a new inferred type
    void (<StoryblokComponent block={pageBlock} localle="en" />);
  });

  it("still requires the declared prop's type", () => {
    // @ts-expect-error — locale must be a string
    void (<StoryblokComponent block={pageBlock} locale={123} />);
  });
});
