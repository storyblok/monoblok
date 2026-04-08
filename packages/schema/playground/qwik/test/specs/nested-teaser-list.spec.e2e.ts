import { expect, test } from '@playwright/test';
import type { StartedTestContainer } from 'testcontainers';
import 'dotenv/config';
import { getTestSpaceConfig, type TestSpaceConfig } from '../helpers/get-test-space-config';
import { startQwikContainer } from '../helpers/qwik-container';
import { seedScenario } from '../helpers/seed';
import { nestedTeaserListScenario } from '../scenarios/nested-teaser-list';

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

test('renders nested teaser list with all child teasers', async ({ page }) => {
  await seedScenario(config, nestedTeaserListScenario);
  await page.goto(baseUrl);

  const articles = page.getByRole('article');
  await expect(articles).toHaveCount(3);

  await expect(articles.nth(0).getByRole('heading', { level: 3 })).toContainText('Teaser One');
  await expect(articles.nth(0).getByText('First teaser description.')).toBeVisible();

  await expect(articles.nth(1).getByRole('heading', { level: 3 })).toContainText('Teaser Two');
  await expect(articles.nth(1).getByRole('link')).toHaveAttribute('href', 'https://www.storyblok.com');

  await expect(articles.nth(2).getByRole('heading', { level: 3 })).toContainText('Teaser Three');
});
