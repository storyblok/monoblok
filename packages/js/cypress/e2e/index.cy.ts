globalThis.fetch.bind(globalThis);

const TEST_URL = 'http://localhost:5173/';

describe('@storyblok/js', () => {
  beforeEach(() => {
    cy.visit(TEST_URL, {
      onBeforeLoad(win) {
        cy.spy(win.console, 'error').as('consoleError');
      },
    });
  });

  describe('RichText', () => {
    it('should print a console error if the SDK is not initialized', () => {
      cy.get('.render-rich-text').click();
      cy.get('@consoleError').should(
        'be.calledWith',
        'Please initialize the Storyblok SDK before calling the renderRichText function',
      );
      cy.get('#rich-text-container').should('have.html', 'undefined');
    });

    it('should render the HTML using the default schema and resolver', () => {
      cy.get('.without-bridge').click();
      cy.get('.render-rich-text').click();
      cy.get('@consoleError').should('not.be.called');
      cy.get('#rich-text-container').should(
        'have.html',
        '<p></p><p>Hola<b>in bold</b></p><p></p><p>paragraph after empty line</p><p></p><ul><li><p>an item in a list</p></li><li><p>another item</p></li></ul><p></p><ol><li><p>item in another list</p></li><li><p>another item</p></li></ol><p></p><blockquote><p>this is a quote</p></blockquote><p></p><hr><p></p><p>some words after an &lt;hr&gt;</p><p></p><p><i>italic text</i></p><p></p><p><s>strikethrough</s></p><p></p><p><u>underlined</u></p><p></p><p><sup>superscript</sup></p><p></p><p><sub>subscript</sub></p><p></p><p><code>inline code</code> </p>',
      );
    });

    it('should render the HTML using a custom global schema and resolver', () => {
      cy.get('.init-custom-rich-text').click();
      cy.get('.render-rich-text').click();
      cy.get('#rich-text-container').should(
        'have.html',
        'Holain bold<div class="custom-component">hey John</div>paragraph after empty linean item in a listanother itemitem in another listanother itemthis is a quotesome words after an &lt;hr&gt;italic textstrikethroughunderlinedsuperscriptsubscriptinline code ',
      );
    });

    it('should render the HTML using a one-time schema and resolver', () => {
      cy.get('.without-bridge').click();
      cy.get('.render-rich-text-options').click();
      cy.get('#rich-text-container').should(
        'have.html',
        'Holain bold<div class="custom-component">hey John</div>paragraph after empty linean item in a listanother itemitem in another listanother itemthis is a quotesome words after an &lt;hr&gt;italic textstrikethroughunderlinedsuperscriptsubscriptinline code ',
      );
    });
  });

  describe('Bridge', () => {
    it('Is loaded by default', () => {
      cy.visit(`${TEST_URL}?_storyblok_tk[timestamp]=1677494658`);
      cy.get('.with-bridge').click();
      cy.get('#storyblok-javascript-bridge')
        .should('exist')
        .and('have.attr', 'src')
        .and('include', 'storyblok-v2-latest.js');
    });

    it('Is not loaded if options.bridge: false and no errors are printed', () => {
      cy.get('.without-bridge').click();
      cy.get('#storyblok-javascript-bridge').should('not.exist');
      cy.get('@consoleError').should('not.be.called');
    });
  });

  describe('Bridge (added independently)', () => {
    it('Can be loaded', () => {
      cy.visit(TEST_URL, {
        // Handle failed loads gracefully
        failOnStatusCode: false,
        onBeforeLoad(win) {
          cy.spy(win.console, 'error').as('consoleError');
        },
      });

      cy.get('.load-bridge')
        .should('be.visible')
        .click();

      cy.get('#storyblok-javascript-bridge')
        .should('exist');

      cy.get('@consoleError')
        .should('not.be.called');
    });
  });
});
