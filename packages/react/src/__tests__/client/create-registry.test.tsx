import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { BlockContent } from "@storyblok/live-preview";
import { createRegistry } from "../../create-registry";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const pageBlock = { component: "page", _uid: "uid-page" } as BlockContent;
const teaserBlock = { component: "teaser", _uid: "uid-teaser", title: "Hello" } as BlockContent;
const unknownBlock = { component: "unknown", _uid: "uid-unknown" } as BlockContent;

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

describe("createRegistry", () => {
  it("returns StoryblokComponent and StoryblokRichText", () => {
    const registry = createRegistry({ components: {} });
    expect(typeof registry.StoryblokComponent).toBe("function");
    expect(typeof registry.StoryblokRichText).toBe("function");
  });

  // ─── StoryblokComponent — single block ────────────────────────────────────

  describe("StoryblokComponent — single block", () => {
    it("renders the component matching block.component", () => {
      const { StoryblokComponent } = createRegistry({ components: { page: Page } });
      const { getByTestId } = render(<StoryblokComponent block={pageBlock} />);
      expect(getByTestId("page")).toHaveTextContent("uid-page");
    });

    it("passes extra props through to the registered component", () => {
      function WithExtra({ _block, extra }: { _block: BlockContent; extra?: string }) {
        return <div data-testid="extra">{extra}</div>;
      }
      const { StoryblokComponent } = createRegistry({ components: { widget: WithExtra } });
      const block = { component: "widget", _uid: "w1" } as BlockContent;
      const { getByTestId } = render(<StoryblokComponent block={block} extra="hello" />);
      expect(getByTestId("extra")).toHaveTextContent("hello");
    });

    it("renders the fallback component when the block type is not registered", () => {
      const { StoryblokComponent } = createRegistry({
        components: { page: Page },
        fallback: Fallback,
      });
      const { getByTestId } = render(<StoryblokComponent block={unknownBlock} />);
      expect(getByTestId("fallback")).toHaveTextContent("unknown");
    });

    it("returns null and logs a warning when no match and no fallback", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { StoryblokComponent } = createRegistry({ components: {} });
      const { container } = render(<StoryblokComponent block={unknownBlock} />);
      expect(container.firstChild).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('[Storyblok] No component registered for "unknown".');
      consoleSpy.mockRestore();
    });

    it("returns null and logs an error when the block prop is missing", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { StoryblokComponent } = createRegistry({ components: {} });
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
      const { StoryblokComponent } = createRegistry({
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
      const { StoryblokComponent } = createRegistry({
        components: {
          teaser: {
            component: LazyTeaser,
            fallback: <div data-testid="skeleton">loading</div>,
            suspense: true,
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
      const { StoryblokComponent } = createRegistry({
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
      const { StoryblokComponent } = createRegistry({
        components: { page: Page, teaser: Teaser },
      });
      const { getByTestId } = render(<StoryblokComponent block={[pageBlock, teaserBlock]} />);
      expect(getByTestId("page")).toBeInTheDocument();
      expect(getByTestId("teaser")).toBeInTheDocument();
    });

    it("returns null for an empty array", () => {
      const { StoryblokComponent } = createRegistry({ components: {} });
      const { container } = render(<StoryblokComponent block={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it("renders the registry fallback for unknown block types within a list", () => {
      const { StoryblokComponent } = createRegistry({
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
      const { StoryblokComponent } = createRegistry({ components: { page: Page } });
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
      const { StoryblokRichText } = createRegistry({ components: {} });
      expect(typeof StoryblokRichText).toBe("function");
    });

    it("renders a simple rich-text document", () => {
      const { StoryblokRichText } = createRegistry({ components: {} });
      const doc = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
      };
      const { container } = render(<StoryblokRichText document={doc as any} />);
      expect(container.textContent).toContain("Hello");
    });

    it("renders embedded blocks via the same registry's StoryblokComponent", () => {
      const { StoryblokRichText } = createRegistry({ components: { page: Page } });
      // A rich-text document with a blok node (Storyblok API node type)
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

  // ─── Registry isolation ────────────────────────────────────────────────────

  describe("registry isolation", () => {
    it("two registries do not share component maps", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const registryA = createRegistry({ components: { page: Page } });
      const registryB = createRegistry({ components: { teaser: Teaser } });

      render(<registryA.StoryblokComponent block={teaserBlock} />);
      expect(consoleSpy).toHaveBeenCalledWith('[Storyblok] No component registered for "teaser".');
      consoleSpy.mockRestore();

      const { getByTestId } = render(<registryB.StoryblokComponent block={teaserBlock} />);
      expect(getByTestId("teaser")).toBeInTheDocument();
    });
  });
});
