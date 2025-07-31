import { MapiClient } from '../dist/index.mjs';

const client = new MapiClient({
  token: {
    accessToken: process.env.MAPI_TOKEN!,
  },
});


(async () => {
  const {data} = await client.spaces.list()

  if (!data) {
    throw new Error('No spaces found')
  }

  const space = data.spaces?.[0]
  if (!space) {
    throw new Error('No space found')
  }

  const stories = await client.stories.list({
    path: {
      space_id: space.id,
    },
    query: {
      page: 1,
      per_page: 3
    },
  })

  console.log(stories.data?.stories)
})()
