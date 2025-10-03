import { faker } from "@faker-js/faker";
import merge from "lodash.merge";
import type {
  Blok,
  Story,
} from "@storyblok/management-api-client/resources/stories";

export const makeBlok = (blok?: Partial<Blok>): Blok =>
  merge(
    {
      _uid: faker.string.uuid(),
      component: faker.helpers.slugify(
        `${faker.word.verb()} ${faker.word.noun()}`
      ),
    } satisfies Blok,
    blok
  );

export const makeStory = (story: Partial<Story> = {}): Story =>
  merge(
    {
      id: faker.number.int({ max: 2147483647 }),
      uuid: faker.string.uuid(),
      name: faker.word.noun(),
      created_at: "2025-09-10T16:10:40Z",
      deleted_at: "2025-09-10T16:10:40Z",
      updated_at: "2025-09-10T16:10:40Z",
      published_at: "2025-09-10T16:10:40Z",
      first_published_at: "2025-09-10T16:10:40Z",
      content: makeBlok(),
      published: true,
      slug: faker.helpers.slugify(`${faker.word.verb()} ${faker.word.noun()}`),
      path: `${faker.helpers.slugify(
        `${faker.word.verb()} ${faker.word.noun()}`
      )}/${faker.helpers.slugify(`${faker.word.verb()} ${faker.word.noun()}`)}`,
      full_slug: `${faker.helpers.slugify(
        `${faker.word.verb()} ${faker.word.noun()}`
      )}/${faker.helpers.slugify(`${faker.word.verb()} ${faker.word.noun()}`)}`,
    } satisfies Story,
    story
  );
