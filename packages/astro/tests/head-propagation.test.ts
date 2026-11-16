import { describe, expect, it } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { defineStoryblokBlocks } from "../src/define-storyblok-blocks";
import Page from "./propagation-fixtures/Page.astro";
import { PropagatingBlock } from "./propagation-fixtures/propagating-block";

const headOf = (html: string) => html.slice(0, html.indexOf("</head>"));

const block = { _uid: "1", component: "propagating" };

describe("head propagation through the block registry", () => {
  it("should hoist a block's head content into <head> when rendered by StoryblokBlock", async () => {
    const { StoryblokBlock } = defineStoryblokBlocks(() => ({
      components: { propagating: PropagatingBlock },
    }));
    const container = await AstroContainer.create();

    const html = await container.renderToString(Page, {
      partial: false,
      props: { Component: StoryblokBlock, block },
    });

    expect(html).toContain('data-test="propagated-content"');
    expect(headOf(html)).toContain('data-test="propagated-style"');
  });

  it("should hoist a block's head content into <head> when embedded in rich text", async () => {
    const { StoryblokRichText } = defineStoryblokBlocks(() => ({
      components: { propagating: PropagatingBlock },
    }));
    const container = await AstroContainer.create();

    const html = await container.renderToString(Page, {
      partial: false,
      props: {
        Component: StoryblokRichText,
        document: { type: "doc", content: [{ type: "blok", attrs: { id: "x", body: [block] } }] },
      },
    });

    expect(html).toContain('data-test="propagated-content"');
    expect(headOf(html)).toContain('data-test="propagated-style"');
  });

  it("should hoist a block's head content nested inside another rich text node", async () => {
    const { StoryblokRichText } = defineStoryblokBlocks(() => ({
      components: { propagating: PropagatingBlock },
    }));
    const container = await AstroContainer.create();

    const html = await container.renderToString(Page, {
      partial: false,
      props: {
        Component: StoryblokRichText,
        document: {
          type: "doc",
          content: [
            {
              type: "blockquote",
              content: [{ type: "blok", attrs: { id: "x", body: [block] } }],
            },
          ],
        },
      },
    });

    expect(html).toContain('data-test="propagated-content"');
    expect(headOf(html)).toContain('data-test="propagated-style"');
  });

  it("should hoist a custom mark component's head content into <head>", async () => {
    const { StoryblokRichText } = defineStoryblokBlocks(() => ({ components: {} }));
    const container = await AstroContainer.create();

    const html = await container.renderToString(Page, {
      partial: false,
      props: {
        Component: StoryblokRichText,
        components: { bold: PropagatingBlock },
        document: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Bold", marks: [{ type: "bold" }] }],
            },
          ],
        },
      },
    });

    expect(html).toContain('data-test="propagated-content"');
    expect(headOf(html)).toContain('data-test="propagated-style"');
  });

  it("should hoist head content for a block imported directly (control)", async () => {
    const container = await AstroContainer.create();

    const html = await container.renderToString(Page, {
      partial: false,
      props: { Component: PropagatingBlock },
    });

    expect(headOf(html)).toContain('data-test="propagated-style"');
  });
});
