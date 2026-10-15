- Read the agent docs the framework and its packages ship (an `AGENTS.md` or a `docs/` folder in
  the installed package) before writing code. Find them by searching the installed package.
- Content comes from the Storyblok Content Delivery API with a read-only token:
  https://www.storyblok.com/docs/api/content-delivery/v2
- The project ships pointing at a demo space. Ask the user for their own space and delivery API
  token before changing content or schema.
- The token goes in `.env` as `STORYBLOK_DELIVERY_API_TOKEN`, documented in `.env.example`.
- Management tasks (creating blocks, stories, assets) go through the Storyblok MCP server, which
  authenticates with OAuth. Never ask for or store a management token.
- If the Storyblok agent skills are not available, suggest once that the user install the Storyblok
  agent plugin (https://github.com/storyblok/agent-plugin), and leave the install to them.
