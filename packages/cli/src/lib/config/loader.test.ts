import { afterEach, describe, expect, it, vi } from 'vitest'; import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from './loader';

vi.unmock('node:fs');
vi.unmock('node:fs/promises');

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(directory =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('loadConfig', () => {
  it('resolves imports using tsconfig path aliases', async () => {
    await mkdir(tmpdir(), { recursive: true });
    const cwd = await mkdtemp(join(tmpdir(), 'storyblok-config-'));
    temporaryDirectories.push(cwd);

    await mkdir(join(cwd, 'src/services/storyblok'), { recursive: true });

    await writeFile(
      join(cwd, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          baseUrl: '.',
          paths: {
            '@/*': ['./src/*'],
          },
        },
      }),
    );

    await writeFile(
      join(cwd, 'src/services/storyblok/storyblok.env.ts'),
      `
        export const STORYBLOK_SPACE_ID = '12345';
      `,
    );

    await writeFile(
      join(cwd, 'storyblok.config.ts'),
      `
        import { STORYBLOK_SPACE_ID } from '@/services/storyblok/storyblok.env';

        export default {
          space: STORYBLOK_SPACE_ID,
        };
      `,
    );

    const result = await loadConfig({
      name: 'storyblok',
      cwd,
      configFile: 'storyblok.config',
    });

    expect(result.config).toMatchObject({
      space: '12345',
    });
  });
});
