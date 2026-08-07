import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { SchemaBlockLike, SchemaLike } from './shapes';
import { isRecord } from './shapes';
import { validateStory } from './validate-story';

/**
 * Wraps {@link validateStory} as a [Standard Schema](https://standardschema.dev)
 * validator, so a story for `rootBlock` composes with any Standard Schema
 * tooling (e.g. as a tRPC input or a form resolver). The root content
 * `component` is asserted to match `rootBlock.name`.
 *
 * @example
 * const validator = createStoryValidator(page, schema);
 * const result = validator['~standard'].validate(story);
 */
export function createStoryValidator(
  rootBlock: SchemaBlockLike,
  schema: SchemaLike,
): StandardSchemaV1<unknown, unknown> {
  return {
    '~standard': {
      version: 1,
      vendor: 'storyblok-schema',
      validate(value) {
        const result = validateStory(value, schema);
        const issues = result.issues
          .filter(issue => issue.severity === 'error')
          .map(issue => ({ message: issue.message, path: issue.path }));

        const content = isRecord(value) ? value.content : undefined;
        const component = isRecord(content) ? content.component : undefined;
        if (component !== undefined && component !== rootBlock.name) {
          issues.push({
            message: `Expected root component "${rootBlock.name}", received "${String(component)}".`,
            path: ['content', 'component'],
          });
        }

        return issues.length > 0 ? { issues } : { value };
      },
    },
  };
}
