# User Command

This command allows you to view information about your currently logged-in Storyblok account.

## Basic Usage

```bash
storyblok user
```

This command will display:
- Your friendly name
- Your email address
- The region you're logged into

## What the Command Does

1. Checks if you're logged in
2. Fetches your user information from Storyblok
3. Displays your account details in a formatted way

## Examples

1. View your user information:
```bash
storyblok user
```

Output example:
```
Hi John Doe, you are currently logged in with john@example.com on eu region
```

## Notes

- The command uses your stored authentication token
