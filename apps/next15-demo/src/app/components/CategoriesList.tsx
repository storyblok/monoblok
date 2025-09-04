import Link from "next/link";
import type { Category } from "@/lib/types";
import { ISbStoryData } from "@storyblok/js";

interface CategoriesListProps {
  categories: (ISbStoryData<Category> | string)[];
  className?: string;
}

export default function CategoriesList({
  categories,
  className = "",
}: CategoriesListProps) {
  return (
    <ul className={className}>
      {categories.map((category) => {
        const cat = typeof category === "string" ? null : category;
        if (!cat) return null;

        return (
          <li key={cat.uuid}>
            <Link
              href={`/${cat.full_slug}`}
              className="focus-ring flex items-center space-x-2"
            >
              {cat.content?.icon?.filename && (
                <img
                  src={cat.content.icon.filename}
                  alt={(cat.content.alt as string) || ""}
                  width={24}
                />
              )}
              <span className="hover:text-secondary text-primary-dark transition-all">
                {cat.name}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
