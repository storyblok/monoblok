import { defineBlock, defineField } from "@storyblok/schema";

export const featureItemBlock = defineBlock({
  name: "feature_item",
  display_name: "Roadmap Feature Item",
  is_root: true,
  is_nestable: false,
  preview_field: "title",
  fields: [
    defineField("title", {
      required: true,
      type: "text",
    }),
    defineField("description", {
      customize_toolbar: true,
      restrict_components: false,
      restrict_type: "",
      toolbar: [
        "bold",
        "list",
        "inlinecode",
        "italic",
        "link",
        "olist",
        "strike",
        "subscript",
        "superscript",
      ],
      type: "richtext",
    }),
    defineField("tab-8cc24347-8660-4732-a48f-04f2faaa5cd5", {
      display_name: "Settings",
      keys: ["release_date", "plan", "task_identifier", "content_tags", "noindex"],
      type: "tab",
    }),
    defineField("release_date", {
      options: [
        {
          _uid: "3baf839f-ea1c-430a-9d42-2df1ce41eeb2",
          name: "Considering",
          value: "Considering",
        },
        {
          _uid: "88b194bc-d9bb-46aa-9be4-51bc32dcfd7a",
          name: "Released",
          value: "Released",
        },
        {
          _uid: "1b0682c7-5645-467d-ad7d-be756a5e71a6",
          name: "In Development",
          value: "In Development",
        },
        {
          _uid: "3c02258d-9718-4886-abd2-383a48889dbe",
          name: "Private Beta",
          value: "Private Beta",
        },
        {
          _uid: "ae608c47-0368-4a99-a13d-08303e33be1c",
          name: "In Evaluation",
          value: "In Evaluation",
        },
        {
          _uid: "205250ef-260c-43c7-8574-128ed806a51a",
          name: "2024",
          value: "2024",
        },
        {
          _uid: "459a39e0-6017-4bc0-a8af-667b2b4bc046",
          name: "Q1 2024",
          value: "Q1 2024",
        },
        {
          _uid: "ad39b38b-a142-43f4-b31e-a5bd0bb6a2f1",
          name: "Q2 2024",
          value: "Q2 2024",
        },
        {
          _uid: "3ea1e861-2c17-48bf-ba2b-dc84f7b61c85",
          name: "Q3 2024",
          value: "Q3 2024",
        },
        {
          _uid: "43039db4-167f-452f-adfb-207a9684fb5e",
          name: "Q4 2024",
          value: "Q4 2024",
        },
        {
          _uid: "75aa60c6-8327-40a3-b181-389bc3c728ca",
          name: "Q2 2023",
          value: "Q2 2023",
        },
        {
          _uid: "c48908d4-e7b6-4c09-8e8d-2c876808314f",
          name: "Q3 2023",
          value: "Q3 2023",
        },
        {
          _uid: "7ece320c-1a76-49d2-ad5c-3dee6e5c05d0",
          name: "Q4 2023",
          value: "Q4 2023",
        },
        {
          _uid: "5b687ea0-8dcd-4692-9428-de419e146e56",
          name: "Q1 2023",
          value: "Q1 2023",
        },
        {
          _uid: "fab70db0-ad43-4f07-9e29-0cde581c87a2",
          name: "Q1 2022",
          value: "Q1 2022",
        },
        {
          _uid: "e0002e31-6510-420b-be70-7b0f7008cf71",
          name: "Q2 2022",
          value: "Q2 2022",
        },
        {
          _uid: "d3673e18-6636-4eb7-af2e-0c11e299c8f6",
          name: "Q3 2022",
          value: "Q3 2022",
        },
        {
          _uid: "8cfe6701-38f7-40b1-aaee-350006d13652",
          name: "Q4 2022",
          value: "Q4 2022",
        },
        {
          _uid: "ec40e504-98f3-4175-8725-1640f01a37fd",
          name: "Q1 2021",
          value: "Q1 2021",
        },
        {
          _uid: "460e1430-b520-40cf-9be7-042f4227e8cd",
          name: "Q2 2021",
          value: "Q2 2021",
        },
        {
          _uid: "861b241c-6256-49c4-8bfa-5c5217d04c6d",
          name: "Q3 2021",
          value: "Q3 2021",
        },
        {
          _uid: "58584c13-f55e-4830-89bf-7b24bfad0644",
          name: "Q4 2021",
          value: "Q4 2021",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("plan", {
      options: [
        {
          _uid: "5b936708-dda5-4d02-be98-9e55bd58c8f8",
          name: "Starter Plan",
          value: "Starter Plan",
        },
        {
          _uid: "c476b980-03c2-4df8-b2c6-258b787bdf98",
          name: "Growth Plan",
          value: "Growth Plan",
        },
        {
          _uid: "9de353ba-16c0-4a57-b833-29f0cce21a28",
          name: "Growth Plus Plan",
          value: "Growth Plus Plan",
        },
        {
          _uid: "894ea989-e044-4dc8-b3f6-05efaeb27adb",
          name: "Premium Plan",
          value: "Premium Plan",
        },
        {
          _uid: "4c344087-9cc6-46d2-8b05-9260088956d9",
          name: "Elite Plan",
          value: "Elite Plan",
        },
        {
          _uid: "1cd6ef85-7aa9-46cf-a14d-cbad158ad76e",
          name: "Community Plan",
          value: "Community Plan",
        },
        {
          _uid: "3070a9b9-e21f-4ec2-98d4-746406607dbf",
          name: "Entry Plan",
          value: "Entry Plan",
        },
        {
          _uid: "36942ba1-841e-4c93-b21e-e51332627929",
          name: "Business Plan",
          value: "Business Plan",
        },
        {
          _uid: "0156f241-8470-4ef2-a0a3-98133ea9c9f0",
          name: "Enterprise Plan",
          value: "Enterprise Plan",
        },
        {
          _uid: "318d0b0f-8cdb-476c-a3c5-515e414ab60b",
          name: "Enterprise Plus Plan",
          value: "Enterprise Plus Plan",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("task_identifier", {
      type: "text",
    }),
    defineField("content_tags", {
      datasource: "content-tags",
      source: "internal",
      type: "options",
    }),
    defineField("noindex", {
      default_value: true,
      type: "boolean",
    }),
  ],
});
