"use client";
import { storyblokEditable } from "@storyblok/react";
import type { BannerReference } from "@/lib/types";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import Banner from "./Banner";
import { ISbStoryData } from "@storyblok/js";

// Import Swiper styles
import "swiper/css";
import "swiper/css/navigation";

export default function BannerReferenceComponent({
  blok,
}: {
  blok: BannerReference;
}) {
  return (
    <div {...storyblokEditable(blok)}>
      <Swiper
        slidesPerView={1}
        spaceBetween={50}
        navigation={true}
        autoHeight={true}
        modules={[Navigation]}
        className="swiper"
        style={
          {
            "--swiper-theme-color": "var(--medium)",
          } as React.CSSProperties
        }
      >
        {blok.banners?.map((banner) => {
          // Handle both string and ISbStoryData types
          if (typeof banner === "string") {
            return null; // Skip string references
          }

          return (
            <SwiperSlide key={banner.uuid}>
              {banner.content && <Banner blok={banner.content} />}
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}
