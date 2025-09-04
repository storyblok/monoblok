"use client";
import { storyblokEditable } from "@storyblok/react";
import type { NewsletterFormSection } from "@/lib/types";
import { useState } from "react";
import Headline from "../components/Headline";
import Button from "../components/Button";
import Decoration3 from "../components/Decoration3";

interface NewsletterFormSectionComponentProps {
  blok: NewsletterFormSection;
  index?: number;
}

export default function NewsletterFormSectionComponent({
  blok,
  index,
}: NewsletterFormSectionComponentProps) {
  const [showMessage, setShowMessage] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowMessage(true);
    setTimeout(() => {
      setShowMessage(false);
    }, 4000);
  };

  return (
    <section
      {...storyblokEditable(blok)}
      className="page-section newsletter-form-section bg-white"
    >
      <div className="container">
        <div className="relative overflow-hidden rounded-xl bg-primary-dark p-8 md:p-12 xl:p-24">
          <div className="relative z-10 flex flex-col items-center space-y-6 text-center lg:space-y-12">
            {blok.headline && (
              <Headline
                headline={blok.headline}
                index={index}
                color="text-white"
                size="small"
              />
            )}
            <div className="relative mx-auto flex flex-col items-center gap-8 md:flex-row">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4 md:flex-row"
              >
                <label htmlFor="email" className="sr-only">
                  Your email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="enjoy@storyblok.com"
                  className="focus-ring rounded-lg bg-white px-6 py-4 text-primary-dark transition-all"
                  required
                />
                {blok.button?.length && blok.button[0] && (
                  <Button
                    button={blok.button[0]}
                    className="focus-ring"
                    onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                      e.preventDefault();
                      handleSubmit(e);
                    }}
                  />
                )}
              </form>
              {showMessage && (
                <div className="absolute left-1/2 top-0 block w-full -translate-x-1/2 -translate-y-12 text-white transition-opacity duration-500">
                  Thank you! We'll be in touch.
                </div>
              )}
            </div>
          </div>
          <Decoration3
            fill="highlight-1"
            className="absolute bottom-0 right-0 z-0"
          />
        </div>
      </div>
    </section>
  );
}
