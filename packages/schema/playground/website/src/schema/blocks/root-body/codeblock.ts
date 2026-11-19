import { defineBlock, defineField } from "@storyblok/schema";

import { rootBodyFolder } from "../../folders";

export const codeblockBlock = defineBlock({
  name: "codeblock",
  is_root: false,
  is_nestable: true,
  folder: rootBodyFolder,
  image: "https://example.com/component-screenshots/codeblock.png",
  tags: ["Whitelist: Root Body", "Whitelist: Blog Entry Body"],
  fields: [
    defineField("code", {
      required: true,
      type: "textarea",
    }),
    defineField("enable_diff", {
      description: 'Use "-" for deletions and "+" for additions at the start of the lines',
      type: "boolean",
    }),
    defineField("title", {
      type: "text",
    }),
    defineField("caption", {
      customize_toolbar: true,
      toolbar: ["bold", "italic", "link"],
      type: "richtext",
    }),
    defineField("language", {
      description: "",
      exclude_empty_option: true,
      options: [
        {
          _uid: "f7634d50-0683-404d-9acb-69026e7654a0",
          name: "Angular HTML",
          value: "angular-html",
        },
        {
          _uid: "efae6bd0-634a-4656-818c-6f2b52e3ff4f",
          name: "Angular TypeScript",
          value: "angular-ts",
        },
        {
          _uid: "3379519a-97c0-40b2-b88f-16ec6d033d4b",
          name: "Astro",
          value: "astro",
        },
        {
          _uid: "111fa3cc-2b44-4270-8d28-889e1f1321b4",
          name: "Bash",
          value: "bash",
        },
        {
          _uid: "e929d945-c059-4c86-8fd6-a90e2d4f5fb2",
          name: "CSS",
          value: "css",
        },
        {
          _uid: "97c5963b-a9c2-4de9-84d5-8e2ff60ed557",
          name: "C#",
          value: "csharp",
        },
        {
          _uid: "e1d0187b-1b93-4875-9b11-1347eac60ce1",
          name: "Diff",
          value: "diff",
        },
        {
          _uid: "6cdd5834-3a24-47f8-8349-fcfa151ac0eb",
          name: "Go",
          value: "go",
        },
        {
          _uid: "0db9badb-8f3b-46e6-b3e4-325ea81ac4f5",
          name: "GraphQL",
          value: "graphql",
        },
        {
          _uid: "4308edb7-bb2a-441a-b8d2-6f86ffad2272",
          name: "HTML",
          value: "html",
        },
        {
          _uid: "baada5fc-b4de-4926-8e66-f3baabbb15a6",
          name: "HTTP",
          value: "http",
        },
        {
          _uid: "2350485c-3f6a-4c03-894e-5dd7da8e3417",
          name: "Java",
          value: "java",
        },
        {
          _uid: "a4fe17cc-ad78-4301-809b-6c4548189ce8",
          name: "JavaScript",
          value: "javascript",
        },
        {
          _uid: "96331298-2c88-45c6-aa7e-dca25f897558",
          name: "JSON",
          value: "json",
        },
        {
          _uid: "a50aa485-1452-41ff-86b3-cbdbf7290046",
          name: "Markdown",
          value: "markdown",
        },
        {
          _uid: "4d5111e2-04e0-48aa-b5ae-ea8bd84709d7",
          name: "PHP",
          value: "php",
        },
        {
          _uid: "2cdd6b90-2041-48bb-b420-b90d1f437935",
          name: "Plaintext",
          value: "text",
        },
        {
          _uid: "e3210870-4e46-459e-b4d3-8ad9309a44ac",
          name: ".properties (INI)",
          value: "properties",
        },
        {
          _uid: "ce692048-624e-4522-8ce4-6b5a6135c4a6",
          name: "Ruby",
          value: "ruby",
        },
        {
          _uid: "2695ed74-23fa-4262-a061-f69474503612",
          name: "SCSS",
          value: "scss",
        },
        {
          _uid: "a30c46fa-daf1-4bad-89a5-c243cc425242",
          name: "SQL",
          value: "sql",
        },
        {
          _uid: "303ac933-942a-4409-b7b0-a79337e85dc8",
          name: "Swift",
          value: "swift",
        },
        {
          _uid: "33c9eda6-09e5-4c92-95b7-91eeec3e40fb",
          name: "TypeScript",
          value: "typescript",
        },
        {
          _uid: "6a5fef2b-0ad5-432e-ac5b-fcce98c9fbf2",
          name: "YAML",
          value: "yaml",
        },
        {
          _uid: "dbf1e288-54c8-4ece-8542-e1b30e945e57",
          name: "Vue",
          value: "vue",
        },
        {
          _uid: "91197407-ec6e-4519-8437-c53021f14db7",
          name: "Vue HTML",
          value: "vue-html",
        },
        {
          _uid: "fb2b74ec-1388-40be-a5a7-a00b61f61790",
          name: "XML",
          value: "xml",
        },
      ],
      required: true,
      type: "option",
      use_uuid: true,
    }),
  ],
});
