// TODO package
import { it, expect } from '../../../../../test-utils/src/playwright/test-utils';
import { hasStory } from '../../../../../test-utils/src/preconditions/stories-capi';
import { makeStory, makeBlok } from "../../../../../test-utils/src/preconditions/stories";

it('1 should render the emoji randomizer', async ({ page, startApp }) => {
  await startApp('pnpm start', [hasStory({
    story: makeStory({
      slug: 'react',
      content: makeBlok({
        component: "page",
        body: [
          makeBlok({
            label: "Randomize Emoji",
            component: "emoji-randomizer",
          })
        ]
      })
    })
  })]);
  await page.goto('/');
  await expect(page.getByRole('button', { name: "Randomize Emoji" })).toBeVisible();
});
