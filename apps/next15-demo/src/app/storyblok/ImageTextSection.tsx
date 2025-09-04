import { storyblokEditable, StoryblokRichText } from "@storyblok/react";
import type { ImageTextSection } from "@/lib/types";
import Button from "../components/Button";
import DecorationImageTopLeft from "../components/DecorationImageTopLeft";

interface ImageTextSectionProps {
  blok: ImageTextSection;
  index?: number;
}

const ImageTextSectionComponent = ({ blok, index }: ImageTextSectionProps) => {
  // Generate optimized image URLs
  const getOptimizedImage = (
    image: any,
    width: number,
    height: number = 0,
    filter: string = ""
  ) => {
    if (!image?.filename) return null;
    const dimensions = height > 0 ? `${width}x${height}` : `${width}x0`;
    return `${image.filename}/m/${dimensions}${filter ? `/filters${filter}` : ""}`;
  };

  const optimizedImages = {
    mobile: getOptimizedImage(
      blok.image,
      600,
      blok.preserve_image_aspect_ratio ? 0 : 300
    ),
    tablet: getOptimizedImage(
      blok.image,
      1000,
      blok.preserve_image_aspect_ratio ? 0 : 500
    ),
    desktop: getOptimizedImage(
      blok.image,
      1000,
      blok.preserve_image_aspect_ratio ? 0 : 1250
    ),
  };

  const blurredImage = getOptimizedImage(
    blok.image,
    1000,
    0,
    ":blur(60):brightness(20)"
  );

  // Background image - using original image for now since filters might not work
  const backgroundImage = blok.image?.filename || "";

  return (
    <section
      {...storyblokEditable(blok as any)}
      className={`page-section image-text-section bg-${blok.background_color || "white"}`}
    >
      <div className="container grid items-center gap-6 sm:gap-10 md:gap-12 lg:grid-cols-2">
        <div>
          {blok.image?.filename && (
            <div
              className="relative rounded-xl bg-cover bg-center bg-no-repeat p-8 md:p-16"
              style={{
                backgroundImage: `url('${blurredImage}')`,
                backgroundSize: "cover",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
              }}
            >
              {/* Decoration Image */}
              <DecorationImageTopLeft className="absolute left-0 top-0 origin-top-left -translate-x-5 -translate-y-6 scale-50 md:translate-x-6 md:translate-y-5 md:scale-100" />
              {/* Mobile image */}
              <img
                src={optimizedImages.mobile || blok.image.filename}
                alt={(blok.image.alt as string) || ""}
                className="rounded-lg md:invisible md:hidden"
              />
              {/* Tablet image */}
              <img
                src={optimizedImages.tablet || blok.image.filename}
                alt={(blok.image.alt as string) || ""}
                className="invisible hidden rounded-lg md:visible md:block lg:invisible lg:hidden"
              />
              {/* Desktop image */}
              <img
                src={optimizedImages.desktop || blok.image.filename}
                alt={(blok.image.alt as string) || ""}
                className="invisible hidden rounded-lg lg:visible lg:block"
              />
            </div>
          )}
        </div>
        <div
          className={`text-left ${
            blok.reverse_mobile_layout ? "order-first" : ""
          } ${
            blok.reverse_desktop_layout ? "lg:order-last" : "lg:order-first"
          }`}
        >
          {blok.eyebrow && (
            <h3 className="mb-3 text-lg font-black">{blok.eyebrow}</h3>
          )}
          {blok.headline && (
            <>
              {index === 0 ? (
                <h1 className="font-display font-black mb-3 md:mb-6 text-3xl sm:text-3xl lg:text-4xl text-[--headline-color]">
                  {blok.headline.map((segment, segmentIndex) => (
                    <span
                      key={segmentIndex}
                      className={
                        segment.highlight && segment.highlight !== "none"
                          ? `text-${segment.highlight}`
                          : ""
                      }
                    >
                      {segment.text}
                    </span>
                  ))}
                </h1>
              ) : (
                <h2 className="font-display font-black mb-3 md:mb-6 text-3xl sm:text-3xl lg:text-4xl text-[--headline-color]">
                  {blok.headline.map((segment, segmentIndex) => (
                    <span
                      key={segmentIndex}
                      className={
                        segment.highlight && segment.highlight !== "none"
                          ? `text-${segment.highlight}`
                          : ""
                      }
                    >
                      {segment.text}
                    </span>
                  ))}
                </h2>
              )}
            </>
          )}
          {blok.text && (
            <div className="prose prose-lg mb-6">
              <StoryblokRichText doc={blok.text} />
            </div>
          )}
          {blok.buttons && blok.buttons.length > 0 && (
            <div className="flex flex-col items-start justify-start gap-4 sm:flex-row">
              {blok.buttons.map((button) => (
                <Button key={button._uid} button={button} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ImageTextSectionComponent;
