describe('@storyblok/react/rsc', () => {
  describe('Bridge', () => {
    it('Is loaded by default', () => {
      cy.visit('http://localhost:3000/?_storyblok_tk[timestamp]=1677494658');
      // Verify we're in an iframe context (which Cypress provides automatically)
      cy.window().then((win) => {
        expect(win.self).to.not.equal(win.top);
      });
      cy.get('#storyblok-javascript-bridge').should('exist');
    });
  });

  describe('Rendering Components', () => {
    it('Is loaded by default', () => {
      cy.visit('http://localhost:3000/');
      cy.get('[data-cy="teaser"]').should('exist');
    });
  });
});
