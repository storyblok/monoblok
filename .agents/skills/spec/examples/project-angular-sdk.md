# Angular SDK

## Notes

Check for inspiration VMO2 package -> https://github.com/jimdrury/ng-storyblok

It was agreed that the Angular SDK will follow the new architecture, composed on top of @storyblok/capi-client, @storyblok/live-preview (name to be fully decided) and @storyblok/richtext instead of on top fo the current JS SDK

**Requested by:**

- Multiple enterprise customers -> VGZ
- https://storyblok.slack.com/archives/C02LLMSCTRT/p1760096133229489
- Dominik himself

## Specifications

**Features:** Feature parity with other SDKs

- API fetching
- Richtext rendering
  - User should be able to use Angular Components for rendering, similar to the React/Vue SDKs
- Live editing
- Rendering helpers: including story rendering its blocks recursively

**Environments:** all SSR/SSG/CSR cases Angular supports, including Angular universal

**Compatibility:** full support targets Angular 17+

**Testing:** similar to other Frontend SDKs, it's tested focusing on value and pragmatism favoring real scenarios via e2e/integration tests. Unit are used when and if needed (complex isolated functionality we want to extra-assure).

- Coverage >80%
- Fully typed

**Reactive-first:** Leverage Angular's reactive primitives (Signals for Angular 17+)

**Idiomatic Angular DX** (services, DI, signals, observables, directives, etc)

Built on the new architecture (@storyblok/capi-client, @storyblok/live-preview, @storyblok/richtext), which will enable cleaner composition than building on the existing JS SDK

## Reference

- Community package from VMO2: ng-storyblok

## Acceptance Criteria

- [ ] AC1: Package installs without peer dependency warnings for Angular 17+
- [ ] AC2: A minimal app can fetch and display a story with under 20 lines of configuration/setup
- [ ] AC3: Dynamic component rendering works for deeply nested content structures and dynamic pages
- [ ] AC4: Live editing updates content in real-time when opened in Visual Editor
- [ ] AC5: Visual Editor can click to select elements marked as editable
- [ ] AC6: Rich text with embedded bloks renders both HTML and Angular components correctly
- [ ] AC7: TypeScript autocompletion works for the user implementation cases: story rendering, richtext rendering, module setup, etc
- [ ] AC8: Tests achieve > 80% coverage
- [ ] AC9: README points to the Package Reference, with a similar structure than other SDKs

## Proposed architecture

## Outcome

1st stage - a PoC to evaluate and iterate with the team, shaping the final DX through input.

Final SDK
