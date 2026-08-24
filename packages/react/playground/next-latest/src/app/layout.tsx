import "./globals.css";

export const metadata = {
  title: "Storyblok Next.js 16",
  description: "Storyblok Next.js 16 App Router playground",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
