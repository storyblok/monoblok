import { Option } from 'commander';
import { colorPalette, commands } from '../../../constants';
import { session } from '../../../session';
import { storiesCommand } from '../command';
import { getUI } from '../../../lib/ui';
import { getLogger } from '../../../lib/logger/logger';
import { fetchStories } from '../actions';
import { requireAuthentication } from '../../../utils/auth';
import { handleError, toError } from '../../../utils/error/error';
import { CommandError } from '../../../utils/error/command-error';
import { applyClientFilters, buildClientFilters, buildQueryParams } from './actions';
import type { FindOptions } from './types';

function collectValues(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

const findCmd = storiesCommand
  .command('find [text]')
  .description('Find stories matching filters. Outputs JSONL to stdout (one story JSON per line).')
  .option('-s, --space <space>', 'space ID')
  .addOption(
    new Option('--search-mode <mode>', 'search mode')
      .choices(['fulltext', 'semantic'])
      .default('fulltext'),
  )
  .addOption(
    new Option('--entry-type <type>', 'filter by entry type')
      .choices(['all', 'story', 'folder'])
      .default('all'),
  )
  .option('--starts-with <path>', 'scope to story subtree')
  .option('--root-block <name>', 'filter by root block type (server-side)')
  .option('--contains-block <name>', 'block presence at any depth (server-side, comma-separated)')
  .option('-q, --query <query>', 'filter by root-level content attributes (server-side, MAPI filter_query)')
  .option('--where <jsonpath>', 'client-side JSONPath (RFC 9535) filter (repeatable)', collectValues, [])
  .addOption(
    new Option('--publish-status <status>', 'filter by publish status')
      .choices(['published', 'changed', 'draft']),
  )
  .addOption(
    new Option('--translation-status <status>', 'filter by translation status')
      .choices(['missing', 'stale', 'unpublished', 'complete']),
  )
  .option('--language <code>', 'scope by specific language(s) (comma-separated)');

findCmd.action(async (text: string | undefined, options: FindOptions, command) => {
  const ui = getUI();
  const logger = getLogger();

  ui.title(`${commands.STORIES}`, colorPalette.STORIES, 'Finding stories...');
  logger.info('Finding stories started', { text, ...options });

  const { space, verbose } = command.optsWithGlobals();
  const { state } = session();

  if (!requireAuthentication(state, verbose)) {
    return;
  }
  if (!space) {
    handleError(new CommandError('Please provide the space as argument --space YOUR_SPACE_ID.'), verbose);
    return;
  }

  // Build server-side query params
  const params = buildQueryParams(text, options);

  // Determine if we need translation data
  const needsTranslationData = Boolean(options.translationStatus);
  if (needsTranslationData) {
    params.with_translated_stories = true;
  }

  // Determine client-side filters
  const clientFilters = buildClientFilters(options);
  const hasClientFilters = clientFilters.length > 0;

  try {
    const spinner = ui.createSpinner('Fetching stories...');
    let totalFetched = 0;
    let totalMatched = 0;
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const result = await fetchStories(space, {
        ...params,
        per_page: 100,
        page,
      });

      if (!result) {
        spinner.failed('Failed to fetch stories');
        return;
      }

      const { headers, stories } = result;
      const total = Number(headers.get('Total'));
      const perPage = Number(headers.get('Per-Page')) || 100;
      totalPages = Math.ceil(total / perPage);
      totalFetched += stories.length;

      if (page === 1) {
        spinner.succeed(`Found ${total} stories server-side${hasClientFilters ? ', applying client filters...' : ''}`);
        if (total === 0) {
          break;
        }
      }

      for (const story of stories) {
        if (applyClientFilters(story, clientFilters)) {
          totalMatched++;
          // Write JSONL to stdout — one story per line
          process.stdout.write(`${JSON.stringify(story)}\n`);
        }
      }

      page++;
    }

    ui.br();
    if (hasClientFilters) {
      ui.info(`Results: ${totalMatched} stories matched (${totalFetched} fetched, ${totalFetched - totalMatched} filtered out client-side)`);
    }
    else {
      ui.info(`Results: ${totalMatched} stories found`);
    }
    logger.info('Finding stories finished', { totalFetched, totalMatched });
  }
  catch (maybeError) {
    handleError(toError(maybeError), verbose);
  }
});
