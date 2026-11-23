export const metadata = {
  title: "Storyblok React RSC Integration Tests",
  description: "Dedicated RSC integration-test playground for Visual Editor QA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
