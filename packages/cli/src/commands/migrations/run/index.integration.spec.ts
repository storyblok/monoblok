// Import the main components module first to ensure proper initialization
import '../index';
import { expect, it, vi } from '../../../../../test-utils/src/vitest/test-utils';
import { migrationsCommand } from '../command';
import { konsola } from '../../../utils';
import { canNotUpdateStory, hasStory } from '../../../../../test-utils/src/preconditions/stories-mapi';
import { makeBlok, makeStory } from '../../../../../test-utils/src/preconditions/stories';

process.env.STORYBLOK_LOGIN = 'foo';
process.env.STORYBLOK_TOKEN = 'Bearer foo.bar.baz';
process.env.STORYBLOK_REGION = 'eu';
process.env.STORYBLOK_BASE_URL = 'http://localhost:9000';

it('should handle dry run mode correctly', async ({ prepare, stubServer }) => {
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

  // Run the command with dry run
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
