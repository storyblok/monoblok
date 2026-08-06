// STUB #2 (of 2) — the client response.
//
// Hardcoded nested story whose `body` exercises every nesting case the spike
// validates, plus Dipankar-specific cases:
//
//   page (server)
//    └ grid (server) ├ teaser (client)  └ feature (server)              client-in-server
//    ├ client-card (client) └ server-quote (server)                     server-in-client via StoryblokBlocks
//    ├ server-section > client-panel > server-section > client-leaf     deep alternation
//    ├ theme-provider (client) └ server-section > theme-consumer        context through a server subtree
//    ├ async-server-fetch (async, jsonplaceholder)                      use() + Suspense + cache
//    ├ server-only-secret                                               process.env access
//    └ unregistered-blok                                                fallback path
import type { Story } from '../_sdk/types';

export const initialStory: Story = {
  id: 'home',
  name: 'home',
  content: {
    _uid: 'root',
    component: 'page',
    title: 'Storyblok live preview — RSC nesting probe (Dipankar approach)',
    body: [
      {
        _uid: 'grid-1',
        component: 'grid',
        heading: 'Grid (server) hosting mixed children',
        body: [
          { _uid: 'teaser-1', component: 'teaser', headline: 'Teaser headline (client in server)' },
          {
            _uid: 'feature-1',
            component: 'feature',
            name: 'Feature (server leaf)',
            text: 'Rendered entirely on the server.',
          },
        ],
      },
      {
        _uid: 'card-1',
        component: 'client-card',
        title: 'Client card wrapping a server blok via StoryblokBlocks',
        body: [
          {
            _uid: 'quote-1',
            component: 'server-quote',
            quote: 'A server component rendered from inside a client one via the SDK registry.',
            authorId: 'author-1',
          },
        ],
      },
      {
        _uid: 'sec-l1',
        component: 'server-section',
        heading: 'L1 server',
        body: [
          {
            _uid: 'panel-l2',
            component: 'client-panel',
            label: 'L2 client',
            body: [
              {
                _uid: 'sec-l3',
                component: 'server-section',
                heading: 'L3 server',
                body: [{ _uid: 'leaf-l4', component: 'client-leaf', label: 'L4 client' }],
              },
            ],
          },
        ],
      },
      {
        _uid: 'provider-1',
        component: 'theme-provider',
        theme: 'midnight',
        body: [
          {
            _uid: 'sec-ctx',
            component: 'server-section',
            heading: 'Server subtree between provider and consumer',
            body: [{ _uid: 'consumer-1', component: 'theme-consumer' }],
          },
        ],
      },
      { _uid: 'async-1', component: 'async-server-fetch', postId: 1 },
      { _uid: 'secret-1', component: 'server-only-secret' },
      { _uid: 'missing-1', component: 'totally-unregistered-blok-name' },
    ],
  },
};
