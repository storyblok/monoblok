import type { Story } from "@storyblok/management-api-client/resources/stories";
import type { ExampleStore } from "../utils/stub-server.ts";
import { makeStory } from "./stories.ts";

export const hasStory =
  ({ story = makeStory() }: { story?: Story } = {}) =>
  ({ store }: { store: ExampleStore }) =>
    store.add({
      request: {
        method: "GET",
        path: `/v1/cdn/stories/${story.slug}`,
      },
      response: {
        status: 200,
        body: { story },
      },
      partial: true,
    });
