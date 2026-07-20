# Login Command

The `login` command allows you to authenticate with your Storyblok account. It supports multiple login methods and regions.

## Basic Usage

```bash
storyblok login
```

This will start an interactive login process where you can choose between:
- Email and password login
- Token login (Personal Access Token, recommended for CI and required for SSO users)
- OAuth login (opens your browser; requires a client provisioned with `storyblok oauth setup` or set via `STORYBLOK_OAUTH_CLIENT_ID`/`STORYBLOK_OAUTH_CLIENT_SECRET`)

### Get your personal access token

Go to [https://app.storyblok.com/#/me/account?tab=token] and click on **Generate new token**.

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --token <token>` | Login directly with a token (useful for CI environments) | - |
| `--oauth` | Login with OAuth (opens your browser for consent) | - |
| `-r, --region <region>` | Set the region to work with (must match your space's region) | `eu` |

## Examples

1. Login with email and password:
```bash
storyblok login
```

2. Login with a token:
```bash
storyblok login --token PERSONAL_ACCESS_TOKEN
```

3. Login with a token in a specific region:
```bash
storyblok login --token PERSONAL_ACCESS_TOKEN --region us
```

4. Login with OAuth:
```bash
storyblok login --oauth
```

## Notes

- Credentials are stored securely in `~/.storyblok/credentials.json`
- The region setting will be used for all subsequent CLI commands
- If you're already logged in, you'll need to logout first to switch accounts
- For CI environments, it's recommended to use the `--token` option
- The CLI supports two-factor authentication (2FA) when using email login
> If you sign in with SSO (e.g., Google, GitHub, Azure AD), you must use a Personal Access Token.
> Generate one in your account settings: [Generate token](https://app.storyblok.com/#/me/account?tab=token).

## Available Regions

- `eu` - Europe
- `us` - United States
- `cn` - China
- `au` - Australia
