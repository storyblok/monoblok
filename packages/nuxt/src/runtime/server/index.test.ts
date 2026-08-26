import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConfig: any = {
  storyblok: {},
  public: { storyblok: {} },
};

vi.mock("#imports", () => ({
  useRuntimeConfig: () => mockConfig,
}));

import { serverStoryblokClient } from "./index";

const createEvent = () => ({ context: {} as Record<string, unknown> }) as any;

describe("serverStoryblokClient", () => {
  beforeEach(() => {
    mockConfig.storyblok = {};
    mockConfig.public.storyblok = {};
  });

  it("should throw when the access token is missing", () => {
    mockConfig.storyblok = { accessToken: "" };

    expect(() => serverStoryblokClient(createEvent())).toThrow(/access token is not configured/i);
  });

  it("should create and cache a client on event.context across calls", () => {
    mockConfig.storyblok = { accessToken: "test-token" };
    mockConfig.public.storyblok = { apiOptions: {} };
    const event = createEvent();

    const first = serverStoryblokClient(event);
    const second = serverStoryblokClient(event);

    expect(second).toBe(first);
  });
});
