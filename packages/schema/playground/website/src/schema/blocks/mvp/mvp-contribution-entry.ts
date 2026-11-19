import { defineBlock, defineField } from "@storyblok/schema";

import { mvpFolder } from "../../folders";

export const mvpContributionEntryBlock = defineBlock({
  name: "mvp_contribution_entry",
  display_name: "MVP Contribution Entry",
  is_root: false,
  is_nestable: true,
  folder: mvpFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  fields: [
    defineField("type", {
      exclude_empty_option: true,
      options: [
        {
          _uid: "9608d521-caef-4f66-a6e4-46a8d455860c",
          name: "Blog",
          value: "blog",
        },
        {
          _uid: "54a88d56-49bb-40a1-a0df-1ce1329f03e7",
          name: "Tutorial",
          value: "tutorial",
        },
        {
          _uid: "8421100e-0a53-4e85-938e-098c52394797",
          name: "Case Study",
          value: "case-study",
        },
        {
          _uid: "4a3ec5c2-1b3b-4de1-a962-d151864a45c3",
          name: "Press Opportunity",
          value: "press-opportunity",
        },
        {
          _uid: "f5305e20-68ce-4c5c-9382-9e1c97581c80",
          name: "Webinar",
          value: "webinar",
        },
        {
          _uid: "a12bc604-a3e7-4b8d-a5d9-1ae600668ec9",
          name: "Conference",
          value: "conference",
        },
        {
          _uid: "3f61fd94-78ef-446c-a085-997507b7d3b0",
          name: "Meet-up",
          value: "meet-up",
        },
        {
          _uid: "b6770946-ea45-448e-9f0e-4ed14706f4c4",
          name: "Event",
          value: "event",
        },
        {
          _uid: "a5ac72d1-1f6e-4639-91d4-991aec69f1fd",
          name: "Open Source",
          value: "open-source",
        },
        {
          _uid: "1208badd-0ba2-4aa7-8ae9-be74add54596",
          name: "Video",
          value: "video",
        },
        {
          _uid: "9bd226f3-87c1-4c86-881b-741d2ae20a05",
          name: "Live Stream",
          value: "live-stream",
        },
        {
          _uid: "1392fb6a-164d-47cd-882e-d85d36629d0e",
          name: "Feature Testing",
          value: "feature-testing",
        },
        {
          _uid: "814d0bcf-4803-4286-a1f4-60f85e62b429",
          name: "Reference Call",
          value: "reference-call",
        },
        {
          _uid: "9ff512c7-f295-4288-8cea-34716a03bb5e",
          name: "Online Review",
          value: "online-review",
        },
      ],
      required: true,
      type: "option",
      use_uuid: true,
    }),
    defineField("title", {
      required: true,
      type: "text",
    }),
    defineField("description", {
      max_length: 300,
      required: true,
      type: "textarea",
    }),
    defineField("image", {
      required: true,
      type: "asset",
    }),
    defineField("link", {
      required: true,
      type: "multilink",
    }),
  ],
});
