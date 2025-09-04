# @storyblok/react

A modern, composable React SDK for Storyblok focused on rendering and component registration. This package provides the tools you need to render Storyblok content in your React applications.

## 🎯 Design Goals

- **Rendering-Focused**: Dedicated to component registration and rendering
- **Framework Agnostic**: Works with any React setup
- **Type Safety**: Full TypeScript support with generated types
- **Minimal Magic**: Predictable, transparent behavior
- **Composable**: Flexible component registration patterns

## 🚀 Quick Start

```tsx
import { Bloks, Blok } from '@storyblok/react';

function App() {
  const story = {
    content: {
      body: [
        {
          component: 'page',
          _uid: 'page-1',
          title: 'Welcome',
          content: 'Hello World'
        },
        {
          component: 'teaser',
          _uid: 'teaser-1',
          headline: 'Featured Content',
          text: 'This is a teaser'
        }
      ]
    }
  };
  
  return (
    <Bloks fallback={FallbackComponent}>
      <Blok component="page" element={PageComponent} />
      <Blok component="teaser" element={TeaserComponent} />
    </Bloks>
  );
}
```

## 📚 Core Concepts

### 1. Component Registration

The `Bloks` component manages component registration using a declarative approach:

```tsx
<Bloks fallback={FallbackComponent}>
  <Blok component="page" element={PageComponent} />
  <Blok component="teaser" element={TeaserComponent} />
  <Blok 
    component="hero"
    render={({ blok }) => (
      <HeroComponent blok={blok} />
    )}
  />
</Bloks>
```

### 2. Rich Text Rendering

Render Storyblok rich text content with full control over styling:

```tsx
import { StoryblokRichText, useStoryblokRichText } from '@storyblok/react';

// As a component
<StoryblokRichText 
  doc={blok.content} 
  resolvers={{
    paragraph: ({ children }) => <p className="my-4">{children}</p>,
    heading: ({ children, level }) => {
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      return <Tag className="text-2xl font-bold">{children}</Tag>;
    }
  }}
/>

// As a hook
const renderedContent = useStoryblokRichText(blok.content, {
  resolvers: {
    // Custom resolvers here
  }
});
```

## 🔧 API Reference

### Bloks

The main component for registering and rendering Storyblok components.

```tsx
interface BloksProps<T extends BlokData> {
  children: ReactElement<BlokProps<T>> | ReactElement<BlokProps<T>>[];
  fallback?: React.ComponentType<{ blok: T }>;
  blok: T;
}
```

**Props:**
- `children`: Blok components for registration
- `fallback`: Component to render when a blok type is not found
- `blok`: The blok data to render

### Blok

Individual component registration.

```tsx
interface BlokProps<T extends BlokData> {
  component: T['component'];
  element?: React.ComponentType<{ blok: T }>;
  render?: ({ blok }: { blok: T }) => ReactElement;
  children?: ({ blok }: { blok: T }) => ReactElement;
  blok?: T;
}
```

**Props:**
- `component`: Storyblok component type name
- `element`: React component to render
- `render`: Function to render with custom logic
- `children`: Alternative to render (function as children)
- `blok`: Optional blok data for standalone usage

### useBloks

Hook that returns type-safe blok components.

```tsx
const { Blok, Bloks } = useBloks<YourBlokTypes>();
```

### StoryblokRichText

Component for rendering rich text content.

```tsx
interface StoryblokRichTextProps {
  doc: StoryblokRichTextNode<React.ReactElement>;
  resolvers?: StoryblokRichTextResolvers<React.ReactElement>;
}
```

### useStoryblokRichText

Hook for rendering rich text content.

```tsx
const renderedContent = useStoryblokRichText(
  content: StoryblokRichTextNode,
  options?: StoryblokRichTextOptions
);
```

## 🎨 Advanced Patterns

### Custom Rendering Logic

```tsx
<Blok 
  component="featured_posts"
  render={({ blok }) => {
    return (
      <FeaturedPosts 
        posts={blok.posts}
        layout={blok.layout}
        showAuthor={blok.show_author}
      />
    );
  }}
/>
```

### Type-Safe Component Registration

```tsx
import { useBloks } from '@storyblok/react';

type MyBlokTypes = 
  | { component: 'page'; _uid: string; title: string; content: string }
  | { component: 'teaser'; _uid: string; headline: string; text: string };

function MyApp() {
  const { Blok, Bloks } = useBloks<MyBlokTypes>();
  
  return (
    <Bloks blok={story.content}>
      <Blok component="page" element={PageComponent} />
      <Blok component="teaser" element={TeaserComponent} />
    </Bloks>
  );
}
```

### Conditional Component Registration

```tsx
<Bloks>
  <Blok component="page" element={PageComponent} />
  {showAdvancedFeatures && (
    <Blok component="advanced_chart" element={AdvancedChartComponent} />
  )}
</Bloks>
```

### Custom Rich Text Resolvers

```tsx
const customResolvers = {
  paragraph: ({ children }) => (
    <p className="text-gray-700 leading-relaxed mb-4">{children}</p>
  ),
  heading: ({ children, level }) => {
    const classes = {
      1: 'text-4xl font-bold mb-6',
      2: 'text-3xl font-semibold mb-4',
      3: 'text-2xl font-medium mb-3'
    };
    const Tag = `h${level}` as keyof JSX.IntrinsicElements;
    return <Tag className={classes[level]}>{children}</Tag>;
  },
  link: ({ children, href }) => (
    <a href={href} className="text-blue-600 hover:text-blue-800 underline">
      {children}
    </a>
  )
};

<StoryblokRichText doc={blok.content} resolvers={customResolvers} />
```

## 🎯 Benefits

### 1. **Simplified Mental Model**
- Clear separation between registration and rendering
- Intuitive component-based approach
- No global state or side effects

### 2. **Better Developer Experience**
- TypeScript-first design with full type safety
- Clear error boundaries and fallback handling
- Composable patterns for different use cases

### 3. **Flexibility**
- Multiple rendering patterns (element, render, children)
- Conditional component registration
- Custom rich text resolvers

### 4. **Performance**
- Stateless design reduces memory footprint
- Efficient component registration
- Optimized rendering patterns

### 5. **Maintainability**
- Clear separation of concerns
- Testable components and hooks
- Predictable rendering flow

## 🔮 Environment Detection

The package includes utilities for detecting the Storyblok environment:

```tsx
import { isBrowser, isServer, isVisualEditor, isBridgeLoaded } from '@storyblok/react';

// Check if running in browser
if (isBrowser()) {
  // Browser-specific code
}

// Check if running in Storyblok Visual Editor
if (isVisualEditor()) {
  // Visual editor specific code
}
```

## 📖 Examples

See the `playground/` directory for comprehensive examples covering all rendering patterns and use cases.
