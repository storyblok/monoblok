import type { NavItem } from "@/lib/types";
import NavItemComponent from "../storyblok/NavItem";

interface FooterNavProps {
  headline: string;
  nav: NavItem[];
  textColor: string;
}

export default function FooterNav({
  headline,
  nav,
  textColor,
}: FooterNavProps) {
  return (
    <div>
      <h3
        className={`mb-5 font-display text-xl font-semibold xl:text-2xl ${textColor}`}
      >
        {headline}
      </h3>
      <nav>
        <ul className="flex flex-col space-y-3 text-lg">
          {nav.map((item) => (
            <li key={item._uid}>
              <NavItemComponent
                blok={item}
                reducedFontWeight={true}
                className={textColor}
              />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
