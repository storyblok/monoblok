import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { setComponents } from "../core/state";
import { renderLiveEditStory } from "../rsc/live-edit-render-action";

function Marker({ blok, className }: { blok: { label?: string }; className?: string }) {
  return (
    <span data-testid="marker" className={className}>
      {blok.label}
    </span>
  );
}

/** Simulates a caller sending any payload, bypassing the TypeScript signature. */
const callUntyped = (payload: unknown): Promise<unknown> =>
  Reflect.apply(renderLiveEditStory, undefined, [payload]);

const renderNode = (node: ReactNode) => render(<>{node}</>);

describe("renderLiveEditStory", () => {
  beforeEach(() => {
    setComponents({ marker: Marker });
  });

  it("renders the story content with the registered components", async () => {
    const result = await renderLiveEditStory({
      story: { content: { _uid: "1", component: "marker", label: "live" } },
      props: { className: "hero" },
    });

    expect(result.ok).toBe(true);
    const { getByTestId } = renderNode("node" in result ? result.node : null);
    expect(getByTestId("marker").textContent).toBe("live");
    expect(getByTestId("marker").className).toBe("hero");
  });

  it("parses string content", async () => {
    const result = await renderLiveEditStory({
      story: { content: JSON.stringify({ _uid: "1", component: "marker", label: "json" }) },
    });

    const { getByTestId } = renderNode("node" in result ? result.node : null);
    expect(getByTestId("marker").textContent).toBe("json");
  });

  it("drops props that aren't primitives", async () => {
    const result = await callUntyped({
      story: { content: { _uid: "1", component: "marker", label: "live" } },
      props: { className: { toString: () => "evil" } },
    });

    const { getByTestId } = renderNode(
      result && typeof result === "object" && "node" in result ? (result.node as ReactNode) : null,
    );
    expect(getByTestId("marker").className).toBe("");
  });

  it.each([
    ["no payload", undefined],
    ["no story", { story: null }],
    ["content without a component", { story: { content: { label: "x" } } }],
    ["invalid JSON content", { story: { content: "{not json" } }],
    ["array content", { story: { content: [] } }],
  ])("rejects %s", async (_label, payload) => {
    await expect(callUntyped(payload)).resolves.toEqual({ ok: false });
  });

  it("asks the client to retry when this server instance has no components yet", async () => {
    // A fresh module instance stands in for a cold server instance (or a
    // separate bundle layer) where the app's `storyblokInit` hasn't run.
    vi.resetModules();
    const { renderLiveEditStory: coldAction } = await import("../rsc/live-edit-render-action");

    await expect(
      coldAction({ story: { content: { _uid: "1", component: "marker" } } }),
    ).resolves.toEqual({ ok: false, retry: true });
  });

  it("keeps no state between calls", async () => {
    await renderLiveEditStory({
      story: { content: { _uid: "1", component: "marker", label: "first" } },
    });

    expect(Reflect.has(globalThis, "storyCache")).toBe(false);
  });
});
