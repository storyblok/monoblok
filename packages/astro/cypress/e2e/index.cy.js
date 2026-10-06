/*
Tests:
- storyblokEditable attributes are assigned
- components registered via defineStoryblokBlocks are rendered correctly
- the fallback component renders for unregistered block types
- richtext embedded bloks render through the block registry
*/

describe("@storyblok/astro", () => {
  it("storyblokEditable adds correct attributes", () => {
    cy.visit("http://localhost:4321/");
    cy.get("[data-test=page-component]").should(
      "have.attr",
      "data-blok-uid",
      "291636474-b0efb26b-f00a-455f-8862-4a6e650c1d4d",
    );
    cy.get("[data-test=page-component]").should(
      "have.attr",
      "data-blok-c",
      `{"name":"page","space":"221046","uid":"b0efb26b-f00a-455f-8862-4a6e650c1d4d","id":"291636474"}`,
    );
  });
  it("component registered via defineStoryblokBlocks is rendered correctly", () => {
    cy.visit("http://localhost:4321/");
    cy.get("[data-test=feature-component]").should("exist");
  });
  it("the fallback passed to defineStoryblokBlocks is rendered for unregistered block types", () => {
    cy.visit("http://localhost:4321/");
    cy.get("[data-test=custom-fallback-component]").should("exist");
  });
  it("RichText Renderer renders embedded bloks correctly", () => {
    cy.visit("http://localhost:4321/");
    cy.get("[data-test=embedded-blok]").should("exist");
  });
});
