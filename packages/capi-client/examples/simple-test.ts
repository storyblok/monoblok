import { CapiClient } from '../dist/index.mjs';

const client = new CapiClient({
  token: process.env.CAPI_TOKEN!, // Your public or preview token
  region: 'eu', // Optional: defaults to 'eu'
});

(async () => {
  try {
    // Test basic functionality without filter queries
    const { data, error } = await client.stories.list({
      query: {
        version: 'published',
        per_page: 5
      }
    });

    if (error) {
      console.error('API Error:', error);
      return;
    }

    console.log('Stories found:', data?.stories?.length || 0);
    console.log('First story:', data?.stories?.[0]?.name);

  } catch (error) {
    console.error('Test error:', error);
  }
})();
