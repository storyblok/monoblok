# @storyblok/bridge

**TypeScript definitions for the Storyblok Visual Editor Bridge**

This package provides comprehensive TypeScript definitions for the `StoryblokBridge` class served from the official Storyblok CDN.

## Installation

```bash
npm install @storyblok/bridge
```

## Quick Start

### 1. Include the CDN Script

```html
<script src="//app.storyblok.com/f/storyblok-v2-latest.js"></script>
```

### 2. Use with TypeScript

```typescript
import type { StoryblokBridgeConfigV2, ISbEventPayload } from '@storyblok/bridge';

const bridge = new StoryblokBridge({
  resolveRelations: ["article.author"],
  resolveLinks: "url",
  preventClicks: true
} as StoryblokBridgeConfigV2);

bridge.on('input', (event: ISbEventPayload) => {
  console.log('Story updated:', event.story);
});
```

## Requirements

- Include the official CDN script: `https://app.storyblok.com/f/storyblok-v2-latest.js`
- TypeScript project (this package provides types only)
- Browser environment (same as official bridge)

## Related

- [Official Bridge Documentation](https://www.storyblok.com/docs/packages/storyblok-bridge)
- [Storyblok Visual Editor Guide](https://www.storyblok.com/docs/concepts/visual-editor)

## License

MIT
