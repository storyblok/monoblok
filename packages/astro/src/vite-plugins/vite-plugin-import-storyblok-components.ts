import { normalizeAstroExtension } from '../utils/normalizeAstroExtension';
import { normalizePath } from '../utils/normalizePath';
import { toCamelCase } from '../utils/toCamelCase';
import type { Plugin } from 'vite';

/**
 * Vite plugin that automatically imports Storyblok components from a specified directory
 * and merges them with optional user-provided component mappings.
 *
 * @returns Vite plugin object
 */
export function vitePluginImportStoryblokComponents(
  components: Record<string, string>,
  componentsDir: string,
  enableFallbackComponent: boolean,
  customFallbackComponent?: string,
): Plugin {
  // Virtual module identifiers for Vite's module system
  const VIRTUAL_MODULE_ID = 'virtual:import-storyblok-components';
  const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

  return {
    name: 'vite-plugin-import-storyblok-components',

    /**
     * Resolves virtual module imports
     */
    async resolveId(id: string) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
    },

    /**
     * Generates the virtual module content with dynamic imports
     */
    async load(id: string) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) {
        return;
      }

      // Resolve fallback component import
      const fallbackImport = await resolveFallbackComponent(
        this,
        componentsDir,
        enableFallbackComponent,
        customFallbackComponent,
      );

      const manualImports = await resolveUserComponents(
        this,
        components,
        componentsDir,
        enableFallbackComponent,
      );

      // Generate the virtual module code
      const moduleCode = generateModuleCode(
        componentsDir,
        fallbackImport,
        manualImports,
      );

      return moduleCode;
    },
  };
}
/**
 * Generates the complete virtual module code including:
 * - Auto-imported components via glob
 * - User-provided component imports
 * - Optional fallback component
 *
 * @param componentsDir - Base directory of components
 * @param fallbackImport - Import statement for fallback (if any)
 * @param manualImports - Explicit imports generated from user-provided components
 * @returns Virtual module source code
 */
function generateModuleCode(
  componentsDir: string,
  fallbackImport: string,
  manualImports: string[],
): string {
  // Normalize components directory path for Vite globbing
  const normalizedComponentsDir = normalizePath(componentsDir);
  const globPattern = `${normalizedComponentsDir}/**/*.astro`;

  return `
    // Import utilities and fallback component
    import { toCamelCase } from '@storyblok/astro';
    ${fallbackImport}
    ${manualImports.join('\n')}

    // Dynamically import all Storyblok components using Vite's glob import
    const modules = import.meta.glob('${globPattern}', { eager: true });
    // Process imported modules into a components object
    const storyblokComponents = {};
    
    for (const filePath in modules) {
      // Extract component name from file path (remove extension)
      const fileName = filePath.split('/').pop();
      const componentName = fileName?.replace(/\\.[^/.]+$/, '');
      
      if (componentName) {
        // Get the component (handle both default and named exports)
        const component = modules[filePath].default || modules[filePath];
        
        // Convert filename to camelCase for Storyblok component naming
        const camelCaseName = toCamelCase(componentName);
        storyblokComponents[camelCaseName] = component;
      }
    }
    
    // Manual imports (overwrite auto if same key exists)
    ${manualImports
      .map((imp) => {
        const varName = imp.match(/import (.*?) from/)?.[1];
        return `storyblokComponents['${varName}'] = ${varName};`;
      })
      .join('\n')}

    // Add fallback component if enabled
    ${fallbackImport ? `storyblokComponents['FallbackComponent'] = FallbackComponent;` : ''}
    
    // Export the components object for use in Storyblok initialization
    export { storyblokComponents };
  `.trim();
}

async function resolveFallbackComponent(
  ctx: any,
  componentsDir: string,
  enableFallbackComponent: boolean,
  customFallbackComponent?: string,
): Promise<string> {
  if (!enableFallbackComponent) {
    return '';
  }

  if (customFallbackComponent) {
    const customPath = getComponentFullPath(
      componentsDir,
      customFallbackComponent,
    );
    const resolved = await ctx.resolve(customPath);
    if (!resolved) {
      throw new Error(
        `Custom fallback component could not be found. Does "${customPath}" exist?`,
      );
    }
    return `import FallbackComponent from '${customPath}';`;
  }

  return `import FallbackComponent from '@storyblok/astro/FallbackComponent.astro';`;
}
/**
 * Resolves user-provided Storyblok components into import statements.
 *
 * @param ctx - Vite plugin context (`this` in load hook)
 * @param components - User-specified mapping of blok names to component paths
 * @param componentsDir - Base directory for components
 * @param enableFallback - Whether to silently skip unresolved components
 * @returns Object containing import statements
 */
async function resolveUserComponents(
  ctx: any,
  components: Record<string, string>,
  componentsDir: string,
  enableFallback: boolean,
): Promise<string[]> {
  const imports: string[] = [];

  for await (const [key, value] of Object.entries(components)) {
    const pathWithExt = getComponentFullPath(componentsDir, value);
    const resolvedId = await ctx.resolve(pathWithExt);

    if (!resolvedId) {
      if (!enableFallback) {
        throw new Error(
          `Component could not be found for blok "${key}"! Does "${pathWithExt}" exist?`,
        );
      }
    }
    else {
      imports.push(`import ${toCamelCase(key)} from "${resolvedId.id}"`);
    }
  }

  return imports;
}

/**
 * Builds the full normalized path to an Astro component file.
 *
 * - Ensures both the components directory and the component path
 *   are normalized (leading slash, no trailing slash, no duplicates).
 * - Concatenates them into a single path.
 * - Ensures the `.astro` extension is present.
 *
 * @param componentsDir - Base directory where Astro components live
 * @param componentPath - Relative path (or subpath) to the component
 * @returns Full normalized path ending with `.astro`
 *
 * @example
 * getComponentFullPath("components", "ui/Button");
 * // "/components/ui/Button.astro"
 */
function getComponentFullPath(
  componentsDir: string,
  componentPath: string,
): string {
  const normalizedComponentsDir = normalizePath(componentsDir);
  const fullComponentPath = `${normalizedComponentsDir}${normalizePath(componentPath)}`;
  return normalizeAstroExtension(fullComponentPath);
}
