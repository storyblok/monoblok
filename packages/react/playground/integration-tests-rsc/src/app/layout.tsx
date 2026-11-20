import type { ReactNode } from "react";
import StoryblokProvider from "@/components/storyblok-provider";

export const metadata = {
  title: "Storyblok React RSC Integration Tests",
  description: "RSC playground for Visual Editor QA",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <StoryblokProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </StoryblokProvider>
  );
}
