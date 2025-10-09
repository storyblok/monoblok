# Testing

- We use Vitest for running unit and integration tests of regular packages.
  - For playground applications, we use Playwright for integration testing.
- Prefer explicit imports of `it`, `expect`, and other test functions from `@storyblok/test-utils/vitest` or `@storyblok/test-utils/playwright`.
- Tests begin with `it("should ...")`
  - `it` (the function, component, or system under test) `should` (behave in the following way).

## Unit tests

- We use unit tests to test business logic.
- We avoid mocking dependencies and structure our code in a way that makes mocking unnecessary.
- We use mocking to avoid side effects like writing to the file system or making requests to HTTP endpoints.

## Integration tests

- We use integration tests to ensure specific features work as expected in the same scenarios a user would use them.
- We avoid mocking as much as possible (even for side effects) but may sometimes decide to mock, for example, the file system.
- For testing functionality that triggers requests to HTTP endpoints, we use an OpenAPI specification-driven stub server.

### Specmatic stub server

- [Specmatic](https://specmatic.io) allows us to quickly spin up a stub server based on OpenAPI specifications of our CAPI and MAPI endpoints.
- We use an abstraction pattern we call `Preconditions` to configure particular responses from the stub server.

**Configuration with `specmatic.json`:**

To tell the stub server which OpenAPI specifications to use, we must create a `specmatic.json` file in the root directory of our package. We must also install the `@storyblok/openapi` package as a dev dependency:

```json
{
  "version": 2,
  "contracts": [
    {
      "consumes": [
        "./node_modules/@storyblok/openapi/dist/mapi/stories.yaml"
      ]
    }
  ]
}
```

**Examples:**

```ts
import type { Story } from "@storyblok/management-api-client/resources/stories";
import type { ExampleStore } from "../utils/stub-server.ts";
import { makeStory } from "./stories.ts";

export const hasStory =
  ({ story = makeStory() }: { story?: Story } = {}) =>
  ({ store }: { store: ExampleStore }) =>
    // The example store holds request/response examples for the stub server.
    store.add({
      // Given a request like this...
      request: {
        method: "GET",
        path: `/v1/cdn/stories/${story.slug}`,
      },
      // ...the stub server will respond with this.
      response: {
        status: 200,
        body: { story },
      },
      // Match this example even if the request is only a partial match
      // (e.g., additional query parameters are sent).
      partial: true,
    });
```

### Integration tests with Vitest

- We use Vitest to power integration tests for regular packages.

**Examples:**

```ts
import StoryblokClient from 'storyblok-js-client';
import { describe, expect, it } from '@storyblok/test-utils/vitest';
import { hasStories } from '@storyblok/test-utils/preconditions/stories-mapi';
import { makeStory } from '@storyblok/test-utils/preconditions/stories';

const makeMapi = ({ baseURL }: { baseURL: string }) => new StoryblokClient({
  oauthToken: 'Bearer super-valid-token',
  endpoint: `${baseURL}/v1`,
});

describe('getAll()', () => {
  it('should return a list of stories', async ({ prepare, stubServer }) => {
    // Create a MAPI client instance using the stub server's baseURL.
    const mapi = makeMapi(stubServer);
    // Use the `makeStory` precondition helper to create a new story with a
    // particular name, using default values for all other attributes.
    const story = makeStory({ name: 'foo bar' });
    // Use the `prepare` helper to send the `hasStories` precondition to the
    // stub server.
    await prepare(hasStories({ spaceId: '123', stories: [story] }));

    // The MAPI client is configured to make a request to the stub server...
    const result = await mapi.getAll(
      `spaces/123/stories`,
    );

    // ...which should return the result we prepared above.
    expect(result[0].name).toBe('foo bar');
    expect(result).toEqual([story]);
  });
});
```

```ts
import { expect, it, vi } from '@storyblok/test-utils/vitest';
import { canNotUpdateStory, hasStory } from '@storyblok/test-utils/preconditions/stories-mapi';
import { makeBlok, makeStory } from '@storyblok/test-utils/preconditions/stories';
import '../index';
import { migrationsCommand } from '../command';
import { konsola } from '../../../utils';

process.env.STORYBLOK_LOGIN = 'foo';
process.env.STORYBLOK_TOKEN = 'Bearer foo.bar.baz';
process.env.STORYBLOK_REGION = 'eu';
// We can configure the CLI `baseUrl` via an environment variable.
process.env.STORYBLOK_BASE_URL = 'http://localhost:9000';

it('should handle dry run mode correctly', async ({ prepare, stubServer }) => {
  // We configure the environment variable to use the current
  // `stubServer.baseURL`.
  process.env.STORYBLOK_BASE_URL = stubServer.baseURL;
  const story = makeStory({
    content: makeBlok({
      field: 'original',
      component: 'migration-component',
    }),
  });
  const spaceId = '12345';
  await prepare([
    hasStory({ spaceId, story }),
    // If the update endpoint is called while the `dry-run` flag is enabled,
    // the request will fail and the console output will mention the failed
    // update.
    canNotUpdateStory({ spaceId, storyId: story.id }),
  ]);
  using konsolaWarnSpy = vi.spyOn(konsola, 'warn');
  using konsolaInfoSpy = vi.spyOn(konsola, 'info');

  // Run the command with the --dry-run flag.
  await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', spaceId, '--dry-run', '--path', './src/commands/migrations/run/__data__']);

  expect(konsolaWarnSpy).toHaveBeenCalledWith(
    expect.stringContaining('DRY RUN MODE ENABLED: No changes will be made.'),
  );
  expect(konsolaInfoSpy).toHaveBeenCalledWith(
    expect.stringContaining('Migration Results: 1 stories updated, 0 stories skipped.'),
  );
  expect(konsolaInfoSpy).toHaveBeenCalledWith(
    expect.stringContaining('Update Results: 1 stories updated.'),
  );
});
```

### Integration tests with Playwright

- We use Playwright to run integration tests for playground applications.

**Examples:**

```ts
import { it, expect } from '@storyblok/test-utils/playwright';
import { hasStory } from '@storyblok/test-utils/preconditions/stories-capi';
import { makeStory, makeBlok } from "@storyblok/test-utils/preconditions/stories";

it('should render the emoji randomizer', async ({ page, startApp }) => {
  // The `startApp` command injects the `STORYBLOK_API_ENDPOINT` environment
  // variable, pointing to the current stub server instance. It also accepts
  // an array of preconditions to configure the server's responses.
  await startApp('pnpm start', [hasStory({
    story: makeStory({
      slug: 'react',
      content: makeBlok({
        component: "page",
        body: [
          makeBlok({
            label: "Randomize Emoji",
            component: "emoji-randomizer",
          })
        ]
      })
    })
  })]);

  await page.goto('/');

  await expect(page.getByRole('button', { name: "Randomize Emoji" })).toBeVisible();
});
```
