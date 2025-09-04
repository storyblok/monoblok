"use client";
import { useStory } from "@/lib/useStory";
import type { SiteConfig } from "../../../.storyblok/types/286726323865714/storyblok-components";
import { storyblokEditable } from "@storyblok/js";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Button from "./Button";

export default function Header() {
  const { story } = useStory<SiteConfig>("site-config");
  const [headerScrollClass, setHeaderScrollClass] = useState("");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const { content } = story;

  // Default to light header if undefined (like Nuxt demo)
  const isLightHeader = content.header_light ?? true;

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200) {
        setHeaderScrollClass("scroll");
      } else {
        setHeaderScrollClass("");
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMobileNav = () => {
    setIsMobileNavOpen(!isMobileNavOpen);
  };

  // Helper function to check if a link is active
  const isLinkActive = (link: any) => {
    if (!link?.story?.full_slug) return false;
    const linkPath = `/${link.story.full_slug}`;
    return pathname === linkPath || pathname.startsWith(linkPath + "/");
  };

  return (
    <header
      className={`fixed left-0 top-0 z-[99] h-32 w-full border-b border-primary-dark transition-all duration-300 ${
        headerScrollClass === "scroll" ? "scroll" : ""
      } ${!isLightHeader ? "bg-primary-dark" : ""}`}
    >
      <div className="mx-auto flex size-full max-w-screen-2xl items-center justify-between px-4 lg:justify-start lg:px-8">
        <Link
          href="/"
          className="focus-ring flex shrink-0"
          aria-label="Return to homepage"
        >
          {content.header_logo && (
            <img
              src={content.header_logo.filename!}
              alt={content.header_logo.alt ?? ""}
              className="pointer-events-none max-h-[80px] w-full max-w-[180px] origin-left object-contain transition-transform duration-700 xl:max-w-[250px]"
            />
          )}
        </Link>
        <nav className="main-nav invisible ml-auto mr-12 hidden h-full lg:visible lg:block">
          <ul className="h-full">
            {content.header_nav?.map((item) => (
              <li
                key={item._uid}
                className="h-full"
                {...storyblokEditable(item as any)}
              >
                <Link
                  href={item.link?.story?.full_slug || item.link?.url || "#"}
                  className={`focus-ring relative flex h-full cursor-pointer items-center text-sm xl:text-base transition-colors font-medium nav-item ${
                    isLightHeader ? "text-primary-dark" : "text-white"
                  } ${isLinkActive(item.link) ? "active" : ""}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav className="invisible ml-auto hidden md:visible md:mr-8 md:block lg:mx-0">
          <ul className="flex items-center space-x-4 xl:space-x-8">
            {content.header_buttons?.map((item) => (
              <li key={item._uid}>
                <Button button={item} />
              </li>
            ))}
          </ul>
        </nav>
        <button
          className="focus-ring cursor-pointer lg:invisible lg:hidden"
          onClick={toggleMobileNav}
        >
          <span className="sr-only">Toggle navigation</span>
          <div
            className={`bar1 my-1 h-0.5 w-7 transition-all ${isLightHeader ? "bg-primary-dark" : "bg-primary-background"}`}
          ></div>
          <div
            className={`bar2 my-1 h-0.5 w-7 transition-all ${isLightHeader ? "bg-primary-dark" : "bg-primary-background"}`}
          ></div>
          <div
            className={`bar3 my-1 h-0.5 w-7 transition-all ${isLightHeader ? "bg-primary-dark" : "bg-primary-background"}`}
          ></div>
        </button>
      </div>
    </header>
  );
}
