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
import { chunk } from '../../../utils/array';
import { fetchComponents } from '../../components/pull/actions';
import { applyClientFilters, buildClientFilters, buildQueryParams } from './actions';
import { buildRelationFieldMap, detectIssues, extractReferences } from './references';
import { matchesPublishStatus } from './filters';
import type { TargetMeta } from './references';
import type { FindOptions } from './types';
import type { Story } from '../constants';

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
  .option('--container-block <name>', 'filter by container block type (server-side)')
  .option('--contains-block <name>', 'block presence at any depth (server-side, comma-separated)')
  .option('-q, --query <query>', 'filter by root-level content attributes (server-side, MAPI filter_query)')
  .option('--where <jsonpath>', 'client-side JSONPath (RFC 9535) filter (repeatable)', collectValues, [])
  .addOption(
    new Option('--publish-status <status>', 'filter by publish status')
      .choices(['published', 'changed', 'draft']),
  )
  .option('--references-to <uuid>', 'find stories referencing this UUID (server-side)')
  .option('--check-references', 'detect broken references and stale cached_url (client-side)')
;

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

  const params = buildQueryParams(text, options);
  const clientFilters = buildClientFilters(options);
  const hasClientFilters = clientFilters.length > 0;

  try {
    if (options.checkReferences) {
      await runCheckReferences(space, params, options, ui, logger);
    }
    else {
      await runStreamingFind(space, params, clientFilters, hasClientFilters, ui, logger);
    }
  }
  catch (maybeError) {
    handleError(toError(maybeError), verbose);
  }
});

async function runStreamingFind(
  space: string,
  params: ReturnType<typeof buildQueryParams>,
  clientFilters: ReturnType<typeof buildClientFilters>,
  hasClientFilters: boolean,
  ui: ReturnType<typeof getUI>,
  logger: ReturnType<typeof getLogger>,
): Promise<void> {
  const spinner = ui.createSpinner('Fetching stories...');
  let totalFetched = 0;
  let totalMatched = 0;
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await fetchStories(space, { ...params, per_page: 100, page });
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

async function runCheckReferences(
  space: string,
  params: ReturnType<typeof buildQueryParams>,
  options: FindOptions,
  ui: ReturnType<typeof getUI>,
  logger: ReturnType<typeof getLogger>,
): Promise<void> {
  // Phase 1: Fetch component schema
  const schemaSpinner = ui.createSpinner('Fetching component schema...');
  const components = await fetchComponents(space);
  if (!components) {
    schemaSpinner.failed('Failed to fetch components');
    return;
  }
  const relationFieldMap = buildRelationFieldMap(components);
  schemaSpinner.succeed(`Loaded ${components.length} components (${relationFieldMap.size} with relation fields)`);

  // Phase 2: Fetch and buffer all stories
  const fetchSpinner = ui.createSpinner('Fetching stories...');
  const bufferedStories: Story[] = [];
  const uuidToMeta = new Map<string, TargetMeta>();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await fetchStories(space, { ...params, per_page: 100, page });
    if (!result) {
      fetchSpinner.failed('Failed to fetch stories');
      return;
    }

    const { headers, stories } = result;
    const total = Number(headers.get('Total'));
    const perPage = Number(headers.get('Per-Page')) || 100;
    totalPages = Math.ceil(total / perPage);

    if (page === 1) {
      fetchSpinner.succeed(`Found ${total} stories server-side`);
      if (total === 0) {
        break;
      }
    }

    for (const story of stories) {
      // Always index for cross-referencing
      if (story.uuid) {
        uuidToMeta.set(story.uuid, {
          full_slug: story.full_slug ?? '',
          is_published: story.is_published ?? null,
        });
      }
      // Apply publish-status filter during buffering (reduces check set)
      if (options.publishStatus && options.publishStatus !== 'draft') {
        if (!matchesPublishStatus(story, options.publishStatus)) {
          continue;
        }
      }
      bufferedStories.push(story);
    }

    page++;
  }

  if (bufferedStories.length === 0) {
    ui.br();
    ui.info('Results: 0 stories to check');
    return;
  }

  // Phase 3: Extract references and validate missing targets
  const checkSpinner = ui.createSpinner('Checking references...');

  const missingUuids = new Set<string>();
  const storyRefs = new Map<string, ReturnType<typeof extractReferences>>();

  for (const story of bufferedStories) {
    const refs = extractReferences(story, relationFieldMap);
    storyRefs.set(story.uuid, refs);
    for (const ref of refs) {
      if (!uuidToMeta.has(ref.targetUuid)) {
        missingUuids.add(ref.targetUuid);
      }
    }
  }

  // Batch-fetch missing targets
  if (missingUuids.size > 0) {
    const batches = chunk(missingUuids, 100);
    for (const batch of batches) {
      const result = await fetchStories(space, { by_uuids: batch.join(','), per_page: 100 });
      if (result) {
        for (const story of result.stories) {
          uuidToMeta.set(story.uuid, {
            full_slug: story.full_slug ?? '',
            is_published: story.is_published ?? null,
          });
        }
      }
    }
  }

  // Phase 4: Detect issues and output
  const whereFilters = options.where?.length
    ? buildClientFilters({ where: options.where } as FindOptions)
    : [];

  let totalMatched = 0;

  for (const story of bufferedStories) {
    const refs = storyRefs.get(story.uuid) ?? [];
    const issues = detectIssues(refs, uuidToMeta);
    if (issues.length === 0) {
      continue;
    }

    const enriched = { ...story, _ref_issues: issues };

    if (whereFilters.length === 0 || applyClientFilters(enriched as Story, whereFilters)) {
      totalMatched++;
      process.stdout.write(`${JSON.stringify(enriched)}\n`);
    }
  }

  checkSpinner.succeed('Reference check complete');
  ui.br();
  ui.info(`Results: ${totalMatched} stories with reference issues (${bufferedStories.length} checked, ${missingUuids.size} external targets validated)`);
  logger.info('Reference check finished', { checked: bufferedStories.length, issues: totalMatched, externalTargets: missingUuids.size });
}
