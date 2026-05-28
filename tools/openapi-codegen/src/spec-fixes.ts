import type { SpecSource } from './aliases.ts';

export function applyFullSdkSpecFixes(spec: SpecSource, source: string): string {
  if (spec !== 'capi') {
    return source;
  }

  return [
    addCdnSnapshotQueryType,
    addDatasourceShowQuery,
    addSpaceShowQuery,
    relaxStoryShowRelations,
    addStoryListFallbackRelations,
  ].reduce((current, fix) => fix(current), source);
}

function addCdnSnapshotQueryType(source: string): string {
  return replaceOnce(
    source,
    `export type ClientOptions = {
    baseUrl: 'https://api.storyblok.com' | 'https://api-us.storyblok.com' | 'https://api-ca.storyblok.com' | 'https://api-au.storyblok.com' | 'https://app.storyblokchina.cn' | (string & {});
};`,
    `export type ClientOptions = {
    baseUrl: 'https://api.storyblok.com' | 'https://api-us.storyblok.com' | 'https://api-ca.storyblok.com' | 'https://api-au.storyblok.com' | 'https://app.storyblokchina.cn' | (string & {});
};

export type CdnSnapshotQuery = {
    cv?: number;
    version?: 'draft' | 'published';
};`,
    'shared CDN snapshot query',
  );
}

function addDatasourceShowQuery(source: string): string {
  return replaceOnce(
    source,
    `    query?: never;
    url: '/v2/cdn/datasources/{id}';`,
    `    query?: CdnSnapshotQuery;
    url: '/v2/cdn/datasources/{id}';`,
    'getDatasourceById query',
  );
}

function addSpaceShowQuery(source: string): string {
  return replaceOnce(
    source,
    `    path?: never;
    query?: never;
    url: '/v2/cdn/spaces/me';`,
    `    path?: never;
    query?: CdnSnapshotQuery;
    url: '/v2/cdn/spaces/me';`,
    'getSpace query',
  );
}

function relaxStoryShowRelations(source: string): string {
  return replaceOnce(
    source,
    `        rels: Array<Story>;
        links: Array<LinkWithFullSlug | Link | Story>;`,
    `        rels?: Array<Story>;
        links?: Array<LinkWithFullSlug | Link | Story>;`,
    'getStoryById relation fallbacks',
  );
}

function addStoryListFallbackRelations(source: string): string {
  return replaceOnce(
    source,
    `        rels: Array<Story>;
        links: Array<LinkWithFullSlug | Link>;`,
    `        rels?: Array<Story>;
        links?: Array<LinkWithFullSlug | Link | Story>;
        /**
         * Array of story UUIDs when relation resolution limit is exceeded
         */
        rel_uuids?: Array<string>;
        /**
         * An array of all UUIDs of linked stories
         */
        link_uuids?: Array<string>;`,
    'listStories relation fallbacks',
  );
}

function replaceOnce(source: string, search: string, replacement: string, label: string): string {
  if (source.includes(search)) {
    return source.replace(search, replacement);
  }

  if (source.includes(replacement)) {
    return source;
  }

  throw new Error(`Cannot apply OpenAPI spec fix for ${label}. Generated shape changed.`);
}
