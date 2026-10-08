import { AP_CODE, CA_CODE, CN_CODE, EU_CODE, type Region, US_CODE } from "@storyblok/region-helper";

// Please do not change the casing of the commands, it's used for the CLI commands definition
export const commands = {
  LOGIN: "login",
  LOGOUT: "logout",
  SIGNUP: "signup",
  USER: "user",
  COMPONENTS: "components",
  LANGUAGES: "languages",
  MIGRATIONS: "migrations",
  TYPES: "types",
  DATASOURCES: "datasources",
  CREATE: "create",
  LOGS: "logs",
  REPORTS: "reports",
  ASSETS: "assets",
  STORIES: "stories",
  SCHEMA: "schema",
} as const;

export const colorPalette = {
  PRIMARY: "#8d60ff",
  LOGIN: "#dad4ff",
  LOGOUT: "#6d6d6d",
  SIGNUP: "#b6ff6d",
  USER: "#71d300",
  COMPONENTS: "#a185ff",
  LANGUAGES: "#f5c003",
  MIGRATIONS: "#8CE2FF",
  TYPES: "#3178C6",
  CREATE: "#ffb3ba",
  GROUPS: "#4ade80",
  TAGS: "#fbbf24",
  PRESETS: "#a855f7",
  DATASOURCES: "#4ade80",
  LOGS: "#4ade80",
  REPORTS: "#4ade80",
  ASSETS: "#f97316",
  STORIES: "#a185ff",
  SCHEMA: "#e91e63",
} as const;

export type RegionCode = Region;

/** Region codes keyed by their uppercase name, in the order the CLI lists them. */
export const regions = {
  EU: EU_CODE,
  US: US_CODE,
  CN: CN_CODE,
  CA: CA_CODE,
  AP: AP_CODE,
} as const satisfies Record<Uppercase<RegionCode>, RegionCode>;

export const appDomains: Record<RegionCode, string> = {
  eu: "app.storyblok.com",
  us: "app.storyblok.com",
  cn: "app.storyblokchina.cn/fe/editor_v2",
  ca: "app.storyblok.com",
  ap: "app.storyblok.com",
} as const;

export const DEFAULT_AGENT = {
  SB_Agent: "SB-CLI",
  SB_Agent_Version: process.env.npm_package_version || "4.x",
} as const;

export interface SpaceOptions {
  spaceId: string;
}

/**
 * Supported asset file extensions based on Storyblok's accepted MIME types.
 * @see https://www.storyblok.com/docs/concepts/assets
 * @see https://www.storyblok.com/faq/are-there-asset-type-upload-limitations
 */
export const SUPPORTED_ASSET_EXTENSIONS = new Set([
  // Images: image/png, image/x-png, image/gif, image/jpeg, image/avif, image/svg+xml, image/webp
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  // Video: video/*, application/mp4, application/x-mpegurl, application/vnd.apple.mpegurl
  ".mp4",
  ".mov",
  ".avi",
  ".webm",
  ".wmv",
  ".mkv",
  ".flv",
  ".ogv",
  ".3gp",
  ".m4v",
  ".mpg",
  ".mpeg",
  ".m3u8",
  // Audio: audio/*
  ".mp3",
  ".wav",
  ".ogg",
  ".aac",
  ".flac",
  ".wma",
  ".m4a",
  ".opus",
  // Documents: application/msword, text/plain, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/vtt
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".vtt",
]);

export const directories = {
  assets: "assets",
  components: "components",
  datasources: "datasources",
  logs: "logs",
  reports: "reports",
  stories: "stories",
} as const;
