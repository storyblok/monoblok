#!/usr/bin/env node

/**
 * Script to generate 5k+ test stories for performance testing
 * This validates the user complaints in issue #220 about CLI performance with large datasets
 */

import { ManagementApiClient } from '@storyblok/management-api-client';

const BATCH_SIZE = 100;
const TOTAL_STORIES = 5000;
const DELAY_BETWEEN_BATCHES = 1000; // 1 second to respect rate limits
const OFFSET = 5197;
// Story template with page component containing migration-component
const STORY_TEMPLATE = {
  component: 'page',
  createContent: index => ({
    _uid: 'cb547cf4-2bd9-495b-9601-3e0960b4d931',
    body: [
      {
        _uid: '6465f0cd-1f27-4cd0-b135-21718edd17ca',
        games: '',
        title: `Migration Test Story ${index}`,
        amount: (Math.floor(Math.random() * 100) + 1).toString(),
        content: {},
        component: 'migration-component',
        unchanged: 'unchanged',
        highlighted: Math.random() > 0.5,
        _editable: '<!--#storyblok#{"name": "migration-component", "space": "295017", "uid": "6465f0cd-1f27-4cd0-b135-21718edd17ca", "id": "636211611"}-->',
      },
    ],
    favorite: Math.random() > 0.7,
    component: 'page',
    _editable: '<!--#storyblok#{"name": "page", "space": "295017", "uid": "cb547cf4-2bd9-495b-9601-3e0960b4d931", "id": "636211611"}-->',
  }),
};

function generateStoryData(index) {
  return {
    name: `Migration Test Story ${index}`,
    slug: `migration-test-story-${index}`,
    content: STORY_TEMPLATE.createContent(index),
    is_folder: false,
    published: Math.random() > 0.3, // 70% published
    tag_list: ['generated', 'test', 'migration', `batch-${Math.floor(index / BATCH_SIZE)}`],
    meta_data: {
      title: `Migration Test Story ${index}`,
      description: `Auto-generated story for CLI migration performance testing - Story #${index}`,
    },
  };
}

async function createStoriesBatch(spaceId, stories, token) {
  const client = new ManagementApiClient({
    token: {
      accessToken: token,
    },
  });
  const results = [];

  for (const story of stories) {
    try {
      const { data } = await client.stories.create({
        path: {
          space_id: Number.parseInt(spaceId, 10),
        },
        body: {
          story,
        },
        throwOnError: true,
      });
      results.push(data);
      console.log(`✅ Created story: ${story.name}`);
    }
    catch (error) {
      console.error(`❌ Failed to create story ${story.name}:`, error);
      results.push(null);
    }
  }

  return results;
}

async function generateTestStories(spaceId, token, totalStories = TOTAL_STORIES) {
  console.log(`🚀 Starting generation of ${totalStories} test stories in batches of ${BATCH_SIZE}`);
  console.log(`📍 Target space: ${spaceId}`);
  console.log(`⏱️  Estimated time: ~${Math.ceil(totalStories / BATCH_SIZE * DELAY_BETWEEN_BATCHES / 1000 / 60)} minutes\n`);

  const allResults = [];
  const startTime = Date.now();

  for (let i = 0; i < totalStories; i += BATCH_SIZE) {
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const remainingStories = Math.min(BATCH_SIZE, totalStories - i);

    console.log(`📦 Processing batch ${batchNumber}/${Math.ceil(totalStories / BATCH_SIZE)} (${remainingStories} stories)`);

    // Generate batch of story data
    const batchStories = [];
    for (let j = 0; j < remainingStories; j++) {
      batchStories.push(generateStoryData(i + j + OFFSET));
    }

    // Create stories in this batch
    const batchResults = await createStoriesBatch(spaceId, batchStories, token);
    allResults.push(...batchResults);

    const successCount = batchResults.filter(r => r !== null).length;
    console.log(`✅ Batch ${batchNumber} completed: ${successCount}/${remainingStories} successful\n`);

    // Rate limiting delay between batches
    if (i + BATCH_SIZE < totalStories) {
      console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...\n`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  const successfulStories = allResults.filter(r => r !== null).length;

  console.log(`\n🎉 Generation completed!`);
  console.log(`📊 Results:`);
  console.log(`   • Total attempted: ${totalStories}`);
  console.log(`   • Successful: ${successfulStories}`);
  console.log(`   • Failed: ${totalStories - successfulStories}`);
  console.log(`   • Duration: ${duration}s`);
  console.log(`   • Rate: ${Math.round(successfulStories / duration * 60)} stories/minute`);

  return allResults.filter(r => r !== null);
}

async function main() {
  const args = process.argv.slice(2);
  const spaceId = args[0];
  const token = args[1];
  const count = Number.parseInt(args[2]) || TOTAL_STORIES;

  if (!spaceId) {
    console.error('❌ Please provide a space ID as the first argument');
    console.log('Usage: node generate-test-stories.js <space-id> <token> [count]');
    process.exit(1);
  }

  if (!token) {
    console.error('❌ Please provide a management token as the second argument');
    console.log('Usage: node generate-test-stories.js <space-id> <token> [count]');
    process.exit(1);
  }

  if (count < 1 || count > 50000) {
    console.error('❌ Story count must be between 1 and 50,000');
    process.exit(1);
  }

  try {
    const stories = await generateTestStories(spaceId, token, count);
    console.log(`\n✅ Successfully generated ${stories.length} test stories`);
    console.log(`\n📝 You can now test CLI commands like:`);
    console.log(`   • storyblok pull-stories --space ${spaceId}`);
    console.log(`   • storyblok migrations run --space ${spaceId}`);
    console.log(`\n🧪 This should help reproduce the performance issues reported in #220`);
  }
  catch (error) {
    console.error('❌ Failed to generate test stories:', error.message);
    process.exit(1);
  }
}

// Handle CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export {
  createStoriesBatch,
  generateStoryData,
  generateTestStories,
};
