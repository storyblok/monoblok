/**
 * Normalizes an S3 asset URL to a Storyblok CDN URL.
 *
 * The MAPI returns asset filenames pointing to the raw S3 origin
 * (e.g. `https://s3.amazonaws.com/a.storyblok.com/f/...`) instead of the
 * CloudFront CDN (e.g. `https://a.storyblok.com/f/...`). The S3 URL does not
 * support the Storyblok Image Service (`/m/...`), which breaks image
 * optimization in frontends.
 *
 * Works for all regions because the regional CDN domain
 * (`a.storyblok.com`, `a-us.storyblok.com`, `a-ap.storyblok.com`,
 * `a-ca.storyblok.com`, `a.storyblokchina.cn`) is embedded as the S3 bucket
 * name in the path.
 */
export const normalizeAssetUrl = (url: string): string =>
  url.replace(/^https?:\/\/s3\.amazonaws\.com\//, 'https://');
