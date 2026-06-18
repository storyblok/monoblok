describe('@storyblok/svelte', () => {
  describe('Bridge', () => {
    it('Is loaded by default', () => {
      cy.visit('https://localhost:5173/?_storyblok_tk[timestamp]=1677494658');
      cy.get('#storyblok-javascript-bridge').should('exist');
    });
  });

  describe('Rendering Components', () => {
    it('The teaser blok is correctly rendered', () => {
      cy.visit('https://localhost:5173/');
      // Match the stable numeric blok `id` prefix rather than the full
      // `data-blok-uid`: the trailing `_uid` is regenerated whenever the blok
      // is edited in the space, which silently breaks an exact-match selector.
      cy.get('[data-blok-uid^="141210018-"]').should('contain', 'First Teaser');
    });
  });
});
