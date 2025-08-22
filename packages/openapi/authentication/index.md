# Authentication Overview

The Storyblok Management API supports two authentication methods to secure your API requests. Choose the method that best fits your use case.

## Authentication Methods

### 🔑 Personal Access Token
**Best for**: Personal scripts, development, and applications where you control the token.

- **Scope**: All spaces associated with your account
- **Usage**: `Authorization: YOUR_TOKEN` (no "Bearer" prefix)
- **Expiration**: Never expires (valid until revoked)
- **Security**: High - grants broad account access

### 🔐 OAuth Access Token
**Best for**: Third-party integrations, user-facing applications, and secure multi-tenant scenarios.

- **Scope**: Single space with specific permissions
- **Usage**: `Authorization: Bearer YOUR_TOKEN` (with "Bearer" prefix)
- **Expiration**: 1 hour (refreshable)
- **Security**: Very high - scoped permissions, time-limited

## Quick Comparison

| Feature              | Personal Access Token | OAuth Access Token |
| -------------------- | --------------------- | ------------------ |
| **Setup Complexity** | Simple                | Moderate           |
| **Scope**            | Account-wide          | Space-specific     |
| **Expiration**       | Never                 | 1 hour             |
| **Refresh Required** | No                    | Yes                |
| **Best For**         | Personal use          | Third-party apps   |
| **Security Level**   | High                  | Very High          |

## Quick Start

### Personal Access Token
```bash
curl -H "Authorization: YOUR_TOKEN" \
  https://mapi.storyblok.com/v1/spaces/123/stories
```

### OAuth Access Token
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://mapi.storyblok.com/v1/spaces/123/stories
```

## Security Best Practices

### General Guidelines
- **Never expose tokens** in frontend code or version control
- **Use environment variables** to store tokens securely
- **Rotate tokens regularly** for enhanced security
- **Use HTTPS** for all API communications
- **Implement proper error handling** for authentication failures

## Server Regions

All authentication methods work across all Storyblok server regions:

- **EU**: `https://mapi.storyblok.com`
- **US**: `https://api-us.storyblok.com`
- **Canada**: `https://api-ca.storyblok.com`
- **Australia**: `https://api-ap.storyblok.com`
- **China**: `https://app.storyblok.cn`

## Troubleshooting

### Common Authentication Issues

**401 Unauthorized**
- Check if the token is correct
- Verify you're using the right prefix (Bearer for OAuth, none for Personal)
- Ensure the token hasn't expired or been revoked

**403 Forbidden**
- Check your permissions for the requested space
- Verify the token has the required scopes (OAuth)
- Ensure you have access to the requested resource

**400 Bad Request**
- Check the Authorization header format
- Verify the token format is correct
- Ensure you're using the right authentication method

## Getting Help

- [Official Authentication Guide](https://www.storyblok.com/docs/api/management/getting-started/authentication)
- [OAuth2 Authentication Guide](https://www.storyblok.com/docs/api/management/getting-started/oauth2-authentication)
- [Storyblok Support](https://www.storyblok.com/support)
- [Account Settings](https://app.storyblok.com/#!/me/account) 
