import { describe, expect, it } from "vitest";
import { getPayload } from "../src/get-payload";

describe("getPayload", () => {
  it("returns empty values outside the editor", async () => {
    const result = await getPayload({ locals: {} });

    expect(result).toEqual({ story: undefined, serverData: undefined });
  });

  it("reads the story and serverData captured by storyblokPreviewMiddleware", async () => {
    const story = { content: { component: "page" } };
    const serverData = { users: [{ id: 1 }] };

    const result = await getPayload({
      locals: { _storyblok_preview_data: { story, serverData } },
    });

    expect(result).toEqual({ story, serverData });
  });
});
