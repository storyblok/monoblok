# Storyblok React SDK - Next.js 15 Demo

This is a recreation of the default Storyblok demo app using **Next.js 15** and the **Storyblok React SDK**. It demonstrates how to build a complete content-driven website with the latest Next.js features and Storyblok's modern React integration.

## 🎯 What This Demo Shows

This demo recreates the classic Storyblok default site experience with:
- **Next.js 15** - Latest React framework with App Router and RSC
- **Storyblok React SDK** - Modern provider-based architecture
- **Client-only visual editing** - Real-time content updates without server actions
- **TypeScript-first** - Full type safety and IntelliSense support
- **Tailwind CSS 4** - Modern styling with the latest version

## 🚀 Key Features Demonstrated

- **Provider-based architecture** - Clean setup with `StoryblokProvider`
- **Declarative component registration** - Visual component mapping in JSX
- **Composable data fetching hooks** - `useStory` and `useStories` with loading/error states
- **Rich text rendering** - `StoryblokRichText` component
- **Visual editing bridge** - Real-time updates during content editing
- **Responsive design** - Mobile-first approach with Tailwind CSS

## 🏃‍♂️ Getting Started

```bash
# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

Visit `https://localhost:3000` to see the demo in action!

## 📁 Project Structure

- `src/app/page.tsx` - Main demo page with content fetching
- `src/app/react/richtext/page.tsx` - Rich text example
- `src/app/components/BridgeHandler.tsx` - Visual editing bridge
- `src/app/components/` - Demo components (Page, Teaser, Grid, EmojiRandomizer)
- `src/app/storyblok/` - Storyblok component definitions

## 🔧 Tech Stack

- **Framework**: Next.js 15.3.2
- **React**: 19.1.0
- **SDK**: @storyblok/react (workspace)
- **Styling**: Tailwind CSS 4.1.10
- **State Management**: SWR for data fetching
- **TypeScript**: Full type safety

## 🎨 Visual Editing

This demo showcases **client-only visual editing** that works seamlessly with Next.js 15:

- **Real-time updates** - Changes appear instantly during editing
- **No server actions** - All updates happen on the client side
- **RSC compatible** - Works with React Server Components
- **Bridge integration** - Direct Storyblok bridge updates

## 📚 Learning Resources

- [Storyblok React SDK Documentation](https://github.com/storyblok/storyblok-react)
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 🤝 Contributing

This demo is part of the Storyblok React SDK workspace. Feel free to explore the code and experiment with different patterns!
