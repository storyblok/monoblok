import { MapiClient } from './index';

// Example usage of the single client instance
async function example() {
  // Create the parent client with a single client instance
  const client = new MapiClient({
    baseUrl: 'https://api.storyblok.com/v2',
    headers: {
      'Authorization': 'Bearer your-token-here'
    }
  });

  // All requests use the same client instance, enabling centralized control
  // for rate limiting, retries, and other cross-cutting concerns
  
  // Datasources resource
  const datasources = await client.datasources.getDatasources({
    path: { space_id: 123 }
  });

  const newDatasource = await client.datasources.createDatasource({
    path: { space_id: 123 },
    body: {
      datasource: {
        name: 'My Datasource',
        slug: 'my-datasource'
      }
    }
  });

  // Stories resource - uses the same client instance
  const stories = await client.stories.getStories({
    path: { space_id: 123 }
  });

  const story = await client.stories.getStory({
    path: { space_id: 123, story_id: 456 }
  });

  // Components resource
  const components = await client.components.getComponents({
    path: { space_id: 123 }
  });

  // Internal tags resource
  const tags = await client.internalTags.getInternalTags({
    path: { space_id: 123 }
  });

  // Update configuration at runtime if needed
  client.setConfig({
    headers: {
      'Authorization': 'Bearer new-token-here'
    }
  });

  console.log('All resources share the same client instance for centralized control!');
}

export { example }; 
