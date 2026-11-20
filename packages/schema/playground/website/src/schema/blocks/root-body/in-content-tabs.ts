import { defineBlock, defineField } from "@storyblok/schema";

import { rootBodyFolder } from "../../folders";

export const inContentTabsBlock = defineBlock({
  name: "in_content_tabs",
  is_root: false,
  is_nestable: true,
  folder: rootBodyFolder,
  image: "https://example.com/component-screenshots/in_content_tabs.png",
  tags: ["Whitelist: Root Body", "Whitelist: Blog Entry Body"],
  fields: [
    defineField("tab-be99e55a-dab9-4bee-9c05-42e398792b9c", {
      display_name: "Style",
      keys: ["variant"],
      type: "tab",
    }),
    defineField("tabs", {
      allow: ["in_content_tab"],
      type: "bloks",
    }),
    defineField("variant", {
      default_value: "left",
      options: [
        {
          _uid: "9b598200-f97f-48ba-8ce4-306f549fcc41",
          name: "Tabs Left",
          value: "left",
        },
        {
          _uid: "96d2503c-6a11-4ad9-b3ca-1b89a771a529",
          name: "Tabs Centered",
          value: "centered",
        },
        {
          _uid: "1581670e-5961-4918-996e-5f3325c82f20",
          name: "New Homepage Style",
          value: "new-homepage-style",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
  ],
});
