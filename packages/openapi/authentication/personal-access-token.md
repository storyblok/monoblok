# Personal Access Token Authentication

A **Personal Access Token** is obtained from the Storyblok UI and grants access to all spaces associated with your account, including the Management API.

## Key Characteristics

- **Not tied to a single space** - allows actions based on your permissions in all accessible spaces
- **Used without "Bearer" keyword** in the Authorization header
- **Generated from Storyblok Account settings**
- **No expiration** - valid until revoked

## How to Generate

1. Log in to your [Storyblok Account](https://app.storyblok.com/#!/me/account)
2. Navigate to **Account Settings** → **Personal Access Tokens**
3. Click **Generate New Token**
4. Copy the generated token immediately (it won't be shown again)

## Usage

### cURL Example
```bash
curl -H "Authorization: YOUR_PERSONAL_ACCESS_TOKEN" \
  https://mapi.storyblok.com/v1/spaces/123/stories
```

## Security Considerations

⚠️ **Important Security Notes:**

- Personal access tokens grant **broad access** to your account
- **Never expose** in frontend code or commit to version control
- **Always store securely** using environment variables
- **Revoke immediately** if exposed and generate a new one
- **Rotate regularly** for enhanced security

## Permissions

Personal access tokens inherit your account permissions across all spaces you have access to. This includes:

- **Read/Write Content** - Stories, components, assets
- **Space Management** - Space settings, roles, collaborators
- **Asset Management** - Upload, organize, delete assets
- **Datasource Management** - Create and manage datasources
- **Tag Management** - Internal and external tags

## Token Management

### Viewing Active Tokens
1. Go to [Account Settings](https://app.storyblok.com/#!/me/account)
2. Navigate to **Personal Access Tokens**
3. View all active tokens with creation dates

### Revoking Tokens
1. Find the token you want to revoke
2. Click the **Revoke** button
3. Confirm the action

⚠️ **Note**: Revoking a token immediately invalidates it. Any applications using this token will need to be updated with a new token.

## Troubleshooting

### Common Issues

**401 Unauthorized**
- Check if the token is correct
- Ensure the token hasn't been revoked
- Verify you're using the token without "Bearer" prefix

**403 Forbidden**
- Check your account permissions
- Verify you have access to the requested space
- Ensure the token hasn't expired

### Getting Help

- [Official Authentication Guide](https://www.storyblok.com/docs/api/management/getting-started/authentication)
- [Account Settings](https://app.storyblok.com/#!/me/account)
- [Storyblok Support](https://www.storyblok.com/support) 
