describe('@storyblok/react/rsc', () => {
  describe('Bridge', () => {
    it('Is loaded by default', () => {
      cy.visit('http://localhost:3000/?_storyblok_tk[timestamp]=1677494658');
      cy.window().its('storyblokRegisterEvent').should('be.a', 'function');
      cy.window().its('StoryblokBridge').should('be.a', 'function');
    });
  });

  describe('Rendering Components', () => {
    it('Is loaded by default', () => {
      cy.visit('http://localhost:3000/');
      cy.get('[data-cy="teaser"]').should('exist');
    });
  });
});
