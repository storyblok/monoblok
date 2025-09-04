import "./globals.css";

export const metadata = {
  title: "Storyblok Next.js 15 Playground",
  description: "Next.js 15 example using the Storyblok React SDK",
};

interface RootLayoutType {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutType) {
  return (
    <html lang="en">
      <head>
        {/* Preload critical fonts to prevent FOUT */}
        <link
          rel="preload"
          href="/fonts/ABCMarfa-Regular.Df7MMfty.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/ABCMarfa-Black.C6V3HcGx.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/ABCMarfa-Semibold.7TntiHrX.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/ABCMarfa-Medium.B6x9xJO4.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <script src="https://app.storyblok.com/f/storyblok-v2-latest.js" />
        <div>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
