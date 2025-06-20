# Login Command

The `login` command allows you to authenticate with your Storyblok account. It supports multiple login methods and regions.

## Basic Usage

```bash
storyblok login
```

This will start an interactive login process where you can choose between:
- Email and password login
- Token-based login (SSO)

### Get your personal access token

Go to https://app.storyblok.com/#/me/account?tab=token and click on **Generate new token**.

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --token <token>` | Login directly with a token (useful for CI environments) | - |
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

## Notes

- Credentials are stored securely in `~/.storyblok/credentials.json`
- The region setting will be used for all subsequent CLI commands
- If you're already logged in, you'll need to logout first to switch accounts
- For CI environments, it's recommended to use the `--token` option
- The CLI supports two-factor authentication (2FA) when using email login

## Available Regions

- `eu` - Europe
- `us` - United States
- `cn` - China
- `au` - Australia
