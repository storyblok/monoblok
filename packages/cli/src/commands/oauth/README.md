# OAuth Commands

The CLI supports logging in with OAuth (Authorization Code Grant with PKCE). OAuth access tokens can be space-scoped: at the consent screen you select which space(s) the CLI may access, and the CLI is then limited to those spaces. If no specific space is selected, the grant covers all your spaces.

## Provision a client (`storyblok oauth setup`)

OAuth needs a client id and secret. There are three ways to supply them.

- Org managers: `storyblok oauth setup --token <PAT>` finds or creates a "Storyblok CLI" OAuth app in your organization and stores its credentials. The PAT is used once and never stored. Requires an org manager role and an organization enabled for OAuth grants.
- Existing client: `storyblok oauth setup --client-id <id> --client-secret <secret>` stores credentials you already have.
- Environment variables: set `STORYBLOK_OAUTH_CLIENT_ID` and `STORYBLOK_OAUTH_CLIENT_SECRET` to skip storage entirely.

Use `--region <region>` to target a region other than `eu`.

## Log in (`storyblok login --oauth`)

Run `storyblok login --oauth` (or pick "With OAuth" in `storyblok login`). The CLI opens your browser for consent, receives the callback on `http://localhost:4900/oauth/callback`, and stores the tokens. Access tokens are refreshed automatically before they expire.

## Scope and limitations

- Grants can be space-scoped. If you selected specific spaces at consent, commands that target a space outside your grant fail with a clear message; re-run `storyblok login` and select that space.
- Access tokens last 15 minutes and the refresh token rotates on every refresh; the CLI persists the rotated token automatically.
- OAuth login is interactive (it opens a browser). For non-interactive CI, keep using `storyblok login --token <PAT>`.
