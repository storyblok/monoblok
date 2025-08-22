# OAuth Access Token Authentication

An **OAuth Access Token** is obtained via the OAuth2 authentication flow and is tied to a single space.

## Key Characteristics

- **Time-to-live (TTL)** - tokens expire after a set period
- **Single space access** - tied to specific space permissions
- **Used with "Bearer" keyword** in the Authorization header
- **Scoped permissions** - granted during OAuth process
- **Secure for third-party integrations**

## Available Scopes

The following permissions (scopes) can be granted during the OAuth process:

| Scope               | Description                         | Access Level |
| ------------------- | ----------------------------------- | ------------ |
| `read_content`      | Read access to stories and content  | Read-only    |
| `write_content`     | Write access to stories and content | Read/Write   |
| `read_assets`       | Read access to assets               | Read-only    |
| `write_assets`      | Write access to assets              | Read/Write   |
| `read_spaces`       | Read access to space settings       | Read-only    |
| `write_spaces`      | Write access to space settings      | Read/Write   |
| `read_datasources`  | Read access to datasources          | Read-only    |
| `write_datasources` | Write access to datasources         | Read/Write   |

## OAuth2 Authorization Flow

OAuth access tokens are obtained through the standard OAuth2 authorization flow:

### Step 1: Redirect User to Authorization URL
Redirect users to Storyblok's authorization endpoint with your client credentials and requested scopes.

### Step 2: User Grants Permissions
The user is redirected to Storyblok where they:
1. Log in to their account
2. Select the space to authorize
3. Grant the requested permissions (scopes)
4. Are redirected back to your application with an authorization code

### Step 3: Exchange Code for Access Token
Exchange the authorization code for an access token using your client credentials.

### Step 4: Use Access Token in API Requests
Include the access token in the Authorization header for API requests.

## Usage

### cURL Example
```bash
curl -H "Authorization: Bearer YOUR_OAUTH_ACCESS_TOKEN" \
  https://mapi.storyblok.com/v1/spaces/123/stories
```

## Token Management

### Token Response
When you exchange an authorization code for an access token, you'll receive:

```json
{
  "access_token": "your_access_token",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "your_refresh_token",
  "scope": "read_content write_content"
}
```

### Token Expiration
- Access tokens typically expire after 1 hour (3600 seconds)
- Use refresh tokens to obtain new access tokens
- Store refresh tokens securely for long-term access

## Security Considerations

⚠️ **Important Security Notes:**

- **Store tokens securely** - never expose in frontend code
- **Use HTTPS** - always use secure connections
- **Validate state parameter** - prevent CSRF attacks
- **Handle token expiration** - implement refresh logic
- **Scope minimally** - only request necessary permissions
- **Revoke when unused** - clean up unused tokens

## Application Registration

To use OAuth2 authentication, you need to register your application:

1. Go to [Storyblok App Settings](https://app.storyblok.com/#!/me/apps)
2. Click **Create New App**
3. Configure your app details:
   - **App Name**: Your application name
   - **Redirect URI**: Your callback URL
   - **Scopes**: Required permissions
4. Note your `client_id` and `client_secret`

## Troubleshooting

### Common Issues

**400 Bad Request - Invalid Grant**
- Authorization code has expired (codes expire quickly)
- Authorization code has already been used
- Incorrect client credentials

**401 Unauthorized**
- Access token has expired
- Invalid access token
- Incorrect "Bearer" prefix usage

**403 Forbidden**
- Insufficient scope permissions
- Token doesn't have access to requested space
- Space access has been revoked

### Error Responses
```json
{
  "error": "invalid_grant",
  "error_description": "The authorization code has expired"
}
```

## Getting Help

- [OAuth2 Authentication Guide](https://www.storyblok.com/docs/api/management/getting-started/oauth2-authentication)
- [OAuth2 Authorization Flow](https://www.storyblok.com/docs/api/management/getting-started/oauth2-authentication#oauth2-authorization-flow)
- [Available Scopes](https://www.storyblok.com/docs/api/management/getting-started/oauth2-authentication#available-scopes)
- [Storyblok Support](https://www.storyblok.com/support) 
