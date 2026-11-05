import { getManagementBaseUrl } from "@storyblok/region-helper";

import type { RegionCode } from "../constants";

const API_VERSION = "v1";

export const getStoryblokUrl = (region: RegionCode = "eu") => {
  return `${getManagementBaseUrl(region)}/${API_VERSION}`;
};
