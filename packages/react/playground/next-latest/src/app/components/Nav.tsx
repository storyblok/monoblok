import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/react/richtext", label: "Rich Text" },
];

export function Nav() {
  return (
    <nav
      style={{
        display: "flex",
        gap: "16px",
        padding: "12px 16px",
        borderBottom: "1px solid #e5e7eb",
        background: "#fff",
        marginBottom: "20px",
      }}
    >
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          style={{ color: "#7C3AED", textDecoration: "none", fontWeight: 500 }}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export default Nav;
