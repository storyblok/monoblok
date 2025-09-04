import { storyblokEditable, StoryblokRichText } from "@storyblok/react";
import type { PriceCard } from "@/lib/types";
import Button from "../components/Button";

export default function PriceCardComponent({ blok }: { blok: PriceCard }) {
  return (
    <div
      {...storyblokEditable(blok as any)}
      className={`price-blok relative flex w-full max-w-md flex-col rounded-lg border bg-white p-6 text-primary-dark lg:max-w-none ${
        blok.most_popular ? "border-2 border-primary-dark" : "border-medium"
      }`}
    >
      {blok.most_popular && (
        <div className="absolute right-0 top-0 inline-block -translate-x-4 translate-y-4 rounded-lg bg-[#FFE6AA] px-3 py-1 text-sm text-[#913F0F]">
          Most popular
        </div>
      )}
      {blok.headline && (
        <h3 className="mb-4 font-display text-3xl font-black">
          {blok.headline}
        </h3>
      )}
      {blok.text_1 && (
        <div className="prose">
          <StoryblokRichText doc={blok.text_1} />
        </div>
      )}
      {blok.price && (
        <span className="mt-4 text-4xl font-black">
          ${blok.price}
          <span className="text-2xl font-medium">/month</span>
        </span>
      )}
      {blok.button && blok.button.length > 0 && (
        <div className="my-6">
          {blok.button.map((button) => (
            <Button key={button._uid} button={button} />
          ))}
        </div>
      )}
      {blok.text_2 && (
        <div className="prose">
          <StoryblokRichText doc={blok.text_2} />
        </div>
      )}
    </div>
  );
}
