import { expect, test } from '@playwright/test';
import type { StartedTestContainer } from 'testcontainers';
import 'dotenv/config';
import { getTestSpaceConfig, type TestSpaceConfig } from '../helpers/get-test-space-config';
import { startQwikContainer } from '../helpers/qwik-container';
import { seedScenario } from '../helpers/seed';
import { allBlocksScenario } from '../scenarios/all-blocks-combined';

let container: StartedTestContainer;
let baseUrl: string;
let config: TestSpaceConfig;

test.beforeAll(async () => {
  test.setTimeout(300_000); // 5 min — includes Docker image build on first run
  config = getTestSpaceConfig(test.info().parallelIndex);
  container = await startQwikContainer(config.previewToken);
  baseUrl = `http://${container.getHost()}:${container.getMappedPort(3000)}`;
});

test.afterAll(async () => {
  await container?.stop();
});

test('renders all block types with mixed field content', async ({ page }) => {
  await seedScenario(config, allBlocksScenario);
  await page.goto(baseUrl);

  // Hero section
  await expect(page.getByRole('heading', { level: 1 })).toContainText('All Blocks Combined Headline');

  // Intro section — headline and eyebrow
  await expect(page.getByRole('heading', { level: 2, name: 'Intro Headline' })).toBeVisible();
  await expect(page.getByText('Intro Section')).toBeVisible();

  // Media section — uploaded asset renders with src and caption
  const mediaImg = page.getByRole('img', { name: 'Test media image' });
  await expect(mediaImg).toBeVisible();
  await expect(mediaImg).toHaveAttribute('src', /storyblok\.com/);
  await expect(page.getByText('Test image caption')).toBeVisible();

  // Teaser list — 2 nested teasers
  const articles = page.getByRole('article');
  await expect(articles).toHaveCount(2);
  await expect(articles.nth(0).getByRole('heading', { level: 3 })).toContainText('Combined Teaser One');
  await expect(articles.nth(1).getByRole('heading', { level: 3 })).toContainText('Combined Teaser Two');
});
