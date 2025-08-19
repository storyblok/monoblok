import { IS, buildFilterQuery, CapiClient } from '../dist';

const client = new CapiClient({
  token:  process.env.CAPI_TOKEN!, // Your public or preview token
  region: 'eu', // Optional: defaults to 'eu'
});


(async () => {
  try {
  // Get current space information
  const {
    data,
    error,

  } = await client.spaces.get();

  if (error) {
    console.error(error);
  }

  // console.log('Space:', data);

  // Get multiple stories with filtering
  const stories = await client.stories.list({
    query: {
      version: 'published',
      per_page: 10,
      page: 1,
      ...buildFilterQuery({
        'headline': { $is: IS.NOT_NULL }
      })
    }
  });

  if (stories.error) {
    console.log(stories.response);
    console.error(stories.error);
      process.exit(1);
  }

  console.log(stories.request);
  console.log('Stories:', JSON.stringify(stories.data?.stories, null, 2));
  console.log(stories.data?.stories?.length);
  process.exit(0);

  // Get a single story by slug
  const { data: storyData } = await client.stories.get({
    path: {
      identifier: 'home'
    },
    query: {
      version: 'published',
      resolve_links: 'story'
    }
  });

  console.log('Story:', storyData);

  // Get links
  const { data: linksData } = await client.links.list({
    query: {
      starts_with: 'blog/',
      include_dates: 1
    }
  });

  console.log('Links:', linksData?.links);

  // Get datasources
  const { data: datasourcesData } = await client.datasources.list({
    query: {
      page: 1,
      per_page: 25
    }
  });

  console.log('Datasources:', datasourcesData?.datasources);

  // Get datasource entries
  const { data: entriesData } = await client.datasourceEntries.list({
    query: {
      datasource: 'categories',
      dimension: 'en',
      page: 1,
      per_page: 100
    }
  });

  console.log('Datasource Entries:', entriesData?.datasource_entries);

  // Get tags
  const { data: tagsData } = await client.tags.list({
    query: {
      starts_with: 'blog/'
    }
  });

  console.log('Tags:', tagsData?.tags);

  // Get signed URL for private asset
  const { data: assetData, error: assetError, response } = await client.assets.get({
    query: {
      filename: 'https://a.storyblok.com/f/123456/1920x1080/image.jpg'
    }
  });

  if (assetError) {
    console.log(response);
    console.log(assetError);
  }

  console.log('Asset:', assetData);
  
} catch (error) {
  console.error(error);
}
})();

