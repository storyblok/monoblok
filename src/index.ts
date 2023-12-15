export type Region = "eu" | "us" | "cn" | "ap" | "ca";

export const EU_API_URL = "api.storyblok.com";
export const US_API_URL = "api-us.storyblok.com";
export const CN_API_URL = "app.storyblokchina.cn";
export const AP_API_URL = "api-ap.storyblok.com";
export const CA_API_URL = "api-ca.storyblok.com";

export function getRegion(spaceId: number) {
  if (spaceId >= 1_000_000 && spaceId < 2_000_000) {
    return "us";
  } else if (spaceId >= 2_000_000 && spaceId < 3_000_000) {
    return "ca";
  } else if (spaceId >= 3_000_000 && spaceId < 4_000_000) {
    return "ap";
  } else {
    return "eu";
  }
}

export function getRegionUrl(region: Region) {
  switch (region) {
    case "us": {
      return US_API_URL;
    }
    case "cn": {
      return CN_API_URL;
    }
    case "ap": {
      return AP_API_URL;
    }
    case "ca": {
      return CA_API_URL;
    }
    default: {
      return EU_API_URL;
    }
  }
}
