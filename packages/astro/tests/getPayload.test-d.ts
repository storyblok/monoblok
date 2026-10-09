import { describe, expectTypeOf, it } from "vitest";
import { getPayload } from "../src/get-payload";

describe("getPayload typing", () => {
  it("accepts `locals` whose own augmentation declares unrelated fields", async () => {
    // Reproduces `App.Locals` declaring a field of its own, e.g. `user`. An
    // inline `{ _storyblok_preview_data?: ... }` parameter type used to
    // trigger TS2559 ("has no properties in common") here.
    interface Locals {
      user: string;
    }
    const locals: Locals = { user: "jane" };

    const payload = await getPayload({ locals });

    expectTypeOf(payload.story).toEqualTypeOf(payload.story);
  });

  it("defaults the story type to a usable shape instead of `unknown`", async () => {
    const payload = await getPayload({ locals: {} });
    const fetched = { content: { component: "page" } };

    // Didn't type-check before: `Story` defaulted to `unknown`, so
    // `payload.story ?? fetched` collapsed to `{}` and `.content` failed.
    const story = payload.story ?? fetched;
    expectTypeOf(story.content).not.toBeNever();
  });
});
