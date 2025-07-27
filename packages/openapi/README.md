# Storyblok Management API - OpenAPI Specification

This OpenAPI 3.1.1 specification covers the Storyblok Management API, which allows you to create, edit, update, and delete content programmatically.

## Resources Covered

This specification includes endpoints for the following resources:

- **Stories**: Create, read, update, and delete stories
- **Spaces**: Manage spaces
- **Components**: Create, read, update, and delete components
- **Component Folders**: Organize components in folders
- **Assets**: Upload and manage assets
- **Asset Folders**: Organize assets in folders
- **Datasources**: Create and manage datasources
- **Datasource Entries**: Manage entries within datasources
- **Internal Tags**: Manage internal tags

## API Endpoints

All endpoints follow the pattern: `https://mapi.storyblok.com/v1/spaces/{space_id}/[resource]`

The specification supports multiple regional endpoints:
- EU: https://mapi.storyblok.com
- US: https://api-us.storyblok.com
- Canada: https://api-ca.storyblok.com
- Australia: https://api-ap.storyblok.com
- China: https://app.storyblok.cn

## Authentication

Authentication is done using a personal access token passed in the `Authorization` header.

## Usage

This specification can be used with any OpenAPI-compatible tooling such as:
- Swagger UI
- Postman
- Redoc
- Code generation tools

## Contributing

Feel free to contribute by submitting issues or pull requests to extend the specification with additional endpoints or improve existing ones. 
