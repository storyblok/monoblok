import { normalizeAstroExtension } from '../utils/normalizeAstroExtension';
import { normalizePath } from '../utils/normalizePath';
import { toCamelCase } from '../utils/toCamelCase';
import type { Plugin } from 'vite';

const VIRTUAL_MODULE_ID = 'virtual:import-storyblok-components';
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;

/**
 * Vite plugin that auto-imports Storyblok components from a directory
 * and merges them with user-provided component mappings.
 */
export function vitePluginImportStoryblokComponents(
  components: Record<string, string>,
  componentsDir: string,
  enableFallbackComponent: boolean,
  customFallbackComponent?: string,
): Plugin {
  return {
    name: 'vite-plugin-import-storyblok-components',

    async resolveId(id: string) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
    },

    async load(id: string) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) {
        return;
      }

      const fallbackRegistration = await resolveFallbackComponent(
        this,
        componentsDir,
        enableFallbackComponent,
        customFallbackComponent,
      );

      const manualRegistrations = await resolveUserComponents(
        this,
        components,
        componentsDir,
        enableFallbackComponent,
      );

      return {
        code: generateModuleCode(componentsDir, fallbackRegistration, manualRegistrations),
        moduleType: 'js',
      };
    },
  };
}

export interface ComponentRegistrationParts {
  importStatement: string;
  wrapperDefinition: string;
  registrationCall: string;
}

/**
 * Generates the virtual module code with:
 * - Static imports at the top for proper hoisting
 * - Glob-imported components from storyblok folder
 * - Manual and fallback component registrations
 */
export function generateModuleCode(
  componentsDir: string,
  fallbackRegistration: ComponentRegistrationParts | null,
  manualRegistrations: ComponentRegistrationParts[],
): string {
  const normalizedComponentsDir = normalizePath(componentsDir);
  const globPattern = `${normalizedComponentsDir}/storyblok/**/*.astro`;

  const allRegistrations = [...manualRegistrations];
  if (fallbackRegistration) {
    allRegistrations.push(fallbackRegistration);
  }

  const importStatements = allRegistrations.map(r => r.importStatement);
  const wrapperDefinitions = allRegistrations.map(r => r.wrapperDefinition);
  const registrationCalls = allRegistrations.map(r => r.registrationCall);

  return `
    import { toCamelCase } from '@storyblok/astro';
    ${importStatements.join('\n    ')}

    const modules = import.meta.glob('${globPattern}', { eager: true });

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
      const fileName = filePath.split('/').pop();
      const componentName = toCamelCase(fileName?.replace(/\\.[^/.]+$/, '') ?? '');
      if (componentName) {
        registerComponent(componentName, modules[filePath]);
      }
    }

    ${wrapperDefinitions.join('\n    ')}

    ${registrationCalls.join('\n    ')}

    export { storyblokComponents };
  `.trim();
}

async function resolveFallbackComponent(
  ctx: any,
  componentsDir: string,
  enableFallbackComponent: boolean,
  customFallbackComponent?: string,
): Promise<ComponentRegistrationParts | null> {
  if (!enableFallbackComponent) {
    return null;
  }
  if (!customFallbackComponent) {
    return createComponentRegistrationParts({
      componentName: 'FallbackComponent',
      importPath: '@storyblok/astro/FallbackComponent.astro',
    });
  }

  const componentPath = getComponentFullPath(componentsDir, customFallbackComponent);
  const resolved = await ctx.resolve(componentPath);
  if (!resolved) {
    throw new Error(
      `Custom fallback component could not be found. Does "${componentPath}" exist?`,
    );
  }

  return createComponentRegistrationParts({
    componentName: 'FallbackComponent',
    importPath: resolved.id,
  });
}

async function resolveUserComponents(
  ctx: any,
  components: Record<string, string>,
  componentsDir: string,
  enableFallback: boolean,
): Promise<ComponentRegistrationParts[]> {
  const resolvedComponents: ComponentRegistrationParts[] = [];

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
    resolvedComponents.push(createComponentRegistrationParts({
      componentName,
      importPath: resolved.id,
    }));
  }
  return resolvedComponents;
}

function getComponentFullPath(
  componentsDir: string,
  componentPath: string,
): string {
  const normalizedComponentsDir = normalizePath(componentsDir);
  const fullComponentPath = `${normalizedComponentsDir}${normalizePath(componentPath)}`;
  return normalizeAstroExtension(fullComponentPath);
}

interface CreateComponentRegistrationPartsOptions {
  componentName: string;
  importPath: string;
}

/**
 * Generates structured registration parts for a component.
 *
 * Uses a getter wrapper to avoid TDZ (Temporal Dead Zone) errors.
 * When Vite bundles modules, direct references to imported components
 * can cause "Cannot access 'X' before initialization" errors.
 * The getter defers access until the component is actually needed.
 */
export function createComponentRegistrationParts({
  componentName,
  importPath,
}: CreateComponentRegistrationPartsOptions): ComponentRegistrationParts {
  const varName = `__${componentName}_component__`;
  const wrapperName = `__${componentName}_wrapper__`;

  return {
    importStatement: `import ${varName} from '${importPath}';`,
    wrapperDefinition: `const ${wrapperName} = { get default() { return ${varName}; } };`,
    registrationCall: `registerComponent('${componentName}', ${wrapperName});`,
  };
}
