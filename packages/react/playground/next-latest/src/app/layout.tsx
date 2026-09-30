import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
