/*
Tests:
- Bridge should be loaded
- storyblokEditable attributes are assigned
- globally loaded component is rendered correctly
- TDZ fix works for manually registered components
*/

describe("@storyblok/astro", () => {
  it("is loaded", () => {
    cy.visit("http://localhost:4321/");
    cy.window().its("storyblokRegisterEvent").should("be.a", "function");
    cy.window().its("StoryblokBridge").should("be.a", "function");
  });
  it("storyblokEditable adds correct attributes", () => {
    cy.visit("http://localhost:4321/");
    cy.get("[data-test=page-component]").should(
      "have.attr",
      "data-blok-uid",
      "291636474-b0efb26b-f00a-455f-8862-4a6e650c1d4d"
    );
    cy.get("[data-test=page-component]").should(
      "have.attr",
      "data-blok-c",
      `{"name":"page","space":"221046","uid":"b0efb26b-f00a-455f-8862-4a6e650c1d4d","id":"291636474"}`
    );
  });
  it("globally registered feature component is loaded correctly", () => {
    cy.visit("http://localhost:4321/");
    cy.get("[data-test=feature-component]").should("exist");
  });
  it("Custom FallbackComponent is loaded correctly", () => {
    cy.visit("http://localhost:4321/");
    cy.get("[data-test=custom-fallback-component]").should("exist");
  });

  /**
   * TDZ (Temporal Dead Zone) Test
   *
   * Verifies that manually-registered components don't cause
   * "Cannot access 'X' before initialization" errors when:
   * 1. A component is registered in astro.config.mjs
   * 2. The same component is directly imported in a page
   *
   * If the page loads and renders correctly, the TDZ fix is working.
   */
  it("TDZ fix: directly imported components work alongside registration", () => {
    cy.visit("http://localhost:4321/tdz-test");
    // Page should load without TDZ errors
    cy.contains("TDZ Test Page").should("exist");
    cy.contains("If you can see this, the TDZ fix is working correctly.").should("exist");
    // Directly imported Teaser component should render
    cy.contains("Direct Import Test").should("exist");
  });

  /* it("RichText Renderer renders embedded bloks correctly", () => {
    cy.visit("http://localhost:4321/");
    cy.get("[data-test=embedded-blok]").should("exist");
  }); */
  /*describe("Bridge", () => {
    it("Is loaded by default", () => {
      cy.visit("http://localhost:3000/");
      cy.get(".with-bridge").click();
      cy.get("#storyblok-javascript-bridge").should("exist");
    });

    it("Is not loaded if options.bridge: false and errors in console", () => {
      cy.visit("http://localhost:3000/");
      cy.get(".without-bridge").click();
      cy.get("#storyblok-javascript-bridge").should("not.exist");
    });
  });
  describe("Bridge (added independently)", () => {
    it("Can be loaded", () => {
      cy.visit("http://localhost:3000/");
      cy.get(".load-bridge").click();
      cy.get("#storyblok-javascript-bridge").should("exist");
    });
    it("Can be loaded just once", () => {
      cy.visit("http://localhost:3000/");
      cy.get(".load-bridge").click();
      cy.wait(1000);
      cy.get(".load-bridge").click();
      cy.get("#storyblok-javascript-bridge")
        .should("exist")
        .and("have.length", 1);
    });
  });*/
});
