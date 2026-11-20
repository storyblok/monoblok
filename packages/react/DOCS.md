<!-- target: src/content/docs/docs/libraries/js/react-sdk/index.mdx#storyblokstory -->
<!-- Insert after the BRIDGE_OPTIONS paragraph. Import `Badge` from "@astrojs/starlight/components" if the page doesn't already. Set the badge to the version this ships in. -->

<Badge text="7.5.2" variant="note" /> _Updated in_

<Aside type="caution">

With `@storyblok/react/rsc`, `StoryblokStory` sends each Visual Editor change to a Server Action.
The Server Action only accepts requests signed by the Visual Editor (the `_storyblok_tk` query
parameters in the preview URL) and verifies the signature with the access token passed to
`storyblokInit`. Initialize the SDK on the server with the space's **preview** access token. With
any other token, live updates are rejected and the page shows the saved content.

</Aside>

<!-- target: src/content/docs/docs/quickstarts/nextjs/index.mdx -->
<!-- Insert after the `.env` code block, before the existing NEXT_PUBLIC_ note. -->

<Aside type="note">

Use the space's preview access token. Live editing with `@storyblok/react/rsc` uses it to verify
that updates come from the Visual Editor.

</Aside>
