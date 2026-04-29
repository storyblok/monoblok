import { component$ } from '@builder.io/qwik';
import { Link, useLocation } from '@builder.io/qwik-city';

export const Nav = component$(() => {
  const loc = useLocation();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/showcase', label: 'Showcase' },
  ];

  return (
    <nav class="border-b border-gray-200 bg-white px-6 py-4">
      <div class="mx-auto flex max-w-5xl items-center gap-6">
        <span class="font-semibold text-gray-900">monoblok</span>
        <ul class="flex gap-4">
          {links.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                class={[
                  'text-sm font-medium transition-colors hover:text-indigo-600',
                  loc.url.pathname === href ? 'text-indigo-600' : 'text-gray-600',
                ]}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
});
