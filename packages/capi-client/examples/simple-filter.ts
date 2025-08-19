import { 
  CapiClient, 
  buildFilterQuery, 
  IS,
  i18nField,
  nestedField,
  nestedProperty
} from '../dist/index.mjs';

const client = new CapiClient({
  token: process.env.CAPI_TOKEN!, // Your public or preview token
  region: 'eu', // Optional: defaults to 'eu'
});

(async () => {
  try {
    console.log('=== Simple Filter Query Examples ===\n');

    // 1. Basic filtering
    console.log('1. Basic filtering:');
    const basicFilter = buildFilterQuery({
      'content.published': { is: IS.TRUE },
      'content.categories': { is: IS.NOT_EMPTY_ARRAY },
      'content.rating': { gt_int: 4 }
    });
    console.log('Basic filter:', basicFilter);
    console.log();

    // 2. Internationalized filtering
    console.log('2. Internationalized filtering:');
    const i18nFilter = buildFilterQuery({
      [i18nField('headline', 'de')]: { like: 'Die Symphonie*' },
      [i18nField('content', 'en')]: { like: '*important*' }
    });
    console.log('i18n filter:', i18nFilter);
    console.log();

    // 3. Nested field filtering
    console.log('3. Nested field filtering:');
    const nestedFilter = buildFilterQuery({
      [nestedField('body', 0, 'name')]: { is: 'This is a nested blok' },
      [nestedProperty('seo', 'description')]: { is: IS.NOT_EMPTY }
    });
    console.log('Nested filter:', nestedFilter);
    console.log();

    // 4. Complex filtering
    console.log('4. Complex filtering:');
    const complexFilter = buildFilterQuery({
      'content.published': { is: IS.TRUE },
      'content.category': { in: ['news', 'blog'] },
      'content.rating': { gt_int: 4 },
      'content.title': { like: '*breaking*' },
      'content.status': { not_in: ['draft', 'archived'] },
      'content.tags': { any_in_array: ['featured', 'important'] }
    });
    console.log('Complex filter:', complexFilter);
    console.log();

    // 5. Test API call
    console.log('5. Testing API call:');
    const { data, error } = await client.stories.list({
      query: {
        version: 'published',
        per_page: 5,
        ...basicFilter
      }
    });

    if (error) {
      console.error('API Error:', error);
    } else {
      console.log('Stories found:', data?.stories?.length || 0);
    }

    console.log('\n=== Simple and reliable! ===');

  } catch (error) {
    console.error('Example error:', error);
  }
})();
