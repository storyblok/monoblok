"use client";
import { useStory } from "@/lib/useStory";
import type { SiteConfig } from "../../../.storyblok/types/286726323865714/storyblok-components";
import { storyblokEditable } from "@storyblok/js";
import { StoryblokRichText } from "@storyblok/react";
import Headline from "./Headline";
import FooterNav from "./FooterNav";
import SocialIcons from "./SocialIcons";
import Decoration3 from "./Decoration3";

interface SocialLink {
  url?: string;
  linktype?: string;
}

interface FooterProps {
  headline?: any[];
  footerLight?: boolean;
  decoration?: boolean;
  logo?: any;
  nav1Headline?: string;
  nav1?: any[];
  nav2Headline?: string;
  nav2?: any[];
  nav3Headline?: string;
  nav3?: any[];
  about?: any;
  x?: SocialLink;
  instagram?: SocialLink;
  youtube?: SocialLink;
  facebook?: SocialLink;
}

export default function Footer(props: FooterProps) {
  const { story } = useStory<SiteConfig>("site-config");
  const { content } = story;

  // Use props if provided, otherwise fall back to site config
  const {
    headline = props.headline || content.footer_headline,
    footerLight = props.footerLight || content.footer_light,
    decoration = props.decoration !== undefined
      ? props.decoration
      : content.footer_decoration,
    nav1Headline = props.nav1Headline || content.footer_nav_1_headline,
    nav1 = props.nav1 || content.footer_nav_1,
    nav2Headline = props.nav2Headline || content.footer_nav_2_headline,
    nav2 = props.nav2 || content.footer_nav_2,
    nav3Headline = props.nav3Headline || content.footer_nav_3_headline,
    nav3 = props.nav3 || content.footer_nav_3,
    about = props.about || content.footer_about,
    x = (props.x || content.footer_x) as SocialLink | undefined,
    instagram = (props.instagram || content.footer_instagram) as
      | SocialLink
      | undefined,
    youtube = (props.youtube || content.footer_youtube) as
      | SocialLink
      | undefined,
    facebook = (props.facebook || content.footer_facebook) as
      | SocialLink
      | undefined,
  } = props;

  const textColor = footerLight ? "text-primary-dark" : "text-white";
  const backgroundColor = footerLight
    ? "bg-primary-background"
    : "bg-primary-dark";

  return (
    <footer className={`relative w-full ${backgroundColor}`}>
      <div className="container grid gap-12 pt-16 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <div className="flex flex-col items-start sm:col-span-2 md:col-span-3 lg:col-span-2">
          {headline && (
            <Headline headline={headline} size="small" color={textColor} />
          )}
        </div>
      </div>

      <div className="container grid gap-12 pb-16 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <div className="flex flex-col items-start sm:col-span-2 md:col-span-3 lg:col-span-2">
          <div>
            {about && (
              <div
                className={`prose prose-lg mb-8 text-sm lg:text-base ${textColor}`}
              >
                <StoryblokRichText doc={about} />
              </div>
            )}
            <SocialIcons
              x={x}
              instagram={instagram}
              youtube={youtube}
              facebook={facebook}
              textColor={textColor}
            />
          </div>
        </div>

        {nav1 && nav1.length > 0 && nav1Headline && (
          <FooterNav nav={nav1} headline={nav1Headline} textColor={textColor} />
        )}
        {nav2 && nav2.length > 0 && nav2Headline && (
          <FooterNav nav={nav2} headline={nav2Headline} textColor={textColor} />
        )}
        {nav3 && nav3.length > 0 && nav3Headline && (
          <FooterNav nav={nav3} headline={nav3Headline} textColor={textColor} />
        )}
      </div>

      {decoration && (
        <div className="container relative z-10">
          <div className="h-px w-full bg-gray-500"></div>
          <img
            src="/images/made-with-love.svg"
            width="120"
            className="pointer-events-none mx-auto block py-9"
            alt="Made with love by the Storyblok team!"
          />
        </div>
      )}

      {decoration && (
        <Decoration3
          fill="highlight-1"
          className="pointer-events-none absolute bottom-0 right-0 z-0"
        />
      )}
    </footer>
  );
}
