import React, { forwardRef, memo, useState, useEffect, Suspense } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import type { StoryblokBlockData } from "./types";
import { defineStoryblokComponents } from "./define-storyblok-components";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeBlockData(
  overrides: { component: string } & Partial<StoryblokBlockData>,
): StoryblokBlockData {
  return { _uid: "test-uid", ...overrides };
}

const pageBlock = makeBlockData({ component: "page", _uid: "uid-page" });
const teaserBlock = makeBlockData({ component: "teaser", _uid: "uid-teaser", title: "Hello" });
const unknownBlock = makeBlockData({ component: "unknown", _uid: "uid-unknown" });

function Page({ block }: { block: StoryblokBlockData }) {
  return <div data-testid="page">{block._uid}</div>;
}

function Teaser({ block }: { block: StoryblokBlockData & { title?: string } }) {
  return <span data-testid="teaser">{block.title as string}</span>;
}

function Fallback({ block }: { block: StoryblokBlockData }) {
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
      function WithExtra({ _block, extra }: { _block: StoryblokBlockData; extra?: string }) {
        return <div data-testid="extra">{extra}</div>;
      }
      const { StoryblokComponent } = defineStoryblokComponents({
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
      const LazyPage = React.lazy(
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

    it("auto-wraps React.lazy components in Suspense without explicit suspense: true", async () => {
      const LazyTeaser = React.lazy(
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

    it("uses the registry-level suspenseFallback when the entry omits its own fallback", async () => {
      const LazyPage = React.lazy(
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

  // ─── StoryblokComponent — array of blocks ─────────────────────────────────

  describe("StoryblokComponent — array of blocks", () => {
    it("renders every block in the array", () => {
      const { StoryblokComponent } = defineStoryblokComponents({
        components: { page: Page, teaser: Teaser },
      });
      const { getByTestId } = render(<StoryblokComponent block={[pageBlock, teaserBlock]} />);
      expect(getByTestId("page")).toBeInTheDocument();
      expect(getByTestId("teaser")).toBeInTheDocument();
    });

    it("returns null for an empty array", () => {
      const { StoryblokComponent } = defineStoryblokComponents({ components: {} });
      const { container } = render(<StoryblokComponent block={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it("renders the registry fallback for unknown block types within a list", () => {
      const { StoryblokComponent } = defineStoryblokComponents({
        components: { page: Page },
        fallback: Fallback,
      });
      const { getByTestId, getAllByTestId } = render(
        <StoryblokComponent block={[pageBlock, unknownBlock]} />,
      );
      expect(getByTestId("page")).toBeInTheDocument();
      const fallbacks = getAllByTestId("fallback");
      expect(fallbacks).toHaveLength(1);
      expect(fallbacks[0]).toHaveTextContent("unknown");
    });

    it("uses block._uid as the React key (no key warning)", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { StoryblokComponent } = defineStoryblokComponents({ components: { page: Page } });
      render(<StoryblokComponent block={[pageBlock]} />);
      const keyWarning = (consoleSpy.mock.calls as string[][]).some((args) =>
        args.some((a) => typeof a === "string" && a.toLowerCase().includes("key")),
      );
      expect(keyWarning).toBe(false);
      consoleSpy.mockRestore();
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
      const doc = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
      };
      const { container } = render(<StoryblokRichText document={doc as any} />);
      expect(container.textContent).toContain("Hello");
    });

    it("renders embedded blocks via the same component map's StoryblokComponent", () => {
      const { StoryblokRichText } = defineStoryblokComponents({ components: { page: Page } });
      const doc = {
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
      const { getByTestId } = render(<StoryblokRichText document={doc as any} />);
      expect(getByTestId("page")).toBeInTheDocument();
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
      const ForwardRefTeaser = forwardRef<HTMLSpanElement, { block: StoryblokBlockData }>(
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
  //                 Internally uses React.lazy but wraps with Fragment (not
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
   * Returns a plain function that wraps React.lazy in a Fragment.
   * typeof === "function", no $$typeof → isLazyComponent() === false.
   */
  function makeAppRouterDynamic<T extends React.ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
  ): React.FC<any> {
    const Lazy = React.lazy(importFn);
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
  function makePagesRouterDynamic<T extends React.ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
  ) {
    return forwardRef<unknown, any>((props, _ref) => {
      const [Comp, setComp] = useState<T | null>(null);
      useEffect(() => {
        importFn().then((mod) => setComp(() => mod.default));
      }, []);
      // Default loading option is null in Pages Router dynamic.
      if (!Comp) return null;
      return <Comp {...props} />;
    });
  }

  // Helper to build a deferred import promise so tests can control resolution.
  function makeDeferred<T extends React.ComponentType<any>>(
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
