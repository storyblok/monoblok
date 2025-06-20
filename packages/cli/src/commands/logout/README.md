# Logout Command

The `logout` command allows you to securely log out from your Storyblok account and remove stored credentials.

## Basic Usage

```bash
storyblok logout
```

This command will:
- Remove your stored credentials from `~/.storyblok/credentials.json`
- Clear your current session
- Show a success message when completed

## Notes

- The command will show a warning if you're already logged out
- All stored credentials are removed from your system
- You'll need to log in again to use other Storyblok CLI commands
- The command is safe to run multiple times

## Examples

1. Basic logout:
```bash
storyblok logout
```
