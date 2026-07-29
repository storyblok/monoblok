# OAuth Commands

Provision the OAuth client credentials the CLI uses to log in with the Authorization Code Grant (with PKCE). After setup, run `storyblok login --oauth` to authorize in the browser.

## Usage

```bash
# Provision a client as an org manager (find-or-create the "Storyblok CLI" app).
storyblok oauth setup --token YOUR_PERSONAL_ACCESS_TOKEN

# Store an existing client id and secret.
storyblok oauth setup --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET

# Log in with OAuth.
storyblok login --oauth
```

Alternatively, set `STORYBLOK_OAUTH_CLIENT_ID` and `STORYBLOK_OAUTH_CLIENT_SECRET` to skip storage entirely. The `--token` value is used once and never stored.

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
