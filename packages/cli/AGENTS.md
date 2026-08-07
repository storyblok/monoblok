# Storyblok CLI Agent Guidelines

## Where to put code

| Need | Put it here |
| --- | --- |
| Top-level CLI registration | `src/index.ts` import |
| Module initialization, global `preAction` behavior | `src/program.ts` |
| Commander command definition | `src/commands/<name>/index.ts` or `command.ts` |
| API calls, filesystem writes, transformations | `actions.ts` |
| Option constants | `constants.ts` |
| Reusable option types | `types.ts` |
| Utilities shared by sibling subcommands | parent command directory (e.g. `schema/serialize.ts`, not `schema/push/serialize.ts`) — subcommands must not import from each other |
| Shared CLI utilities | `src/utils/` |
| User-facing terminal output | `src/lib/ui/` |
| Config resolution, global option behavior | `src/lib/config/` |
| Structured logs | `src/lib/logger/` |
| Machine-readable command reports | `src/lib/reporter/` |
| Validation issue filtering, grouping, and formatting | `src/lib/validation/` |

## Module initialization

The `preAction` hook in `src/program.ts` initializes everything in order: config → session and API client → logger → UI → reporter → command action. Anything a command action relies on is already resolved by the time it runs, so read config through `command.optsWithGlobals()` and reach for modules through their getters rather than initializing them yourself.

## Terminal output

| If you need | Use |
| --- | --- |
| User-facing text, titles, warnings, blank lines | `const ui = getUI()` |
| Progress spinners | `ui.createSpinner()` |
| Progress bars | `ui.createProgressBar()` |
| Interactive prompts | `await select({...}, stderrPromptContext)` |
| Operational diagnostics | `const logger = getLogger()` |
| Command errors | `handleError(new CommandError(...), verbose)` |

All UI output routes to stderr. Do not add `console.*` or raw `Spinner` calls in command code. Use `getUI()` for user-facing output and `getLogger()` for structured diagnostics. Error handling uses `handleError()` which sets `process.exitCode` (1 for runtime errors, 2 for `CommandError`).

Every `@inquirer/prompts` call (`select`, `confirm`, `input`, `password`) must pass `stderrPromptContext` (from `src/lib/ui/`) as the second argument so prompt rendering goes to stderr, not stdout:

```ts
import { select } from '@inquirer/prompts';
import { stderrPromptContext } from '../../lib/ui';

const region = await select({ message: 'Select region:', choices }, stderrPromptContext);
```

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
import { join } from 'pathe';

import '../index';
import { storiesCommand } from '../command';
import { directories } from '../../constants';
import { resolveCommandPath } from '../../utils/filesystem';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const storiesDir = resolveCommandPath(directories.stories, '12345');

const preconditions = {
  hasEmptyStoriesDirectory() {
    vol.fromJSON({
      [join(storiesDir, '.gitkeep')]: '',
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

Resolve paths with `resolveCommandPath` and the `directories` constants instead of hardcoding `.storyblok/...`, so a layout change does not break every test. Name each precondition after the state it establishes, including the failure ones (`failsToUpdateRemoteStories`), so a test reads as its own setup.

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

## Older commands

Not every command has been migrated. When you touch one that has not, bring it along:

1. Replace raw `Spinner` with `ui.createSpinner()`, which handles test suppression itself
2. Remove `isVitest`; command code must never import it
3. Add `getLogger()` for structured logging

`src/commands/datasources/pull/` is the canonical migrated command.
