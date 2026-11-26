import { describe, expect, it } from "vitest";
import * as root from "./index";
import { StoryblokPreview as ClientStoryblokPreview } from "./client";
import { StoryblokPreview as RscStoryblokPreview } from "./rsc";
import * as server from "./server";

describe("react-server entry", () => {
  it("should export the Server Component StoryblokPreview", () => {
    expect(server.StoryblokPreview).toBe(RscStoryblokPreview);
    expect(server.StoryblokPreview).not.toBe(ClientStoryblokPreview);
  });

  it("should export everything else the root entry exports", () => {
    expect(Object.keys(server).sort()).toEqual(Object.keys(root).sort());
    for (const name of Object.keys(root).filter((key) => key !== "StoryblokPreview")) {
      expect(server[name as keyof typeof server]).toBe(root[name as keyof typeof root]);
    }
  });
});
