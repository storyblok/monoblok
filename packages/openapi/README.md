# Storyblok Management API OpenAPI Specifications

This repository contains comprehensive OpenAPI 3.1.1 specifications for the [Storyblok Management API](https://www.storyblok.com/docs/api/management/getting-started).

## 📚 Documentation Links

### Official Storyblok Documentation
- [Management API Overview](https://www.storyblok.com/docs/api/management/getting-started)
- [Authentication Guide](https://www.storyblok.com/docs/api/management/getting-started/authentication)
- [OAuth2 Authentication](https://www.storyblok.com/docs/api/management/getting-started/oauth2-authentication)

### API Resources
- [Stories API](https://www.storyblok.com/docs/api/management/stories)
- [Components API](https://www.storyblok.com/docs/api/management/components)
- [Assets API](https://www.storyblok.com/docs/api/management/assets)
- [Datasources API](https://www.storyblok.com/docs/api/management/datasources)
- [Spaces API](https://www.storyblok.com/docs/api/management/spaces)
- [Tags API](https://www.storyblok.com/docs/api/management/tags)

## 🏗️ Project Structure

```
openapi/
├── shared/                    # Shared configuration
│   ├── servers.yaml          # Centralized server URLs
│   ├── security.yaml         # Security requirements
│   ├── security-schemes.yaml # Authentication schemes
│   └── auth-examples.yaml    # Authentication examples
├── resources/                # Resource-specific APIs
│   ├── assets/              # Assets API
│   ├── components/          # Components API
│   ├── datasources/         # Datasources API
│   ├── datasource_entries/  # Datasource Entries API
│   ├── internal_tags/       # Internal Tags API
│   ├── presets/            # Presets API
│   ├── spaces/             # Spaces API
│   └── stories/            # Stories API
├── redocly.yaml            # Redocly configuration
└── package.json            # Dependencies and scripts
```

## 🔐 Authentication

This specification supports two authentication methods as documented by Storyblok:

### 1. Personal Access Token
- **Type**: API Key in Authorization header
- **Usage**: `Authorization: YOUR_PERSONAL_ACCESS_TOKEN`
- **Scope**: All spaces associated with your account
- **Security**: Never expose in frontend code or version control

### 2. OAuth Access Token
- **Type**: Bearer token
- **Usage**: `Authorization: Bearer YOUR_OAUTH_ACCESS_TOKEN`
- **Scope**: Single space with TTL
- **Permissions**: Granted during OAuth process

For detailed authentication examples, see [`shared/auth-examples.yaml`](shared/auth-examples.yaml).

## 🌍 Server Regions

The API supports multiple regions as documented in [`shared/servers.yaml`](shared/servers.yaml):

- **EU**: `https://mapi.storyblok.com`
- **US**: `https://api-us.storyblok.com`
- **Canada**: `https://api-ca.storyblok.com`
- **Australia**: `https://api-ap.storyblok.com`
- **China**: `https://app.storyblok.cn`

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm

### Installation
```bash
pnpm install
```

### Development
```bash
# Start Redocly preview server
pnpm specs:preview

# Lint all specifications
pnpm specs:lint

# Validate specific resource
npx @redocly/cli lint resources/stories/stories.yaml
```

### Available Scripts
- `pnpm specs:preview` - Start Redocly preview server
- `pnpm specs:lint` - Lint all OpenAPI specifications
- `pnpm specs:build` - Build specifications (if needed)

## 📖 API Resources

Each resource has its own OpenAPI specification:

| Resource               | File                                                                                                           | Description                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Assets**             | [`resources/assets/assets.yaml`](resources/assets/assets.yaml)                                                 | Manage media files and assets  |
| **Components**         | [`resources/components/components.yaml`](resources/components/components.yaml)                                 | Manage content type components |
| **Datasources**        | [`resources/datasources/datasources.yaml`](resources/datasources/datasources.yaml)                             | Manage data sources            |
| **Datasource Entries** | [`resources/datasource_entries/datasource_entries.yaml`](resources/datasource_entries/datasource_entries.yaml) | Manage datasource entries      |
| **Internal Tags**      | [`resources/internal_tags/internal_tags.yaml`](resources/internal_tags/internal_tags.yaml)                     | Manage internal tagging system |
| **Presets**            | [`resources/presets/presets.yaml`](resources/presets/presets.yaml)                                             | Manage content presets         |
| **Spaces**             | [`resources/spaces/spaces.yaml`](resources/spaces/spaces.yaml)                                                 | Manage Storyblok spaces        |
| **Stories**            | [`resources/stories/stories.yaml`](resources/stories/stories.yaml)                                             | Manage content stories         |

## 🔧 Configuration

### Shared Configuration
- **Servers**: Centralized in [`shared/servers.yaml`](shared/servers.yaml)
- **Security**: Defined in [`shared/security.yaml`](shared/security.yaml)
- **Authentication Schemes**: Detailed in [`shared/security-schemes.yaml`](shared/security-schemes.yaml)

### Redocly Configuration
The [`redocly.yaml`](redocly.yaml) file configures:
- API definitions to include
- Linting rules
- Preview server settings

## 📝 Usage Examples

### Using Personal Access Token
```bash
curl -H "Authorization: YOUR_PERSONAL_ACCESS_TOKEN" \
  https://mapi.storyblok.com/v1/spaces/123/stories
```

### Using OAuth Access Token
```bash
curl -H "Authorization: Bearer YOUR_OAUTH_ACCESS_TOKEN" \
  https://mapi.storyblok.com/v1/spaces/123/stories
```

### JavaScript SDK
```javascript
const StoryblokClient = require('storyblok-js-client')

// Personal Access Token
const Storyblok = new StoryblokClient({
  oauthToken: 'YOUR_PERSONAL_ACCESS_TOKEN'
})

// OAuth Access Token
const Storyblok = new StoryblokClient({
  oauthToken: 'Bearer YOUR_OAUTH_ACCESS_TOKEN'
})
```

## 🔍 Validation

All specifications are validated against OpenAPI 3.1.1 standards:

```bash
# Validate all specs
pnpm specs:lint

# Validate specific resource
npx @redocly/cli lint resources/stories/stories.yaml
```

## 🤝 Contributing

1. Follow OpenAPI 3.1.1 standards
2. Use shared configuration where possible
3. Include proper descriptions and examples
4. Test with Redocly preview
5. Ensure all specifications pass linting

## 📄 License

This project is part of the Monoblok ecosystem. See the main repository for license information.

## 🔗 Related Links

- [Storyblok Official Documentation](https://www.storyblok.com/docs)
- [OpenAPI Specification](https://spec.openapis.org/oas/v3.1.1)
- [Redocly Documentation](https://redocly.com/docs)
- [Storyblok JavaScript SDK](https://github.com/storyblok/storyblok-js-client) 
