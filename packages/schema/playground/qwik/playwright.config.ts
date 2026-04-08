import { defineConfig } from '@playwright/test';
import os from 'node:os';
import 'dotenv/config';

const spaceIds = process.env.TEST_STORYBLOK_SPACE_ID?.split(',').filter(Boolean) ?? [];
const maxWorkers = Math.max(1, Math.floor(os.cpus().length / 2));
const workers = Math.min(Math.max(spaceIds.length, 1), maxWorkers);

export default defineConfig({
  testDir: './test/specs',
  testMatch: '*.spec.e2e.ts',
  workers,
  timeout: 120_000,
  retries: 0,
  reporter: 'list',
  use: { browserName: 'chromium' },
});
