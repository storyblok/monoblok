export const metadata = {
  title: "Storyblok Next.js 13 App Router",
  description: "Storyblok Next.js 13 App Router playground",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
