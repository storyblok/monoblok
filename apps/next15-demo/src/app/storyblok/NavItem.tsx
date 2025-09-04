import { storyblokEditable } from "@storyblok/react";
import type { NavItem as NavItemBlok } from "../../../.storyblok/types/286726323865714/storyblok-components";
import Link from "next/link";
import clsx from "clsx";

interface NavItemProps {
  blok: NavItemBlok;
  className?: string;
  reducedFontWeight?: boolean;
}

export default function NavItem({
  blok,
  className,
  reducedFontWeight,
}: NavItemProps) {
  return (
    <Link
      href={blok.link?.story?.full_slug ?? blok.link?.url ?? ""}
      className={clsx(
        "focus-ring relative flex h-full cursor-pointer items-center text-base transition-colors storyblok__outline",
        {
          "font-normal": reducedFontWeight,
          "font-medium": !reducedFontWeight,
        },
        className || "text-white"
      )}
      {...storyblokEditable(blok as any)}
    >
      {blok.label}
    </Link>
  );
}
