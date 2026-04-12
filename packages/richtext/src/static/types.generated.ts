// THIS FILE IS AUTO-GENERATED. DO NOT EDIT.
import type { SbBlokData } from './types';

/** Attribute types for all Tiptap node extensions */
export interface TiptapNodeAttributes {
  paragraph: { textAlign?: 'left' | 'center' | 'right' | 'justify' | null; };
  doc: Record<string, never>;
  text: Record<string, never>;
  blockquote: Record<string, never>;
  heading: { textAlign?: 'left' | 'center' | 'right' | 'justify' | null; level?: 1 | 2 | 3 | 4 | 5 | 6; };
  bullet_list: Record<string, never>;
  ordered_list: { start?: any; type?: any; order?: number; };
  list_item: Record<string, never>;
  code_block: { class?: string | null; };
  hard_break: Record<string, never>;
  horizontal_rule: Record<string, never>;
  image: { src?: string; alt?: string; title?: string | null; width?: number | string | null; height?: number | string | null; };
  emoji: { name?: string | null; };
  table: Record<string, never>;
  tableRow: Record<string, never>;
  tableCell: { colspan?: number; rowspan?: number; colwidth?: number[] | null; backgroundColor?: string | null; };
  tableHeader: { colspan?: number; rowspan?: number; colwidth?: number[] | null; };
  blok: { id?: string | null; body?: SbBlokData[]; };
  details: Record<string, never>;
  detailsContent: Record<string, never>;
  detailsSummary: Record<string, never>;
}

/** Attribute types for all Tiptap mark extensions */
export interface TiptapMarkAttributes {
  link: { href?: string; uuid?: any; anchor?: any; target?: '_self' | '_blank' | '_parent' | '_top' | null; linktype?: 'url' | 'story' | 'asset' | 'email'; };
  bold: Record<string, never>;
  italic: Record<string, never>;
  strike: Record<string, never>;
  underline: Record<string, never>;
  code: Record<string, never>;
  superscript: Record<string, never>;
  subscript: Record<string, never>;
  highlight: Record<string, never>;
  textStyle: { class?: string | null; id?: string | null; color?: string | null; };
  anchor: { id?: string | null; };
  styled: { class?: string | null; };
  reporter: Record<string, never>;
}

export type TiptapNodeName = keyof TiptapNodeAttributes;
export type TiptapMarkName = keyof TiptapMarkAttributes;
export type TiptapComponentName = Exclude<TiptapNodeName | TiptapMarkName, 'text'>;

export type PMNode =
  | { type: 'paragraph'; attrs?: TiptapNodeAttributes['paragraph']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'doc'; attrs?: TiptapNodeAttributes['doc']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'text'; attrs?: TiptapNodeAttributes['text']; content?: PMNode[]; marks?: PMMark[]; text: string; }
  | { type: 'blockquote'; attrs?: TiptapNodeAttributes['blockquote']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'heading'; attrs?: TiptapNodeAttributes['heading']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'bullet_list'; attrs?: TiptapNodeAttributes['bullet_list']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'ordered_list'; attrs?: TiptapNodeAttributes['ordered_list']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'list_item'; attrs?: TiptapNodeAttributes['list_item']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'code_block'; attrs?: TiptapNodeAttributes['code_block']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'hard_break'; attrs?: TiptapNodeAttributes['hard_break']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'horizontal_rule'; attrs?: TiptapNodeAttributes['horizontal_rule']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'image'; attrs?: TiptapNodeAttributes['image']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'emoji'; attrs?: TiptapNodeAttributes['emoji']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'table'; attrs?: TiptapNodeAttributes['table']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'tableRow'; attrs?: TiptapNodeAttributes['tableRow']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'tableCell'; attrs?: TiptapNodeAttributes['tableCell']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'tableHeader'; attrs?: TiptapNodeAttributes['tableHeader']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'blok'; attrs?: TiptapNodeAttributes['blok']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'details'; attrs?: TiptapNodeAttributes['details']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'detailsContent'; attrs?: TiptapNodeAttributes['detailsContent']; content?: PMNode[]; marks?: PMMark[];  }
  | { type: 'detailsSummary'; attrs?: TiptapNodeAttributes['detailsSummary']; content?: PMNode[]; marks?: PMMark[];  }
;

export type PMMark =
  | { type: 'link'; attrs?: TiptapMarkAttributes['link']; }
  | { type: 'bold'; attrs?: TiptapMarkAttributes['bold']; }
  | { type: 'italic'; attrs?: TiptapMarkAttributes['italic']; }
  | { type: 'strike'; attrs?: TiptapMarkAttributes['strike']; }
  | { type: 'underline'; attrs?: TiptapMarkAttributes['underline']; }
  | { type: 'code'; attrs?: TiptapMarkAttributes['code']; }
  | { type: 'superscript'; attrs?: TiptapMarkAttributes['superscript']; }
  | { type: 'subscript'; attrs?: TiptapMarkAttributes['subscript']; }
  | { type: 'highlight'; attrs?: TiptapMarkAttributes['highlight']; }
  | { type: 'textStyle'; attrs?: TiptapMarkAttributes['textStyle']; }
  | { type: 'anchor'; attrs?: TiptapMarkAttributes['anchor']; }
  | { type: 'styled'; attrs?: TiptapMarkAttributes['styled']; }
  | { type: 'reporter'; attrs?: TiptapMarkAttributes['reporter']; }
;

