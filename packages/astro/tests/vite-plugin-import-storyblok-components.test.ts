import { describe, expect, it } from 'vitest';
import { generateModuleCode } from '../src/vite-plugins/vite-plugin-import-storyblok-components';

describe('vite-plugin-import-storyblok-components', () => {
  describe('generateModuleCode', () => {
    it('generates valid module code without manual components', () => {
      const code = generateModuleCode('/src/components', '', []);

      expect(code).toContain('import { toCamelCase }');
      expect(code).toContain('import.meta.glob');
      expect(code).toContain('export { storyblokComponents }');
    });

    it('generates valid module code with manual components', () => {
      const manualImports = [
        `import __card_component__ from '/src/components/Card.astro';\nregisterComponent('card', __card_component__);`,
        `import __hero_component__ from '/src/components/Hero.astro';\nregisterComponent('hero', __hero_component__);`,
      ];

      const code = generateModuleCode('/src/components', '', manualImports);

      expect(code).toContain('import __card_component__ from \'/src/components/Card.astro\'');
      expect(code).toContain('registerComponent(\'card\', __card_component__)');
      expect(code).toContain('import __hero_component__ from \'/src/components/Hero.astro\'');
      expect(code).toContain('registerComponent(\'hero\', __hero_component__)');
    });

    it('generates valid module code with fallback component', () => {
      const fallbackImport = `import __FallbackComponent_component__ from '@storyblok/astro/FallbackComponent.astro';\nregisterComponent('FallbackComponent', __FallbackComponent_component__);`;

      const code = generateModuleCode('/src/components', fallbackImport, []);

      expect(code).toContain('import __FallbackComponent_component__ from \'@storyblok/astro/FallbackComponent.astro\'');
      expect(code).toContain('registerComponent(\'FallbackComponent\', __FallbackComponent_component__)');
    });

    /**
     * This test verifies that static imports are placed at the top of the module
     * to ensure proper hoisting behavior and avoid TDZ issues.
     */
    it('places static imports at the top of the module', () => {
      const manualImports = [
        `import __card_component__ from '/src/components/Card.astro';\nregisterComponent('card', __card_component__);`,
      ];

      const code = generateModuleCode('/src/components', '', manualImports);

      // All imports should be at the top, before any other code
      const toCamelCaseImportIndex = code.indexOf('import { toCamelCase }');
      const cardImportIndex = code.indexOf('import __card_component__');
      const modulesDefIndex = code.indexOf('const modules = import.meta.glob');

      expect(toCamelCaseImportIndex).toBeGreaterThan(-1);
      expect(cardImportIndex).toBeGreaterThan(-1);
      expect(modulesDefIndex).toBeGreaterThan(-1);

      // Both imports should come before the modules definition
      expect(toCamelCaseImportIndex).toBeLessThan(modulesDefIndex);
      expect(cardImportIndex).toBeLessThan(modulesDefIndex);
    });

    it('places registration calls after registerComponent is defined', () => {
      const manualImports = [
        `import __card_component__ from '/src/components/Card.astro';\nregisterComponent('card', __card_component__);`,
      ];

      const code = generateModuleCode('/src/components', '', manualImports);

      // registerComponent definition should come before registration calls
      const registerComponentDefIndex = code.indexOf('const registerComponent = ');
      const registerCallIndex = code.indexOf('registerComponent(\'card\'');

      expect(registerComponentDefIndex).toBeGreaterThan(-1);
      expect(registerCallIndex).toBeGreaterThan(-1);
      expect(registerComponentDefIndex).toBeLessThan(registerCallIndex);
    });

    it('uses glob pattern for auto-discovered components', () => {
      const code = generateModuleCode('/src/components', '', []);

      // Should use import.meta.glob for components in storyblok folder
      expect(code).toContain('import.meta.glob(\'/src/components/storyblok/**/*.astro\'');
      expect(code).toContain('eager: true');
    });

    it('registers glob components before manual components', () => {
      const manualImports = [
        `import __card_component__ from '/src/components/Card.astro';\nregisterComponent('card', __card_component__);`,
      ];

      const code = generateModuleCode('/src/components', '', manualImports);

      // Glob components registration loop should come before manual registration
      const globLoopIndex = code.indexOf('for (const filePath in modules)');
      const manualRegisterIndex = code.indexOf('registerComponent(\'card\'');

      expect(globLoopIndex).toBeGreaterThan(-1);
      expect(manualRegisterIndex).toBeGreaterThan(-1);
      expect(globLoopIndex).toBeLessThan(manualRegisterIndex);
    });
  });
});
