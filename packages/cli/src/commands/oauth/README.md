# OAuth Commands

The `oauth` commands provision and store the OAuth client credentials the CLI uses to log in with the Authorization Code Grant (with PKCE). Once credentials are in place, `storyblok login --oauth` opens your browser for consent and stores the resulting tokens. OAuth access tokens can be space-scoped: at the consent screen you select which space(s) the CLI may access, and the CLI is then limited to those spaces. If no specific space is selected, the grant covers all your spaces.

## Basic Usage

**Provision a client as an org manager (find-or-create the "Storyblok CLI" OAuth app):**

```bash
storyblok oauth setup --token YOUR_PERSONAL_ACCESS_TOKEN
```

**Store an existing client id and secret:**

```bash
storyblok oauth setup --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET
```

**Provision a client for a specific region:**

```bash
storyblok oauth setup --token YOUR_PERSONAL_ACCESS_TOKEN --region us
```

**Skip storage entirely with environment variables:**

```bash
export STORYBLOK_OAUTH_CLIENT_ID=YOUR_CLIENT_ID
export STORYBLOK_OAUTH_CLIENT_SECRET=YOUR_CLIENT_SECRET
```

**Log in with OAuth:**

```bash
storyblok login --oauth
```

> [!NOTE]
> The `--token` used by `oauth setup` is a Personal Access Token. It is used once to find or create the OAuth app and is never stored. It requires an org manager role and an organization enabled for OAuth grants.

> [!TIP]
> OAuth login is interactive (it opens a browser and receives the callback on `http://localhost:4900/oauth/callback`). For non-interactive CI, keep using `storyblok login --token YOUR_PERSONAL_ACCESS_TOKEN`.

## Options

### `storyblok oauth setup`

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --token <token>` | Personal Access Token used once to find-or-create the "Storyblok CLI" OAuth app (never stored) | - |
| `--client-id <id>` | Provide an existing OAuth client id directly | - |
| `--client-secret <secret>` | Provide an existing OAuth client secret directly | - |
| `-r, --region <region>` | Region to store the client credentials for | `eu` |

### `storyblok login --oauth`

| Option | Description | Default |
|--------|-------------|---------|
| `--oauth` | Login with OAuth (opens your browser for consent) | `false` |

## Scope and limitations

- Grants can be space-scoped. If you selected specific spaces at consent, commands that target a space outside your grant fail with a clear message; re-run `storyblok login` and select that space.
- Access tokens last 15 minutes and the refresh token rotates on every refresh; the CLI persists the rotated token automatically and refreshes access tokens before they expire.
