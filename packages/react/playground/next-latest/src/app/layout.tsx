import "./globals.css";
import { Nav } from "@/app/components/Nav";
import { PreviewBanner } from "@/app/components/PreviewBanner";

export const metadata = {
  title: "Storyblok React Playground",
  description: "Storyblok @storyblok/react playground",
};

interface RootLayoutType {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutType) {
  return (
    <html lang="en">
      <body>
        <PreviewBanner />
        <Nav />
        {children}
      </body>
    </html>
  );
}
