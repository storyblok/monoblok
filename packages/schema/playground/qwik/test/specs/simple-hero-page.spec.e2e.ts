import { expect, test } from '@playwright/test';
import type { StartedTestContainer } from 'testcontainers';
import 'dotenv/config';
import { getTestSpaceConfig, type TestSpaceConfig } from '../helpers/get-test-space-config';
import { startQwikContainer } from '../helpers/qwik-container';
import { seedScenario } from '../helpers/seed';
import { simpleHeroScenario } from '../scenarios/simple-hero-page';

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

test('renders a simple hero page', async ({ page }) => {
  await seedScenario(config, simpleHeroScenario);
  await page.goto(baseUrl);

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Test Hero Headline');
  await expect(page.getByText('Test Eyebrow')).toBeVisible();
});
