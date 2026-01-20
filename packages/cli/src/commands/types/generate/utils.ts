import { toPascalCase } from '../../../utils';

/**
 * Generates imports for Storyblok types (ISbStoryData, StoryblokAsset, etc.)
 * @param storyblokPropertyTypes - Set of Storyblok property types used
 * @param STORY_TYPE - The ISbStoryData constant
 * @returns Array of import strings
 */
export function generateStoryblokImports(
  storyblokPropertyTypes: Set<string>,
  STORY_TYPE: string,
): string[] {
  const imports: string[] = [];

  // Check if ISbStoryData is needed
  const needsISbStoryData = storyblokPropertyTypes.has(STORY_TYPE);
  if (needsISbStoryData) {
    imports.push(`import type { ${STORY_TYPE} } from '@storyblok/js';`);
    storyblokPropertyTypes.delete(STORY_TYPE);
  }

  if (storyblokPropertyTypes.size > 0) {
    const typeImports = Array.from(storyblokPropertyTypes).map((type) => {
      const pascalType = toPascalCase(type);
      return `Storyblok${pascalType}`;
    });

    imports.push(`import type { ${typeImports.join(', ')} } from '../storyblok.d.ts';`);
  }

  return imports;
}

interface TypeResult {
  title: string;
  content: string;
  isComponent: boolean;
  isDatasource: boolean;
}

/**
 * Detects which Storyblok types are used in a component's content
 * @param content - The generated type definition content
 * @param storyblokPropertyTypes - Set of all Storyblok property types
 * @param STORY_TYPE - The ISbStoryData constant
 * @returns Array of used Storyblok type names
 */
export function detectUsedStoryblokTypes(
  content: string,
  storyblokPropertyTypes: Set<string>,
  STORY_TYPE: string,
): string[] {
  const usedTypes: string[] = [];

  // Check for ISbStoryData
  if (content.includes(STORY_TYPE)) {
    usedTypes.push(STORY_TYPE);
  }

  // Check for other Storyblok types
  Array.from(storyblokPropertyTypes).forEach((type) => {
    const pascalType = toPascalCase(type);
    if (content.includes(`Storyblok${pascalType}`)) {
      usedTypes.push(type);
    }
  });

  return usedTypes;
}

/**
 * Detects which datasource types are used in a component's content
 * @param content - The generated type definition content
 * @param datasourceResults - Array of datasource type results
 * @returns Array of used datasource type titles
 */
export function detectUsedDatasourceTypes(
  content: string,
  datasourceResults: TypeResult[],
): string[] {
  return datasourceResults
    .filter(ds => content.includes(ds.title))
    .map(ds => ds.title);
}

/**
 * Detects which component types are referenced in a component's content
 * @param content - The generated type definition content
 * @param currentTitle - The title of the current component (to exclude self-reference)
 * @param componentResults - Array of all component type results
 * @returns Array of referenced component type titles
 */
export function detectReferencedComponents(
  content: string,
  currentTitle: string,
  componentResults: TypeResult[],
): string[] {
  return componentResults
    .filter(c => c.title !== currentTitle && content.includes(c.title))
    .map(c => c.title);
}

/**
 * Generates import statements for a component based on its dependencies
 * @param componentContent - The generated component type definition
 * @param componentTitle - The title of the component
 * @param storyblokPropertyTypes - Set of all Storyblok property types
 * @param datasourceResults - Array of datasource type results
 * @param componentResults - Array of all component type results
 * @param STORY_TYPE - The ISbStoryData constant
 * @returns Array of import strings
 */
export function generateComponentImports(
  componentContent: string,
  componentTitle: string,
  storyblokPropertyTypes: Set<string>,
  datasourceResults: TypeResult[],
  componentResults: TypeResult[],
  STORY_TYPE: string,
): string[] {
  const imports: string[] = [];

  // Check if this component uses ISbStoryData or other Storyblok types
  const usedStoryblokTypes = detectUsedStoryblokTypes(
    componentContent,
    storyblokPropertyTypes,
    STORY_TYPE,
  );

  if (usedStoryblokTypes.length > 0) {
    const hasISbStoryData = usedStoryblokTypes.includes(STORY_TYPE);
    const otherTypes = usedStoryblokTypes.filter(t => t !== STORY_TYPE);

    if (hasISbStoryData) {
      imports.push(`import type { ${STORY_TYPE} } from '@storyblok/js';`);
    }

    if (otherTypes.length > 0) {
      const typeImports = otherTypes.map((type) => {
        const pascalType = toPascalCase(type);
        return `Storyblok${pascalType}`;
      });
      imports.push(`import type { ${typeImports.join(', ')} } from '../storyblok.d.ts';`);
    }
  }

  // Check if this component uses any datasource types
  const usedDatasourceTypes = detectUsedDatasourceTypes(componentContent, datasourceResults);
  if (usedDatasourceTypes.length > 0) {
    imports.push(`import type { ${usedDatasourceTypes.join(', ')} } from './datasources.d.ts';`);
  }

  // Check if this component references other components
  const referencedComponents = detectReferencedComponents(
    componentContent,
    componentTitle,
    componentResults,
  );
  if (referencedComponents.length > 0) {
    const componentImportsStr = referencedComponents
      .map(name => `import type { ${name} } from './${name}.d.ts';`)
      .join('\n');
    imports.push(componentImportsStr);
  }

  return imports;
}

/**
 * Creates a file object for datasources
 * @param datasourceResults - Array of datasource type results
 * @param typeDefs - Header comments for the file
 * @returns File object or null if no datasources
 */
export function createDatasourcesFile(
  datasourceResults: TypeResult[],
  typeDefs: string[],
): { name: string; content: string } | null {
  if (datasourceResults.length === 0) {
    return null;
  }

  const content = [
    ...typeDefs,
    ...datasourceResults.map(r => r.content),
  ].join('\n');

  return { name: 'datasources', content };
}

/**
 * Creates a file object for content types
 * @param contentTypeBloks - Set of component type names that are content types
 * @param componentResults - Array of all component type results
 * @param typeDefs - Header comments for the file
 * @returns File object or null if no content types
 */
export function createContentTypesFile(
  contentTypeBloks: Set<string>,
  typeDefs: string[],
): { name: string; content: string } | null {
  if (contentTypeBloks.size === 0) {
    return null;
  }

  // Get the component type names from the set
  const contentTypeNames = Array.from(contentTypeBloks);

  // Generate imports for each content type component
  const imports = contentTypeNames
    .map(name => `import type { ${name} } from './${name}.d.ts';`)
    .join('\n');

  // Generate the ContentType union
  const typeUnion = contentTypeNames.length > 0
    ? contentTypeNames.join('\n  | ')
    : 'never';

  const typeDefinition = `export type ContentType =\n  | ${typeUnion};`;

  const content = [
    ...typeDefs,
    imports,
    typeDefinition,
  ].join('\n');

  return { name: 'content-types', content };
}

/**
 * Creates a file object for a single component with its imports
 * @param componentResult - The component type result
 * @param typeDefs - Header comments for the file
 * @param componentImports - Array of import statements for this component
 * @returns File object
 */
export function createComponentFile(
  componentResult: TypeResult,
  typeDefs: string[],
  componentImports: string[],
): { name: string; content: string } {
  return {
    name: componentResult.title,
    content: [
      ...typeDefs,
      ...componentImports,
      componentResult.content,
    ].join('\n'),
  };
}
