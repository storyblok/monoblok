import { describe, expect, it } from 'vitest';
import { escapeAttr, EXCLUDED_ATTRS, processAttrs } from './attribute';

// ============================================================================
// processAttrs - Basic Attribute Handling
// ============================================================================

describe('processAttrs', () => {
  describe('basic attribute handling', () => {
    it('returns empty object for empty attrs', () => {
      expect(processAttrs('paragraph', {})).toEqual({});
    });

    it('returns empty object when attrs is undefined', () => {
      expect(processAttrs('paragraph')).toEqual({});
    });

    it('passes through regular attributes unchanged', () => {
      expect(processAttrs('paragraph', { id: 'test' })).toEqual({ id: 'test' });
    });

    it('passes through multiple attributes', () => {
      expect(processAttrs('paragraph', { id: 'test', class: 'foo' })).toEqual({
        id: 'test',
        class: 'foo',
      });
    });

    it('keeps false as a value in non-style attributes', () => {
      expect(processAttrs('paragraph', { test: false })).toEqual({ test: false });
    });

    it('keeps 0 as valid value', () => {
      expect(processAttrs('tableCell', { colwidth: 0 })).toEqual({
        style: { width: 0 },
      });
    });
  });

  // ============================================================================
  // processAttrs - Invalid/Skipped Values
  // ============================================================================

  describe('invalid and skipped values', () => {
    it('skips null values', () => {
      expect(processAttrs('paragraph', { textAlign: null })).toEqual({});
    });

    it('skips undefined values', () => {
      expect(processAttrs('paragraph', { colspan: undefined })).toEqual({});
    });

    it('skips empty string values', () => {
      expect(processAttrs('paragraph', { textAlign: '' })).toEqual({});
    });

    it('skips null and undefined together', () => {
      expect(processAttrs('paragraph', {
        textAlign: null,
        colspan: undefined,
      })).toEqual({});
    });

    it('excludes all attributes in EXCLUDED_ATTRS', () => {
      const excludedAttrs = Array.from(EXCLUDED_ATTRS).reduce((acc, attr) => {
        acc[attr] = 'test';
        return acc;
      }, {} as Record<string, string>);

      expect(processAttrs('paragraph', excludedAttrs)).toEqual({});
    });

    it('excludes level attribute', () => {
      expect(processAttrs('heading', { level: 2 })).toEqual({});
    });

    it('excludes linktype attribute', () => {
      expect(processAttrs('link', { linktype: 'url', href: '/test' })).toEqual({
        href: '/test',
      });
    });

    it('excludes uuid attribute', () => {
      expect(processAttrs('link', { uuid: '123-456', href: '/test' })).toEqual({
        href: '/test',
      });
    });

    it('excludes anchor attribute from output but uses it for story links', () => {
      expect(processAttrs('link', {
        linktype: 'story',
        href: '/page',
        anchor: 'section',
      })).toEqual({
        href: '/page#section',
      });
    });

    it('skips colspan when value is 1 (HTML default)', () => {
      expect(processAttrs('tableCell', { colspan: 1 })).toEqual({});
    });

    it('skips rowspan when value is 1 (HTML default)', () => {
      expect(processAttrs('tableCell', { rowspan: 1 })).toEqual({});
    });

    it('skips order (start) when value is 1 (HTML default)', () => {
      expect(processAttrs('ordered_list', { order: 1 })).toEqual({});
    });

    it('keeps colspan when value is not 1', () => {
      expect(processAttrs('tableCell', { colspan: 2 })).toEqual({ colSpan: 2 });
    });

    it('keeps rowspan when value is not 1', () => {
      expect(processAttrs('tableCell', { rowspan: 2 })).toEqual({ rowSpan: 2 });
    });

    it('keeps order (start) when value is not 1', () => {
      expect(processAttrs('ordered_list', { order: 5 })).toEqual({ start: 5 });
    });
  });

  // ============================================================================
  // processAttrs - Style Mapping
  // ============================================================================

  describe('style mapping', () => {
    it('maps textAlign to style for paragraph', () => {
      expect(processAttrs('paragraph', { textAlign: 'center' })).toEqual({
        style: { textAlign: 'center' },
      });
    });

    it('maps textAlign to style for heading', () => {
      expect(processAttrs('heading', { textAlign: 'right' })).toEqual({
        style: { textAlign: 'right' },
      });
    });

    it('maps color to backgroundColor for highlight', () => {
      expect(processAttrs('highlight', { color: '#ff0000' })).toEqual({
        style: { backgroundColor: '#ff0000' },
      });
    });

    it('maps color to color for textStyle', () => {
      expect(processAttrs('textStyle', { color: 'blue' })).toEqual({
        style: { color: 'blue' },
      });
    });

    it('maps backgroundColor for tableCell', () => {
      expect(processAttrs('tableCell', { backgroundColor: '#eee' })).toEqual({
        style: { backgroundColor: '#eee' },
      });
    });

    it('maps colwidth to width for tableCell', () => {
      expect(processAttrs('tableCell', { colwidth: 100 })).toEqual({
        style: { width: 100 },
      });
    });

    it('maps colwidth to width for tableHeader', () => {
      expect(processAttrs('tableHeader', { colwidth: 150 })).toEqual({
        style: { width: 150 },
      });
    });

    it('handles array values with px conversion', () => {
      expect(processAttrs('tableCell', { colwidth: [200] })).toEqual({
        style: { width: '200px' },
      });
    });

    it('handles array with null first element', () => {
      expect(processAttrs('tableCell', { colwidth: [null] })).toEqual({});
    });

    it('handles array with undefined first element', () => {
      expect(processAttrs('tableCell', { colwidth: [undefined] })).toEqual({});
    });

    it('combines multiple style properties', () => {
      expect(processAttrs('tableCell', {
        backgroundColor: '#fff',
        colwidth: [100],
      })).toEqual({
        style: {
          backgroundColor: '#fff',
          width: '100px',
        },
      });
    });

    it('combines style and non-style attributes', () => {
      expect(processAttrs('paragraph', {
        textAlign: 'center',
        id: 'intro',
      })).toEqual({
        id: 'intro',
        style: { textAlign: 'center' },
      });
    });
  });

  // ============================================================================
  // processAttrs - Default Attribute Mapping
  // ============================================================================

  describe('default attribute mapping', () => {
    it('maps fallbackImage to src', () => {
      expect(processAttrs('image', { fallbackImage: 'test.jpg' })).toEqual({
        src: 'test.jpg',
      });
    });

    it('maps body to data-body', () => {
      const result = processAttrs('blok', { body: 'content' });
      expect(result['data-body']).toBe('content');
    });

    it('maps colspan to colSpan', () => {
      expect(processAttrs('tableCell', { colspan: 2 })).toEqual({
        colSpan: 2,
      });
    });

    it('maps rowspan to rowSpan', () => {
      expect(processAttrs('tableCell', { rowspan: 3 })).toEqual({
        rowSpan: 3,
      });
    });

    it('maps name to data-name', () => {
      const result = processAttrs('emoji', { name: 'smile' });
      expect(result['data-name']).toBe('smile');
    });

    it('maps emoji to data-emoji', () => {
      const result = processAttrs('emoji', { emoji: '😀' });
      expect(result['data-emoji']).toBe('😀');
    });
  });

  // ============================================================================
  // processAttrs - Extended Attribute Mapping
  // ============================================================================

  describe('extended attribute mapping', () => {
    it('allows extendAttrMap to add new mappings', () => {
      expect(processAttrs('paragraph', { test: 'value' }, { test: 'data-test' })).toEqual({
        'data-test': 'value',
      });
    });

    it('allows extendAttrMap to override defaults', () => {
      expect(processAttrs('paragraph', { body: 'content' }, { body: 'custom-body' })).toEqual({
        'custom-body': 'content',
      });
    });

    it('applies multiple extended mappings', () => {
      expect(processAttrs('paragraph', { foo: 1, bar: 2 }, { foo: 'data-foo', bar: 'data-bar' })).toEqual({
        'data-foo': 1,
        'data-bar': 2,
      });
    });
  });

  // ============================================================================
  // processAttrs - Object Values
  // ============================================================================

  describe('object values', () => {
    it('stringifies object values', () => {
      expect(processAttrs('paragraph', { meta: { a: 1 } })).toEqual({
        meta: '{"a":1}',
      });
    });

    it('stringifies nested objects', () => {
      expect(processAttrs('paragraph', { data: { nested: { deep: true } } })).toEqual({
        data: '{"nested":{"deep":true}}',
      });
    });

    it('stringifies arrays as JSON', () => {
      expect(processAttrs('paragraph', { items: [1, 2, 3] })).toEqual({
        items: '[1,2,3]',
      });
    });
  });

  // ============================================================================
  // processAttrs - Link Custom Attributes
  // ============================================================================

  describe('link custom attributes', () => {
    it('spreads custom attributes for links', () => {
      expect(processAttrs('link', {
        href: '/test',
        custom: { title: 'My Link', rel: 'noopener' },
      })).toEqual({
        href: '/test',
        title: 'My Link',
        rel: 'noopener',
      });
    });

    it('converts custom attribute values to strings', () => {
      expect(processAttrs('link', {
        href: '/test',
        custom: { count: 42, active: true },
      })).toEqual({
        href: '/test',
        count: '42',
        active: 'true',
      });
    });

    it('does not spread custom for non-link types', () => {
      expect(processAttrs('paragraph', {
        custom: { title: 'Test' },
      })).toEqual({
        custom: '{"title":"Test"}',
      });
    });
  });

  // ============================================================================
  // processAttrs - Story Links
  // ============================================================================

  describe('story links', () => {
    it('handles story link with href and anchor', () => {
      expect(processAttrs('link', {
        linktype: 'story',
        href: '/story/123',
        anchor: 'section-1',
      })).toEqual({
        href: '/story/123#section-1',
      });
    });

    it('handles story link without anchor', () => {
      expect(processAttrs('link', {
        linktype: 'story',
        href: '/story/456',
      })).toEqual({
        href: '/story/456',
      });
    });

    it('handles story link with null href', () => {
      expect(processAttrs('link', {
        linktype: 'story',
        href: null,
        anchor: 'section-1',
      })).toEqual({
        href: '#section-1',
      });
    });

    it('handles story link with empty anchor', () => {
      expect(processAttrs('link', {
        linktype: 'story',
        href: '/page',
        anchor: '',
      })).toEqual({
        href: '/page',
      });
    });

    it('handles story link with undefined href', () => {
      expect(processAttrs('link', {
        linktype: 'story',
        anchor: 'top',
      })).toEqual({
        href: '#top',
      });
    });
  });

  // ============================================================================
  // processAttrs - Email Links
  // ============================================================================

  describe('email links', () => {
    it('handles email link', () => {
      expect(processAttrs('link', {
        linktype: 'email',
        href: 'test@example.com',
      })).toEqual({
        href: 'mailto:test@example.com',
      });
    });

    it('does not duplicate mailto prefix', () => {
      expect(processAttrs('link', {
        linktype: 'email',
        href: 'mailto:test@example.com',
      })).toEqual({
        href: 'mailto:test@example.com',
      });
    });

    it('handles email with null href', () => {
      expect(processAttrs('link', {
        linktype: 'email',
        href: null,
      })).toEqual({});
    });
  });

  // ============================================================================
  // processAttrs - URL and Asset Links
  // ============================================================================

  describe('url and asset links', () => {
    it('passes through url link href unchanged', () => {
      expect(processAttrs('link', {
        linktype: 'url',
        href: 'https://example.com',
      })).toEqual({
        href: 'https://example.com',
      });
    });

    it('passes through asset link href unchanged', () => {
      expect(processAttrs('link', {
        linktype: 'asset',
        href: 'https://cdn.example.com/file.pdf',
      })).toEqual({
        href: 'https://cdn.example.com/file.pdf',
      });
    });

    it('handles link with target attribute', () => {
      expect(processAttrs('link', {
        linktype: 'url',
        href: 'https://example.com',
        target: '_blank',
      })).toEqual({
        href: 'https://example.com',
        target: '_blank',
      });
    });
  });
});

// ============================================================================
// escapeAttr
// ============================================================================

describe('escapeAttr', () => {
  it('escapes ampersand', () => {
    expect(escapeAttr('a & b')).toBe('a &amp; b');
  });

  it('escapes double quotes', () => {
    expect(escapeAttr('say "hello"')).toBe('say &quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeAttr('it\'s')).toBe('it&#39;s');
  });

  it('escapes less than', () => {
    expect(escapeAttr('a < b')).toBe('a &lt; b');
  });

  it('escapes greater than', () => {
    expect(escapeAttr('a > b')).toBe('a &gt; b');
  });

  it('escapes multiple special characters', () => {
    expect(escapeAttr('<script>"alert(\'xss\')&"</script>')).toBe(
      '&lt;script&gt;&quot;alert(&#39;xss&#39;)&amp;&quot;&lt;/script&gt;',
    );
  });

  it('returns string unchanged when no special characters', () => {
    expect(escapeAttr('hello world')).toBe('hello world');
  });

  it('converts numbers to strings', () => {
    expect(escapeAttr(42)).toBe('42');
  });

  it('converts booleans to strings', () => {
    expect(escapeAttr(true)).toBe('true');
    expect(escapeAttr(false)).toBe('false');
  });

  it('converts null to string', () => {
    expect(escapeAttr(null)).toBe('null');
  });

  it('converts undefined to string', () => {
    expect(escapeAttr(undefined)).toBe('undefined');
  });

  it('converts objects to string', () => {
    expect(escapeAttr({ a: 1 })).toBe('[object Object]');
  });
});
