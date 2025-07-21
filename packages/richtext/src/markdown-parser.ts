import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { Emphasis, Heading, Paragraph, Root, RootContent, Strong, Text } from 'mdast';
import type { StoryblokRichTextDocumentNode } from './types';

/**
 * Converts Markdown string to Storyblok Richtext Document Node.
 * Currently supports headings, paragraphs, and basic marks (bold, italic).
 * @param markdown - The markdown string to convert
 * @returns StoryblokRichTextDocumentNode
 */
export function markdownToStoryblokRichtext(markdown: string): StoryblokRichTextDocumentNode {
  // Parse markdown to MDAST (Markdown AST)
  const tree = unified().use(remarkParse).parse(markdown) as Root;

  // Helper to recursively convert MDAST nodes to Storyblok Richtext nodes
  function convertNode(node: RootContent): StoryblokRichTextDocumentNode | null {
    switch (node.type) {
      case 'heading': {
        // Convert Markdown heading to Storyblok heading node
        const heading = node as Heading;
        return {
          type: 'heading',
          attrs: { level: heading.depth },
          content: heading.children.map(convertNode).filter(Boolean) as StoryblokRichTextDocumentNode[],
        };
      }
      case 'paragraph': {
        // Convert Markdown paragraph to Storyblok paragraph node
        const paragraph = node as Paragraph;
        return {
          type: 'paragraph',
          content: paragraph.children.map(convertNode).filter(Boolean) as StoryblokRichTextDocumentNode[],
        };
      }
      case 'text': {
        // Convert Markdown text to Storyblok text node
        const textNode = node as Text;
        return {
          type: 'text',
          text: textNode.value,
        };
      }
      case 'strong': {
        // Convert Markdown bold to Storyblok bold mark
        const strong = node as Strong;
        return {
          type: 'text',
          text: strong.children.map(c => (c.type === 'text' ? (c as Text).value : '')).join(''),
          marks: [{ type: 'bold' }],
        };
      }
      case 'emphasis': {
        // Convert Markdown italic to Storyblok italic mark
        const em = node as Emphasis;
        return {
          type: 'text',
          text: em.children.map(c => (c.type === 'text' ? (c as Text).value : '')).join(''),
          marks: [{ type: 'italic' }],
        };
      }
      default:
        // Not yet supported node type
        return null;
    }
  }

  // Convert all top-level nodes
  const content = tree.children
    .map(convertNode)
    .filter(Boolean) as StoryblokRichTextDocumentNode[];

  // Return as Storyblok document node
  return {
    type: 'doc',
    content,
  };
}

// Inline comments explain the conversion logic and why only certain nodes are supported initially.
// Extend this utility as needed to support more markdown features and Storyblok node types.
