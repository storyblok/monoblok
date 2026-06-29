import { normalizeAstroExtension } from '../utils/normalizeAstroExtension';
import { normalizePath } from '../utils/normalizePath';
import { toCamelCase } from '../utils/toCamelCase';
import type { Plugin } from 'vite';

// Virtual module identifiers for Vite's module system
const VIRTUAL_MODULE_ID = 'virtual:import-storyblok-components';
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;
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

      return {
        code: moduleCode,
        moduleType: 'js',
      };
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

  // Only look into the storyblok folder
  const globPattern = `${normalizedComponentsDir}/storyblok/**/*.astro`;

  return `
    // Import utilities and fallback component
    import { toCamelCase } from '@storyblok/astro';

    // Dynamically import all Storyblok components using Vite's glob import
    const modules = import.meta.glob('${globPattern}', { eager: true });
    // Process imported modules into a components object
    const storyblokComponents = {};
    const createComponentLoader = (module) => {
      return async () => module?.default ?? module;
    };
    const registerComponent = (name, component) => {
      Object.defineProperty(storyblokComponents, name, {
        enumerable: true,
        configurable: true,
        get: () => createComponentLoader(component),
      });
    };
    for (const filePath in modules) {
      // Extract component name from file path (remove extension)
      const fileName = filePath.split('/').pop();
      const componentName = toCamelCase(fileName?.replace(/\.[^/.]+$/, '') ?? '');
      if (componentName) {
        registerComponent(componentName, modules[filePath]);
      }
    }
    
    // Manual components
    ${manualImports.join('\n\n')}
    // Add fallback component if enabled
    ${fallbackImport}    
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
  if (!customFallbackComponent) {
    return createComponentRegistrationCode({
      componentName: 'FallbackComponent',
      importPath: '@storyblok/astro/FallbackComponent.astro',
    });
  }

  const componentPath = getComponentFullPath(
    componentsDir,
    customFallbackComponent,
  );
  const resolved = await ctx.resolve(componentPath);
  if (!resolved) {
    throw new Error(
      `Custom fallback component could not be found. Does "${componentPath}" exist?`,
    );
  }

  return createComponentRegistrationCode({
    componentName: 'FallbackComponent',
    importPath: resolved.id,
  });
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
  const resolvedComponents: string[] = [];

  for (const [blokName, componentPath] of Object.entries(components)) {
    const fullPath = getComponentFullPath(componentsDir, componentPath);
    const resolved = await ctx.resolve(fullPath);

    if (!resolved) {
      if (!enableFallback) {
        throw new Error(
          `Component could not be found for blok "${blokName}"! Does "${fullPath}" exist?`,
        );
      }
      continue;
    };
    const componentName = toCamelCase(blokName);
    resolvedComponents.push(createComponentRegistrationCode({
      componentName,
      importPath: resolved.id,
    }));
  }
  return resolvedComponents;
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

interface CreateComponentRegistrationCodeOptions {
  componentName: string;
  importPath: string;
}

function createComponentRegistrationCode({
  componentName,
  importPath,
}: CreateComponentRegistrationCodeOptions): string {
  return `
  import ${componentName} from '${importPath}';
  registerComponent('${componentName}', ${componentName});
`.trim();
}
