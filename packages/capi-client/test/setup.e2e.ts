import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(import.meta.dirname, '../../../.env.qa-engineer-manual') });

if (!process.env.STORYBLOK_TOKEN || !process.env.STORYBLOK_SPACE_ID) {
  throw new Error(
    'E2E tests require STORYBLOK_TOKEN and STORYBLOK_SPACE_ID.\n'
    + 'Create a .env.qa-engineer-manual file at the repo root with these variables.',
  );
}
