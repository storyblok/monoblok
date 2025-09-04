import { ISbStoryData, SbBlokKeyDataTypes } from "@storyblok/js";
import { useBloks } from "@storyblok/react";
import type * as StoryblokComponents from "@/lib/types";

import dynamic from "next/dynamic";

import FeaturedArticlesSection from "./storyblok/FeaturedArticlesSection";
import GridSection from "./storyblok/GridSection";
import HeroSection from "./storyblok/HeroSection";
import ImageTextSection from "./storyblok/ImageTextSection";
import TabbedContentSection from "./storyblok/TabbedContentSection";
import DefaultPage from "./storyblok/DefaultPage";
import TextSection from "./storyblok/TextSection";
import Banner from "./storyblok/Banner";
import BannerReference from "./storyblok/BannerReference";
import LatestArticlesSection from "./storyblok/LatestArticlesSection";
import FaqSection from "./storyblok/FaqSection";
import LogoSection from "./storyblok/LogoSection";
import NewsletterFormSection from "./storyblok/NewsletterFormSection";
import PersonalizedSection from "./storyblok/PersonalizedSection";
import ProductsSection from "./storyblok/ProductsSection";
import TestimonialsSection from "./storyblok/TestimonialsSection";
import ArticleOverviewPage from "./storyblok/ArticleOverviewPage";
import ArticlePage from "./storyblok/ArticlePage";
import Category from "./storyblok/Category";
import ContactFormSection from "./storyblok/ContactFormSection";
import PriceCard from "./storyblok/PriceCard";
import GridCard from "./storyblok/GridCard";
import ImageCard from "./storyblok/ImageCard";
import RichtextYoutube from "./storyblok/RichtextYoutube";
import TabbedContentEntry from "./storyblok/TabbedContentEntry";

const HeadlineSegment = dynamic(() => import("./storyblok/HeadlineSegment"));
const NavItem = dynamic(() => import("./storyblok/NavItem"));

const FallbackComponent = ({ blok }: { blok: Component }) => {
  return (
    <div className="p-4 border-2 border-dashed border-red-300 bg-red-50 rounded-lg">
      <p className="text-red-600 font-semibold">
        Component "{JSON.stringify(blok.component)}" not found!
      </p>
      <pre className="text-xs mt-2 overflow-auto">
        {JSON.stringify(blok, null, 2)}
      </pre>
    </div>
  );
};

type Component =
  | NonNullable<StoryblokComponents.DefaultPage["body"]>[number]
  | StoryblokComponents.DefaultPage
  | StoryblokComponents.HeadlineSegment
  | StoryblokComponents.Button
  | StoryblokComponents.NavItem
  | StoryblokComponents.ArticlePage
  | StoryblokComponents.ArticleOverviewPage
  | StoryblokComponents.Category
  | StoryblokComponents.NewsletterFormSection
  | StoryblokComponents.ContactFormSection
  | StoryblokComponents.PriceCard
  | StoryblokComponents.GridCard
  | StoryblokComponents.ImageCard
  | StoryblokComponents.RichtextYoutube
  | StoryblokComponents.TabbedContentEntry;

export const StoryblokComponent = ({
  blok,
  story,
  ...props
}: {
  blok: Component;
  story?: ISbStoryData;
  [prop: string]: unknown | undefined;
}) => {
  const { Blok, Bloks } = useBloks<Component>();

  return (
    <Bloks {...props} blok={blok} story={story} fallback={FallbackComponent}>
      <Blok
        component="featured-articles-section"
        element={FeaturedArticlesSection}
      />
      <Blok component="grid-section" element={GridSection} />
      <Blok component="hero-section" element={HeroSection} />
      <Blok component="image-text-section" element={ImageTextSection} />
      <Blok component="tabbed-content-section" element={TabbedContentSection} />
      <Blok component="text-section" element={TextSection} />
      <Blok component="banner" element={Banner} />
      <Blok component="banner-reference" element={BannerReference} />
      <Blok
        component="latest-articles-section"
        element={LatestArticlesSection}
      />
      <Blok component="faq-section" element={FaqSection} />
      <Blok component="logo-section" element={LogoSection} />
      <Blok
        component="newsletter-form-section"
        element={NewsletterFormSection}
      />
      <Blok component="personalized-section" element={PersonalizedSection} />
      <Blok component="products-section" element={ProductsSection} />
      <Blok component="testimonials-section" element={TestimonialsSection} />
      <Blok component="article-overview-page" element={ArticleOverviewPage} />
      <Blok component="article-page" element={ArticlePage} />
      <Blok component="category" element={Category} />
      <Blok component="contact-form-section" element={ContactFormSection} />
      <Blok component="price-card" element={PriceCard} />
      <Blok component="grid-card" element={GridCard} />
      <Blok component="image-card" element={ImageCard} />
      <Blok component="richtext-youtube" element={RichtextYoutube} />
      <Blok component="tabbed-content-entry" element={TabbedContentEntry} />
      <Blok component="headline-segment" element={HeadlineSegment} />
      <Blok component="default-page" element={DefaultPage} />
      <Blok component="nav-item" element={NavItem} />
    </Bloks>
  );
};

export const Storybloks = ({
  bloks,
  story,
}: {
  bloks: Component[] | undefined;
  story?: ISbStoryData;
}) => {
  if (!bloks) return null;
  return bloks.map((blok: Component) => (
    <StoryblokComponent blok={blok} story={story} key={blok._uid} />
  ));
};

export const Story = ({ story }: { story: ISbStoryData }) => {
  return <Storybloks bloks={story.content as Component[]} story={story} />;
};
