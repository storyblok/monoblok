import { describe, expect, it } from 'vitest';
import {
  createComponentFile,
  createContentTypesFile,
  createDatasourcesFile,
  detectReferencedComponents,
  detectUsedDatasourceTypes,
  detectUsedStoryblokTypes,
  generateComponentImports,
  generateStoryblokImports,
} from './utils';

const STORY_TYPE = 'ISbStoryData';

describe('generateStoryblokImports', () => {
  it('should generate import for ISbStoryData', () => {
    const storyblokPropertyTypes = new Set(['ISbStoryData', 'asset', 'richtext']);
    const imports = generateStoryblokImports(storyblokPropertyTypes, STORY_TYPE);

    expect(imports).toContain('import type { ISbStoryData } from \'@storyblok/js\';');
    expect(imports.some(i => i.includes('StoryblokAsset'))).toBe(true);
    expect(imports.some(i => i.includes('StoryblokRichtext'))).toBe(true);
  });

  it('should generate imports for Storyblok property types', () => {
    const storyblokPropertyTypes = new Set(['asset', 'richtext', 'multilink']);
    const imports = generateStoryblokImports(storyblokPropertyTypes, STORY_TYPE);

    const storyblokImport = imports.find(i => i.includes('StoryblokAsset'));
    expect(storyblokImport).toBeDefined();
    expect(storyblokImport).toContain('StoryblokAsset');
    expect(storyblokImport).toContain('StoryblokRichtext');
    expect(storyblokImport).toContain('StoryblokMultilink');
    expect(storyblokImport).toContain('from \'../storyblok.d.ts\'');
  });

  it('should handle empty set', () => {
    const storyblokPropertyTypes = new Set<string>([]);
    const imports = generateStoryblokImports(storyblokPropertyTypes, STORY_TYPE);

    expect(imports).toEqual([]);
  });

  it('should remove ISbStoryData from the set after processing', () => {
    const storyblokPropertyTypes = new Set(['ISbStoryData', 'asset']);
    generateStoryblokImports(storyblokPropertyTypes, STORY_TYPE);

    // ISbStoryData should be removed from the set
    expect(storyblokPropertyTypes.has('ISbStoryData')).toBe(false);
    expect(storyblokPropertyTypes.has('asset')).toBe(true);
  });

  it('should convert property types to PascalCase', () => {
    const storyblokPropertyTypes = new Set(['multi_asset', 'rich_text']);
    const imports = generateStoryblokImports(storyblokPropertyTypes, STORY_TYPE);

    const storyblokImport = imports.find(i => i.includes('Storyblok'));
    expect(storyblokImport).toContain('StoryblokMultiAsset');
    expect(storyblokImport).toContain('StoryblokRichText');
  });
});

describe('detectUsedStoryblokTypes', () => {
  it('should detect ISbStoryData usage', () => {
    const content = 'export interface Page { story: ISbStoryData; }';
    const storyblokPropertyTypes = new Set(['asset', 'richtext']);

    const usedTypes = detectUsedStoryblokTypes(content, storyblokPropertyTypes, STORY_TYPE);

    expect(usedTypes).toContain('ISbStoryData');
  });

  it('should detect Storyblok property types', () => {
    const content = 'export interface Page { image: StoryblokAsset; text: StoryblokRichtext; }';
    const storyblokPropertyTypes = new Set(['asset', 'richtext', 'multilink']);

    const usedTypes = detectUsedStoryblokTypes(content, storyblokPropertyTypes, STORY_TYPE);

    expect(usedTypes).toContain('asset');
    expect(usedTypes).toContain('richtext');
    expect(usedTypes).not.toContain('multilink');
  });

  it('should handle content with no Storyblok types', () => {
    const content = 'export interface Page { title: string; }';
    const storyblokPropertyTypes = new Set(['asset', 'richtext']);

    const usedTypes = detectUsedStoryblokTypes(content, storyblokPropertyTypes, STORY_TYPE);

    expect(usedTypes).toEqual([]);
  });

  it('should detect multiple occurrences of the same type', () => {
    const content = 'export interface Page { image1: StoryblokAsset; image2: StoryblokAsset; }';
    const storyblokPropertyTypes = new Set(['asset']);

    const usedTypes = detectUsedStoryblokTypes(content, storyblokPropertyTypes, STORY_TYPE);

    expect(usedTypes).toContain('asset');
    expect(usedTypes.length).toBe(1); // Should only include 'asset' once
  });
});

describe('detectUsedDatasourceTypes', () => {
  it('should detect datasource type usage', () => {
    const content = 'export interface Page { country: CountriesDataSource; }';
    const datasourceResults = [
      { title: 'CountriesDataSource', content: '', isComponent: false, isDatasource: true },
      { title: 'CategoriesDataSource', content: '', isComponent: false, isDatasource: true },
    ];

    const usedTypes = detectUsedDatasourceTypes(content, datasourceResults);

    expect(usedTypes).toContain('CountriesDataSource');
    expect(usedTypes).not.toContain('CategoriesDataSource');
  });

  it('should detect multiple datasource types', () => {
    const content = 'export interface Page { country: CountriesDataSource; category: CategoriesDataSource; }';
    const datasourceResults = [
      { title: 'CountriesDataSource', content: '', isComponent: false, isDatasource: true },
      { title: 'CategoriesDataSource', content: '', isComponent: false, isDatasource: true },
    ];

    const usedTypes = detectUsedDatasourceTypes(content, datasourceResults);

    expect(usedTypes).toContain('CountriesDataSource');
    expect(usedTypes).toContain('CategoriesDataSource');
  });

  it('should return empty array when no datasources are used', () => {
    const content = 'export interface Page { title: string; }';
    const datasourceResults = [
      { title: 'CountriesDataSource', content: '', isComponent: false, isDatasource: true },
    ];

    const usedTypes = detectUsedDatasourceTypes(content, datasourceResults);

    expect(usedTypes).toEqual([]);
  });
});

describe('detectReferencedComponents', () => {
  it('should detect referenced component types', () => {
    const content = 'export interface Page { hero: Hero; footer: Footer; }';
    const currentTitle = 'Page';
    const componentResults = [
      { title: 'Page', content: '', isComponent: true, isDatasource: false },
      { title: 'Hero', content: '', isComponent: true, isDatasource: false },
      { title: 'Footer', content: '', isComponent: true, isDatasource: false },
    ];

    const referencedComponents = detectReferencedComponents(content, currentTitle, componentResults);

    expect(referencedComponents).toContain('Hero');
    expect(referencedComponents).toContain('Footer');
    expect(referencedComponents).not.toContain('Page'); // Should exclude self-reference
  });

  it('should exclude self-reference', () => {
    const content = 'export interface Page { title: string; nested?: Page; }';
    const currentTitle = 'Page';
    const componentResults = [
      { title: 'Page', content: '', isComponent: true, isDatasource: false },
    ];

    const referencedComponents = detectReferencedComponents(content, currentTitle, componentResults);

    expect(referencedComponents).not.toContain('Page');
  });

  it('should return empty array when no components are referenced', () => {
    const content = 'export interface Page { title: string; }';
    const currentTitle = 'Page';
    const componentResults = [
      { title: 'Page', content: '', isComponent: true, isDatasource: false },
      { title: 'Hero', content: '', isComponent: true, isDatasource: false },
    ];

    const referencedComponents = detectReferencedComponents(content, currentTitle, componentResults);

    expect(referencedComponents).toEqual([]);
  });
});

describe('generateComponentImports', () => {
  it('should generate all necessary imports for a component', () => {
    const componentContent = `
      export interface Page {
        story: ISbStoryData;
        image: StoryblokAsset;
        country: CountriesDataSource;
        hero: Hero;
      }
    `;
    const componentTitle = 'Page';
    const storyblokPropertyTypes = new Set(['asset', 'richtext']);
    const datasourceResults = [
      { title: 'CountriesDataSource', content: '', isComponent: false, isDatasource: true },
    ];
    const componentResults = [
      { title: 'Page', content: '', isComponent: true, isDatasource: false },
      { title: 'Hero', content: '', isComponent: true, isDatasource: false },
    ];

    const imports = generateComponentImports(
      componentContent,
      componentTitle,
      storyblokPropertyTypes,
      datasourceResults,
      componentResults,
      STORY_TYPE,
    );

    // Should have ISbStoryData import
    expect(imports.some(i => i.includes('import type { ISbStoryData } from \'@storyblok/js\';'))).toBe(true);

    // Should have Storyblok types import
    expect(imports.some(i => i.includes('StoryblokAsset') && i.includes('from \'../storyblok.d.ts\''))).toBe(true);

    // Should have datasource import
    expect(imports.some(i => i.includes('CountriesDataSource') && i.includes('from \'./datasources.d.ts\''))).toBe(true);

    // Should have component import
    expect(imports.some(i => i.includes('import type { Hero } from \'./Hero.d.ts\''))).toBe(true);
  });

  it('should only generate imports for types actually used', () => {
    const componentContent = 'export interface Page { title: string; }';
    const componentTitle = 'Page';
    const storyblokPropertyTypes = new Set(['asset', 'richtext']);
    const datasourceResults = [
      { title: 'CountriesDataSource', content: '', isComponent: false, isDatasource: true },
    ];
    const componentResults = [
      { title: 'Page', content: '', isComponent: true, isDatasource: false },
      { title: 'Hero', content: '', isComponent: true, isDatasource: false },
    ];

    const imports = generateComponentImports(
      componentContent,
      componentTitle,
      storyblokPropertyTypes,
      datasourceResults,
      componentResults,
      STORY_TYPE,
    );

    expect(imports).toEqual([]);
  });

  it('should generate imports for multiple referenced components', () => {
    const componentContent = `
      export interface Page {
        hero: Hero;
        footer: Footer;
        sidebar: Sidebar;
      }
    `;
    const componentTitle = 'Page';
    const storyblokPropertyTypes = new Set<string>([]);
    const datasourceResults: any[] = [];
    const componentResults = [
      { title: 'Page', content: '', isComponent: true, isDatasource: false },
      { title: 'Hero', content: '', isComponent: true, isDatasource: false },
      { title: 'Footer', content: '', isComponent: true, isDatasource: false },
      { title: 'Sidebar', content: '', isComponent: true, isDatasource: false },
    ];

    const imports = generateComponentImports(
      componentContent,
      componentTitle,
      storyblokPropertyTypes,
      datasourceResults,
      componentResults,
      STORY_TYPE,
    );

    expect(imports.some(i => i.includes('import type { Hero } from \'./Hero.d.ts\''))).toBe(true);
    expect(imports.some(i => i.includes('import type { Footer } from \'./Footer.d.ts\''))).toBe(true);
    expect(imports.some(i => i.includes('import type { Sidebar } from \'./Sidebar.d.ts\''))).toBe(true);
  });
});

describe('createDatasourcesFile', () => {
  it('should create datasources file with content', () => {
    const datasourceResults = [
      { title: 'CountriesDataSource', content: 'export type CountriesDataSource = "usa" | "uk";', isComponent: false, isDatasource: true },
      { title: 'CategoriesDataSource', content: 'export type CategoriesDataSource = "tech" | "news";', isComponent: false, isDatasource: true },
    ];
    const typeDefs = ['// Header comment'];

    const file = createDatasourcesFile(datasourceResults, typeDefs);

    expect(file).not.toBeNull();
    expect(file?.name).toBe('datasources');
    expect(file?.content).toContain('// Header comment');
    expect(file?.content).toContain('export type CountriesDataSource = "usa" | "uk";');
    expect(file?.content).toContain('export type CategoriesDataSource = "tech" | "news";');
  });

  it('should return null when no datasources', () => {
    const datasourceResults: any[] = [];
    const typeDefs = ['// Header comment'];

    const file = createDatasourcesFile(datasourceResults, typeDefs);

    expect(file).toBeNull();
  });
});

describe('createContentTypesFile', () => {
  it('should create content-types file with imports and union', () => {
    const contentTypeBloks = new Set(['Page', 'Article']);
    const typeDefs = ['// Header comment'];

    const file = createContentTypesFile(contentTypeBloks, typeDefs);

    expect(file).not.toBeNull();
    expect(file?.name).toBe('content-types');
    expect(file?.content).toContain('// Header comment');
    expect(file?.content).toContain('import type { Page } from \'./Page.d.ts\';');
    expect(file?.content).toContain('import type { Article } from \'./Article.d.ts\';');
    expect(file?.content).toContain('export type ContentType =');
    expect(file?.content).toContain('Page');
    expect(file?.content).toContain('Article');
  });

  it('should return null when no content types', () => {
    const contentTypeBloks = new Set<string>([]);
    const typeDefs = ['// Header comment'];

    const file = createContentTypesFile(contentTypeBloks, typeDefs);

    expect(file).toBeNull();
  });

  it('should handle single content type', () => {
    const contentTypeBloks = new Set(['Page']);
    const typeDefs = ['// Header comment'];

    const file = createContentTypesFile(contentTypeBloks, typeDefs);
    expect(file?.content).toContain('export type ContentType =');
    expect(file?.content).toContain('Page');
  });
});

describe('createComponentFile', () => {
  it('should create component file with header and imports', () => {
    const componentResult = {
      title: 'Page',
      content: 'export interface Page { title: string; }',
      isComponent: true,
      isDatasource: false,
    };
    const typeDefs = ['// Header comment'];
    const componentImports = [
      'import type { ISbStoryData } from \'@storyblok/js\';',
      'import type { Hero } from \'./Hero.d.ts\';',
    ];

    const file = createComponentFile(componentResult, typeDefs, componentImports);

    expect(file.name).toBe('Page');
    expect(file.content).toContain('// Header comment');
    expect(file.content).toContain('import type { ISbStoryData } from \'@storyblok/js\';');
    expect(file.content).toContain('import type { Hero } from \'./Hero.d.ts\';');
    expect(file.content).toContain('export interface Page { title: string; }');
  });

  it('should create component file without imports', () => {
    const componentResult = {
      title: 'SimpleComponent',
      content: 'export interface SimpleComponent { text: string; }',
      isComponent: true,
      isDatasource: false,
    };
    const typeDefs = ['// Header comment'];
    const componentImports: string[] = [];

    const file = createComponentFile(componentResult, typeDefs, componentImports);

    expect(file.name).toBe('SimpleComponent');
    expect(file.content).toContain('// Header comment');
    expect(file.content).toContain('export interface SimpleComponent { text: string; }');
  });

  it('should preserve order: header, imports, then content', () => {
    const componentResult = {
      title: 'OrderTest',
      content: 'export interface OrderTest {}',
      isComponent: true,
      isDatasource: false,
    };
    const typeDefs = ['// Line 1', '// Line 2'];
    const componentImports = ['import type { A } from \'./A.d.ts\';'];

    const file = createComponentFile(componentResult, typeDefs, componentImports);

    const lines = file.content.split('\n');
    expect(lines[0]).toBe('// Line 1');
    expect(lines[1]).toBe('// Line 2');
    expect(lines[2]).toBe('import type { A } from \'./A.d.ts\';');
    expect(lines[3]).toBe('export interface OrderTest {}');
  });
});
