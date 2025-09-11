import { faker } from "@faker-js/faker";
import merge from "lodash.merge";
import type { ExampleStore } from "../utils/stub-server.ts";

export const makeStory = (story = {}) =>
  merge(
    {
      id: 446,
      name: faker.word.noun(),
      parent_id: 723,
      group_id: "58557242-daba-4f17-a95f-ef246a053cae",
      alternates: [
        {
          id: 116,
          name: "IEDKH",
          slug: "BPVLH",
          published: false,
          full_slug: "LSJAQ",
          is_folder: true,
        },
        {
          id: 594,
          name: "FYCLD",
          slug: "VOXDN",
          published: true,
          full_slug: "MPAIV",
          is_folder: false,
        },
      ],
      created_at: "2025-09-10T16:10:40Z",
      deleted_at: "2025-09-10T16:10:40Z",
      sort_by_date: "2025-09-10",
      tag_list: ["KKIAH", "AANGO"],
      updated_at: "2025-09-10T16:10:40Z",
      published_at: "2025-09-10T16:10:40Z",
      uuid: "9db3112e-1a5a-4745-a8a3-63db30d81dae",
      is_folder: true,
      content: {
        _uid: "ab5d51e4-13a1-4238-9454-6d0f38903b0a",
        component: "NDTXB",
        _editable: "IREGQ",
      },
      published: true,
      slug: "IVCXD",
      path: "IBMXF",
      full_slug: "SCDGX",
      default_root: "QSJAO",
      disable_fe_editor: true,
      parent: {},
      is_startpage: true,
      unpublished_changes: false,
      meta_data: {},
      imported_at: "2025-09-10T16:10:40Z",
      preview_token: {
        token: "PHPTI",
        timestamp: "BSMKF",
      },
      pinned: true,
      breadcrumbs: [
        {
          id: 559,
          name: "XUYLF",
          parent_id: 826,
          disable_fe_editor: false,
          path: "SJESJ",
          slug: "OWDHD",
          translated_slugs: [
            {
              story_id: 878,
              lang: "ROEUP",
              slug: "AGVGN",
              name: "EEDPM",
              published: true,
            },
          ],
        },
        {
          id: 531,
          name: "PXPQS",
          parent_id: 599,
          disable_fe_editor: false,
          path: "SITFH",
          slug: "OWHXG",
          translated_slugs: [
            {
              story_id: 289,
              lang: "ILTJQ",
              slug: "AMMPK",
              name: "AAVTS",
              published: false,
            },
          ],
        },
      ],
      first_published_at: "2025-09-10T16:10:40Z",
      last_author: {
        id: 922,
        userid: "LSWYV",
        friendly_name: "WPXJC",
      },
      last_author_id: 461,
      translated_slugs: [
        {
          story_id: 359,
          lang: "RCUKY",
          slug: "GREXL",
          name: "OAPMX",
          published: true,
        },
        {
          story_id: 484,
          lang: "LBPJC",
          slug: "VRKEF",
          name: "ENVHD",
          published: false,
        },
      ],
      translated_slugs_attributes: [
        {
          id: 818,
          lang: "DXEMG",
          slug: "JUSPT",
          name: "KCALI",
          published: false,
        },
      ],
      localized_paths: [
        {
          path: "HDBQO",
          name: "QXFXA",
          lang: "MQHEF",
          published: true,
        },
      ],
      position: 959,
      release_id: 748,
      scheduled_dates: "2025-09-10T16:10:40Z",
      favourite_for_user_ids: [616],
    },
    story
  );
