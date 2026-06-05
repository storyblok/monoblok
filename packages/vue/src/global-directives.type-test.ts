import type { Directive, GlobalDirectives } from 'vue';

/**
 * Compile-time regression test for https://github.com/storyblok/monoblok/issues/620
 * `v-editable` must be declared in Vue's `GlobalDirectives` so that
 * vue-tsc/Volar recognize it in templates under `strictTemplates`.
 */
export type VEditableIsGloballyDeclared
  = GlobalDirectives['vEditable'] extends Directive<HTMLElement> ? true : never;
