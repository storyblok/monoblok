import { CapiClient, buildFilterQuery, i18nField, like, is } from '../dist/index.mjs';

const client = new CapiClient({
  token: process.env.CAPI_TOKEN!, // Your public or preview token
  region: 'eu', // Optional: defaults to 'eu'
});

(async () => {
  try {
    // Filter by German headline
    const germanFilter = buildFilterQuery({
      [i18nField('headline', 'de')]: { like: 'Die Symphonie*' }
    });

    console.log('German filter:', germanFilter);
    // Output: { "filter_query[headline__i18n__de][like]": "Die Symphonie*" }

    // Filter by Spanish (Colombia) headline
    const spanishFilter = buildFilterQuery({
      [i18nField('headline', 'es-co')]: { 
        is: 'Sinfonía de la Tierra: Navegar por las maravillas y los desafíos de nuestro oasis azul' 
      }
    });

    console.log('Spanish filter:', spanishFilter);
    // Output: { "filter_query[headline__i18n__es_co][is]": "Sinfonía de la Tierra: Navegar por las maravillas y los desafíos de nuestro oasis azul" }

    // Filter by English content
    const englishFilter = buildFilterQuery({
      [i18nField('content', 'en')]: { like: '*important*' }
    });

    console.log('English filter:', englishFilter);
    // Output: { "filter_query[content__i18n__en][like]": "*important*" }

    // Use the filter in an API call (requires language parameter and version=published)
    const { data, error } = await client.stories.list({
      query: {
        version: 'published',
        language: 'es-co', // Must match the language in the filter
        per_page: 10,
        ...spanishFilter
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
