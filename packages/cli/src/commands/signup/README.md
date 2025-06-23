# Signup Command

The signup command opens the Storyblok signup page in your browser, making it easy to create a new account.

## Usage

```bash
storyblok signup
```

## How it works

1. **Browser Opening**: Opens the Storyblok signup page ([https://app.storyblok.com/#/signup](https://app.storyblok.com/#/signup)) in your default browser with UTM tracking parameters
2. **User Completes Signup**: Complete the signup process in the browser
3. **Next Steps**: After signup, run `storyblok login` to authenticate with the CLI

## Example

```bash
storyblok signup
# Complete signup in browser
storyblok login
```

## UTM Parameters

The signup URL includes the following UTM parameters for tracking:
- `utm_source=storyblok-cli`
- `utm_medium=cli`
- `utm_campaign=signup`

## Error Handling

- Shows a warning if the user is already logged in
- Handles browser opening failures gracefully across different operating systems (macOS, Windows, Linux)
