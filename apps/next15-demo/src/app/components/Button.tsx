import type { Button } from "@/lib/types";
import { storyblokEditable } from "@storyblok/react";
import Link, { type LinkProps } from "next/link";
import clsx from "clsx";

interface ButtonProps {
  button: Button;
  className?: string;
}

export default function Button({
  button,
  className,
  ...props
}: ButtonProps & Omit<LinkProps, "href">) {
  const getUrl = () => {
    if (button.link.url !== "") {
      return button.link.url;
    }
    switch (button.link.linktype) {
      case "story":
        return `/${button.link.story?.full_slug}`;
      case "email":
        return `mailto:${button.link.email}`;
      case "url":
      case "asset":
      default:
        return button.link.url;
    }
  };

  const getClasses = () => {
    let classes = `focus-ring font-semibold inline-flex w-full sm:w-auto items-center justify-center tracking-wider cursor-pointer transition-all duration-300 rounded-md border border-2 border-${button.background_color}`;

    // Size classes
    switch (button.size) {
      case "small":
        classes += " py-2 px-6";
        break;
      case "large":
        classes += " py-4 px-10";
        break;
      case "medium":
      default:
        classes += " py-3 px-8";
        break;
    }

    // Style classes
    switch (button.style) {
      case "ghost":
        classes += ` bg-transparent text-${button.background_color} hover:bg-${button.background_color} hover:text-${button.text_color}`;
        break;
      case "default":
      default:
        classes += ` hover:scale-105 transform bg-${button.background_color} text-${button.text_color}`;
    }

    return classes;
  };

  return (
    <Link
      {...storyblokEditable(button as any)}
      className={clsx(getClasses(), className)}
      {...props}
      href={getUrl()}
    >
      {button.label}
    </Link>
  );
}
