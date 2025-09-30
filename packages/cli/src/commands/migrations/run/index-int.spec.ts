// Import the main components module first to ensure proper initialization
import '../index';
import { expect, it, vi } from '../../../../../test-utils/src/vitest/test-utils';
import { migrationsCommand } from '../command';
import { konsola } from '../../../utils';
import { canNotUpdateStory, hasStory } from '../../../../../test-utils/src/preconditions/stories-mapi';
import { makeBlok, makeStory } from '../../../../../test-utils/src/preconditions/stories';
import { mapiClient } from '../../../api';

it('should handle dry run mode correctly', async ({ prepare, stubServer }) => {
  mapiClient({ baseUrl: stubServer.baseURL, token: { accessToken: 'Bearer super-valid-token' } });
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
  await migrationsCommand.parseAsync(['node', 'test', 'run', '--space', '12345', '--dry-run', '--path', './src/commands/migrations/run/__test__']);

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
