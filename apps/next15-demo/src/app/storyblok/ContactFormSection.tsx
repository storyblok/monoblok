"use client";
import { useState } from "react";
import { storyblokEditable, StoryblokRichText } from "@storyblok/react";
import type { ContactFormSection } from "@/lib/types";
import Headline from "../components/Headline";
import Button from "../components/Button";

interface ContactFormSectionComponentProps {
  blok: ContactFormSection;
  index?: number;
}

export default function ContactFormSectionComponent({
  blok,
  index,
}: ContactFormSectionComponentProps) {
  const [showMessage, setShowMessage] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowMessage(true);
    setTimeout(() => {
      setShowMessage(false);
    }, 4000);
  };

  // Generate optimized image URL
  const getOptimizedImage = (image: any, width: number) => {
    if (!image?.filename) return null;
    return `${image.filename}/m/${width}x0`;
  };

  const optimizedImage = getOptimizedImage(blok.image, 1200);

  return (
    <section
      {...storyblokEditable(blok)}
      className="page-section contact-form-section relative"
    >
      <div className="container relative z-10 grid items-center gap-12 lg:min-h-[600px] lg:grid-cols-2 lg:gap-32">
        <div className="relative">
          {blok.headline && <Headline headline={blok.headline} index={index} />}
          {blok.text && (
            <div className="prose prose-lg mb-6">
              <StoryblokRichText doc={blok.text} />
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <label htmlFor="name" className="mb-2 block font-semibold">
                  Full name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Your name"
                  className="focus-ring w-full rounded-lg border border-gray-300 px-6 py-4 text-primary-dark transition-all"
                  required
                />
              </div>
              <div>
                <label htmlFor="email" className="mb-2 block font-semibold">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="enjoy@storyblok.com"
                  className="focus-ring w-full rounded-lg border border-gray-300 px-6 py-4 text-primary-dark transition-all"
                  required
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="message" className="mb-2 block font-semibold">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  className="focus-ring h-40 w-full resize-none rounded-lg border border-gray-300 px-6 py-4 text-primary-dark transition-all"
                  placeholder="A joyful message"
                  required
                ></textarea>
              </div>
              <div className="col-span-2">
                <label className="mb-2 block font-semibold">
                  How can we help you?
                </label>
                <div className="flex flex-wrap gap-4">
                  {[
                    "Brand",
                    "Strategy",
                    "Website",
                    "Marketing",
                    "Design",
                    "Development",
                    "Partnership",
                  ].map((option, i) => (
                    <label key={i} className="cursor-pointer">
                      <input
                        type="checkbox"
                        name="options"
                        value={`option${i + 1}`}
                        className="peer hidden"
                      />
                      <div className="rounded-lg border border-gray-300 px-6 py-4 text-primary-dark transition hover:border-black peer-checked:border-black peer-checked:bg-black peer-checked:text-white">
                        {option}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {blok.button?.length && blok.button[0] && (
              <Button button={blok.button[0]} />
            )}
          </form>
          {showMessage && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-12 transition-opacity duration-500">
              Thank you! We'll be in touch.
            </div>
          )}
        </div>
        <div className="invisible hidden h-full items-end text-white lg:visible lg:flex">
          <div>
            {blok.quote && (
              <p className="text-xl font-semibold lg:text-2xl xl:text-3xl 2xl:text-4xl">
                {blok.quote}
              </p>
            )}
            {blok.name && (
              <p className="mt-6 text-xl font-semibold">{blok.name}</p>
            )}
            {blok.position && <p className="text-xl">{blok.position}</p>}
          </div>
        </div>
      </div>

      {/* Desktop background image */}
      <div className="pointer-events-none invisible absolute left-1/2 top-0 z-0 hidden h-full w-1/2 before:absolute before:left-0 before:top-0 before:size-full before:bg-black/40 before:content-[''] lg:visible lg:block">
        {optimizedImage && (
          <img
            className="size-full object-cover"
            src={optimizedImage}
            alt={(blok.image?.alt as string) || ""}
          />
        )}
      </div>

      {/* Mobile background image */}
      <div className="overflow-none relative mt-12 flex min-h-[600px] items-end py-12 lg:invisible lg:hidden">
        <div className="container relative z-10 text-white">
          {blok.quote && (
            <p className="text-xl font-semibold lg:text-2xl xl:text-3xl 2xl:text-4xl">
              {blok.quote}
            </p>
          )}
          {blok.name && (
            <p className="mt-6 text-xl font-semibold">{blok.name}</p>
          )}
          {blok.position && <p className="text-xl">{blok.position}</p>}
        </div>
        <div className="absolute left-0 top-0 z-0 size-full before:absolute before:left-0 before:top-0 before:size-full before:bg-black/40 before:content-['']">
          {optimizedImage && (
            <img
              className="size-full object-cover"
              src={optimizedImage}
              alt={(blok.image?.alt as string) || ""}
            />
          )}
        </div>
      </div>
    </section>
  );
}
