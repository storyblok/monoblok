import { CapiClient, buildFilterQuery, is, inArray, gtInt, or, like } from '../dist/index.mjs';

const client = new CapiClient({
  token: process.env.CAPI_TOKEN!, // Your public or preview token
  region: 'eu', // Optional: defaults to 'eu'
});

(async () => {
  try {
    // Simple filter - exact match
    const simpleFilter = buildFilterQuery({
      'content.category': { is: 'news' },
      'content.published': { is: 'true' }
    });

    console.log('Simple filter:', simpleFilter);
    // Output: { "filter_query[content.category][is]": "news", "filter_query[content.published][is]": "true" }

    // OR condition filter
    const orFilter = buildFilterQuery(
      or([
        { 'content.category': { is: 'news' } },
        { 'content.category': { is: 'blog' } }
      ])
    );

    console.log('OR filter:', orFilter);
    // Output: { "filter_query[__or][0][content.category][is]": "news", "filter_query[__or][1][content.category][is]": "blog" }

    // Using helper functions for cleaner syntax
    const helperFilter = buildFilterQuery({
      'content.category': inArray(['news', 'blog']),
      'content.rating': gtInt(4),
      'content.title': like('*breaking*')
    });

    console.log('Helper filter:', helperFilter);
    // Output: { "filter_query[content.category][in]": "news,blog", "filter_query[content.rating][gt_int]": "4", "filter_query[content.title][like]": "*breaking*" }

    // Date range filter (note: can't have same field twice, so this is just an example)
    const dateFilter = buildFilterQuery({
      'content.publish_date': { gt_date: '2023-01-01 00:00' }
    });

    console.log('Date filter:', dateFilter);
    // Output: { "filter_query[content.publish_date][gt_date]": "2023-01-01 00:00", "filter_query[content.publish_date][lt_date]": "2023-12-31 23:59" }

    // Use the filter in an API call
    const { data, error } = await client.stories.list({
      query: {
        version: 'published',
        per_page: 10,
        ...simpleFilter
      }
    });

    if (error) {
      console.error('API Error:', error);
      return;
    }

    console.log('Filtered stories:', data?.stories?.length || 0);

  } catch (error) {
    console.error('Example error:', error);
  }
})();
