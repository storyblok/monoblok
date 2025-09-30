import type { Story } from "@storyblok/management-api-client/resources/stories";
import type { ExampleStore } from "../utils/stub-server.ts";
import { makeStory } from "./stories.ts";

export const hasStories =
  ({
    spaceId,
    stories = [makeStory(), makeStory(), makeStory()],
  }: {
    spaceId: string;
    stories: Story[];
  }) =>
  ({ store }: { store: ExampleStore }) =>
    store.add({
      request: {
        method: "GET",
        path: `/v1/spaces/${spaceId}/stories`,
      },
      response: {
        status: 200,
        headers: {
          Total: stories.length,
          "Per-Page": 25,
        },
        body: { stories },
      },
      partial: true,
    });

export const hasStory =
  ({ spaceId, story = makeStory() }: { spaceId: string; story?: Story }) =>
  async ({ store }: { store: ExampleStore }) => {
    await Promise.all([
      store.add({
        request: {
          method: "GET",
          path: `/v1/spaces/${spaceId}/stories/${story.id}`,
        },
        response: {
          status: 200,
          body: { story },
        },
        partial: true,
      }),
      hasStories({ spaceId, stories: [story] })({ store }),
    ]);
  };

export const canNotUpdateStory =
  ({ spaceId, storyId }: { spaceId: string; storyId: Story["id"] }) =>
  ({ store }: { store: ExampleStore }) =>
    store.add({
      request: {
        method: "PUT",
        path: `/v1/spaces/${spaceId}/stories/${storyId}`,
        body: {},
      },
      response: {
        status: 500,
      },
      partial: true,
    });
