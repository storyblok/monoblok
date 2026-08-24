import Link from "next/link";

export default function Header() {
  return (
    <header className="mb-8">
      <h1 className="mb-8 text-4xl font-bold dark:text-white">Storyblok Next.js 16 Example</h1>
      <nav className="flex items-center gap-6">
        <Link
          href="/"
          className="flex rounded-lg bg-blue-500 p-2 text-white transition-colors hover:bg-blue-600"
        >
          Home
        </Link>
        <Link
          href="/react/richtext"
          className="flex rounded-lg bg-blue-500 p-2 text-white transition-colors hover:bg-blue-600"
        >
          Go to Rich Text Example
        </Link>
      </nav>
    </header>
  );
}
