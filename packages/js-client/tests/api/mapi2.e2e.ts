import StoryblokClient from 'storyblok-js-client';
// TODO
import { describe, expect, it } from '../../../test-utils/src/unit-test/utils';
import { hasStories, makeStory } from '../../../test-utils/src/preconditions/stories';

const makeMapi = ({ baseURL }: { baseURL: string }) => new StoryblokClient({
  oauthToken: 'Bearer super-valid-token',
  endpoint: `${baseURL}/v1`,
});

describe('getAll()', () => {
  for (let i = 0; i < 100; i++) {
    it(`2.${i}: should return a list of stories`, async ({ prepare, stubServer }) => {
      const mapi = makeMapi(stubServer);

      await prepare(hasStories({ spaceId: '123', stories: [] }));
      const resultEmpty = await mapi.getAll(
        `spaces/123/stories`,
      );
      expect(resultEmpty.length).toBe(0);

      const story = makeStory({ name: 'foo bar' });
      await prepare(hasStories({ spaceId: '123', stories: [story] }));
      const result = await mapi.getAll(
        `spaces/123/stories`,
      );
      expect(result[0].name).toBe(story.name);
    });
  }
});
