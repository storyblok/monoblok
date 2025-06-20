export const versions = ['draft', 'published'] as const;
export type ContentVersion = typeof versions[number];

export const contentVersions: Record<Uppercase<ContentVersion>, ContentVersion> = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;

