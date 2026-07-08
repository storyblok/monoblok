import { describe, expect, it } from 'vitest';
import { createComponentRegistrationParts, generateModuleCode } from '../src/vite-plugins/vite-plugin-import-storyblok-components';

describe('vite-plugin-import-storyblok-components', () => {
  describe('createComponentRegistrationParts', () => {
    it('generates structured parts with wrapper for TDZ avoidance', () => {
      const parts = createComponentRegistrationParts({
        componentName: 'Card',
        importPath: '/src/components/Card.astro',
      });

      expect(parts.importStatement).toBe(`import __Card_component__ from '/src/components/Card.astro';`);
      expect(parts.wrapperDefinition).toBe(`const __Card_wrapper__ = { get default() { return __Card_component__; } };`);
      expect(parts.registrationCall).toBe(`registerComponent('Card', __Card_wrapper__);`);
    });

    it('uses unique variable names based on component name', () => {
      const cardParts = createComponentRegistrationParts({
        componentName: 'Card',
        importPath: '/src/Card.astro',
      });
      const heroParts = createComponentRegistrationParts({
        componentName: 'Hero',
        importPath: '/src/Hero.astro',
      });

      // Variable names should be unique per component
      expect(cardParts.importStatement).toContain('__Card_component__');
      expect(heroParts.importStatement).toContain('__Hero_component__');
      expect(cardParts.wrapperDefinition).toContain('__Card_wrapper__');
      expect(heroParts.wrapperDefinition).toContain('__Hero_wrapper__');
    });
  });

  describe('generateModuleCode', () => {
    it('generates valid module code without manual components', () => {
      const code = generateModuleCode('/src/components', null, []);

      expect(code).toContain('import { toCamelCase }');
      expect(code).toContain('import.meta.glob');
      expect(code).toContain('export { storyblokComponents }');
    });

    it('generates valid module code with manual components', () => {
      const manualRegistrations = [
        createComponentRegistrationParts({
          componentName: 'card',
          importPath: '/src/components/Card.astro',
        }),
        createComponentRegistrationParts({
          componentName: 'hero',
          importPath: '/src/components/Hero.astro',
        }),
      ];

      const code = generateModuleCode('/src/components', null, manualRegistrations);

      expect(code).toContain(`import __card_component__ from '/src/components/Card.astro'`);
      expect(code).toContain(`const __card_wrapper__ = { get default() { return __card_component__; } }`);
      expect(code).toContain(`registerComponent('card', __card_wrapper__)`);
      expect(code).toContain(`import __hero_component__ from '/src/components/Hero.astro'`);
      expect(code).toContain(`const __hero_wrapper__ = { get default() { return __hero_component__; } }`);
      expect(code).toContain(`registerComponent('hero', __hero_wrapper__)`);
    });

    it('generates valid module code with fallback component', () => {
      const fallbackRegistration = createComponentRegistrationParts({
        componentName: 'FallbackComponent',
        importPath: '@storyblok/astro/FallbackComponent.astro',
      });

      const code = generateModuleCode('/src/components', fallbackRegistration, []);

      expect(code).toContain(`import __FallbackComponent_component__ from '@storyblok/astro/FallbackComponent.astro'`);
      expect(code).toContain(`const __FallbackComponent_wrapper__ = { get default() { return __FallbackComponent_component__; } }`);
      expect(code).toContain(`registerComponent('FallbackComponent', __FallbackComponent_wrapper__)`);
    });

    /**
     * This test verifies that static imports are placed at the top of the module
     * to ensure proper hoisting behavior and avoid TDZ issues.
     */
    it('places static imports at the top of the module', () => {
      const manualRegistrations = [
        createComponentRegistrationParts({
          componentName: 'card',
          importPath: '/src/components/Card.astro',
        }),
      ];

      const code = generateModuleCode('/src/components', null, manualRegistrations);

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

    it('places wrapper definitions before registration calls', () => {
      const manualRegistrations = [
        createComponentRegistrationParts({
          componentName: 'card',
          importPath: '/src/components/Card.astro',
        }),
      ];

      const code = generateModuleCode('/src/components', null, manualRegistrations);

      // Wrapper definitions should come before registration calls
      const wrapperDefIndex = code.indexOf('const __card_wrapper__');
      const registerCallIndex = code.indexOf(`registerComponent('card', __card_wrapper__)`);

      expect(wrapperDefIndex).toBeGreaterThan(-1);
      expect(registerCallIndex).toBeGreaterThan(-1);
      expect(wrapperDefIndex).toBeLessThan(registerCallIndex);
    });

    it('places registration calls after registerComponent is defined', () => {
      const manualRegistrations = [
        createComponentRegistrationParts({
          componentName: 'card',
          importPath: '/src/components/Card.astro',
        }),
      ];

      const code = generateModuleCode('/src/components', null, manualRegistrations);

      // registerComponent definition should come before registration calls
      const registerComponentDefIndex = code.indexOf('const registerComponent = ');
      const registerCallIndex = code.indexOf(`registerComponent('card'`);

      expect(registerComponentDefIndex).toBeGreaterThan(-1);
      expect(registerCallIndex).toBeGreaterThan(-1);
      expect(registerComponentDefIndex).toBeLessThan(registerCallIndex);
    });

    it('uses glob pattern for auto-discovered components', () => {
      const code = generateModuleCode('/src/components', null, []);

      // Should use import.meta.glob for components in storyblok folder
      expect(code).toContain(`import.meta.glob('/src/components/storyblok/**/*.astro'`);
      expect(code).toContain('eager: true');
    });

    it('registers glob components before manual components', () => {
      const manualRegistrations = [
        createComponentRegistrationParts({
          componentName: 'card',
          importPath: '/src/components/Card.astro',
        }),
      ];

      const code = generateModuleCode('/src/components', null, manualRegistrations);

      // Glob components registration loop should come before manual registration
      const globLoopIndex = code.indexOf('for (const filePath in modules)');
      const manualRegisterIndex = code.indexOf(`registerComponent('card'`);

      expect(globLoopIndex).toBeGreaterThan(-1);
      expect(manualRegisterIndex).toBeGreaterThan(-1);
      expect(globLoopIndex).toBeLessThan(manualRegisterIndex);
    });

    /**
     * This test verifies that the TDZ fix is properly applied:
     * components are registered with wrapper objects that use getters,
     * not with the raw imported component reference.
     */
    it('registers components using wrapper with getter (TDZ fix)', () => {
      const manualRegistrations = [
        createComponentRegistrationParts({
          componentName: 'card',
          importPath: '/src/components/Card.astro',
        }),
      ];

      const code = generateModuleCode('/src/components', null, manualRegistrations);

      // Should NOT register with the raw component
      expect(code).not.toContain(`registerComponent('card', __card_component__)`);

      // Should register with the wrapper that has a getter
      expect(code).toContain(`registerComponent('card', __card_wrapper__)`);

      // The wrapper should use a getter to defer access
      expect(code).toContain(`const __card_wrapper__ = { get default() { return __card_component__; } }`);
    });
  });
});
