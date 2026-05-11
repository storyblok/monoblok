# Storyblok CLI Agent Guidelines

## Where to put code

| Need | Put it here |
| --- | --- |
| Top-level CLI registration | `src/index.ts` import |
| Commander command definition | `src/commands/<name>/index.ts` or `command.ts` |
| API calls, filesystem writes, transformations | `actions.ts` |
| Option constants | `constants.ts` |
| Reusable option types | `types.ts` |
| Shared CLI utilities | `src/utils/` |
| Config resolution, global option behavior | `src/lib/config/` |
| Structured logs | `src/lib/logger/` |
| Machine-readable command reports | `src/lib/reporter/` |

## Terminal output

| If you need | Use |
| --- | --- |
| User-facing text, titles, warnings, blank lines | `const ui = getUI()` |
| Progress spinners | `ui.createSpinner()` |
| Progress bars | `ui.createProgressBar()` |
| Operational diagnostics | `const logger = getLogger()` |
| Command errors | `handleError(new CommandError(...), verbose)` |

Do not add `console.*`, raw `Spinner`, or direct `konsola.*` calls in new or migrated command code. Use `getUI()` for user-facing output and `getLogger()` for structured diagnostics.

## Tests

Keep tests close to the changed file. Use simple input/output assertions for pure helpers:

```ts
import { describe, expect, it } from 'vitest';
import { slugify } from './format';

describe('slugify', () => {
  it('should convert text to a URL-friendly slug', () => {
    expect(slugify('Hello World!')).toBe('hello-world');
  });
});
```

Use command execution and named preconditions when behavior depends on external state such as files, API responses, or session state:

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { vol } from 'memfs';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import '../index';
import { storiesCommand } from '../command';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const preconditions = {
  hasEmptyStoriesDirectory() {
    vol.fromJSON({
      '.storyblok/stories/12345/.gitkeep': '',
    });
  },
  canPullStory(story: { id: number; slug: string; uuid: string }) {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/12345/stories', () =>
        HttpResponse.json({ stories: [story] }, {
          headers: { 'Total': '1', 'Per-Page': '100' },
        })),
      http.get(`https://mapi.storyblok.com/v1/spaces/12345/stories/${story.id}`, () =>
        HttpResponse.json({ story })),
    );
  },
};

describe('stories pull command', () => {
  it('should pull stories into the local workspace', async () => {
    const story = { id: 1, slug: 'home', uuid: 'story-uuid' };
    preconditions.hasEmptyStoriesDirectory();
    preconditions.canPullStory(story);

    await storiesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);

    expect(Object.keys(vol.toJSON())).toEqual(
      expect.arrayContaining([expect.stringContaining('home_story-uuid.json')]),
    );
  });
});
```

## Command patterns

Parent commands expose a shared command instance:

```ts
export const componentsCommand = program
  .command(commands.COMPONENTS)
  .alias('comp')
  .description(`Manage your space's block schema`);
```

Subcommands import the parent command, define options, and keep the action thin:

```ts
const pullCmd = componentsCommand
  .command('pull [componentName]')
  .option('-s, --space <space>', 'space ID')
  .description(`Download your space's components schema as JSON.`);
```

Use global options from Commander after config resolution:

```ts
const { space, path, verbose } = command.optsWithGlobals();
```

Use the UI module and stop every spinner on all return paths:

```ts
const ui = getUI();
const spinner = ui.createSpinner('Fetching components');

if (!components?.length) {
  spinner.failed(`No components found in the space ${space}`);
  return;
}

spinner.succeed(`Components fetched`);
```

Use the logger for non-user-facing runtime details:

```ts
const logger = getLogger();
logger.info('Pulling components started', { space, componentName });
```
