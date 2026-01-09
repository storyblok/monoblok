import { randomUUID } from 'node:crypto';

let id = 0;

const getID = () => {
  id += 1;
  return id;
};

const authorID = getID();

export const makeStoryWithAllFieldTypes = () => ({
  name: 'Everything Page',
  id: getID(),
  uuid: randomUUID(),
  parent_id: getID(),
  group_id: randomUUID(),
  alternates: [
    {
      id: getID(),
      name: 'Everything Page Alternate',
      slug: 'everything-page-alternate-c',
      published: true,
      full_slug: 'everything-page-alternate-c',
      is_folder: false,
      parent_id: getID(),
    },
  ],
  created_at: '2025-12-03T12:36:57.158Z',
  deleted_at: null,
  sort_by_date: null,
  tag_list: [
    'Tag 1',
  ],
  updated_at: '2025-12-03T12:46:11.929Z',
  published_at: '2025-12-03T12:46:11.908Z',
  is_folder: false,
  content: {
    _uid: randomUUID(),
    date: '2025-12-22 00:00',
    link: {
      id: randomUUID(),
      url: '',
      linktype: 'story',
      fieldtype: 'multilink',
      cached_url: 'everything-page',
    },
    text: 'Text',
    asset: {
      id: getID(),
      alt: 'Foo',
      name: '',
      focus: '',
      title: '',
      source: '',
      filename: 'https://a.storyblok.com/f/286708067665657/1930x1382/05079de471/component-spec.png',
      copyright: 'Markus Foo',
      fieldtype: 'asset',
      meta_data: {
        alt: 'Foo',
        title: '',
        source: '',
        copyright: 'Markus Foo',
      },
      is_external_url: false,
    },
    table: {
      tbody: [
        {
          _uid: randomUUID(),
          body: [
            {
              _uid: randomUUID(),
              value: 'x',
              component: '_table_col',
            },
            {
              _uid: randomUUID(),
              value: 'y',
              component: '_table_col',
            },
          ],
          component: '_table_row',
        },
      ],
      thead: [
        {
          _uid: randomUUID(),
          value: 'Hello',
          component: '_table_head',
        },
        {
          _uid: randomUUID(),
          value: 'World',
          component: '_table_head',
        },
      ],
      fieldtype: 'table',
    },
    bloks: [
      {
        _uid: randomUUID(),
        date: '',
        link: {
          id: randomUUID(),
          url: '',
          linktype: 'story',
          fieldtype: 'multilink',
          cached_url: 'everything-page',
        },
        text: '',
        asset: {
          id: null,
          alt: null,
          name: '',
          focus: null,
          title: null,
          source: null,
          filename: '',
          copyright: null,
          fieldtype: 'asset',
          meta_data: {},
        },
        table: {
          tbody: [
            {
              _uid: randomUUID(),
              body: [
                {
                  _uid: randomUUID(),
                  value: '',
                  component: '_table_col',
                },
                {
                  _uid: randomUUID(),
                  value: '',
                  component: '_table_col',
                },
              ],
              component: '_table_row',
            },
          ],
          thead: [
            {
              _uid: randomUUID(),
              value: '',
              component: '_table_head',
            },
            {
              _uid: randomUUID(),
              value: '',
              component: '_table_head',
            },
          ],
          fieldtype: 'table',
        },
        bloks: [
          {
            _uid: randomUUID(),
            date: '',
            link: {
              id: '',
              url: '',
              linktype: 'story',
              fieldtype: 'multilink',
              cached_url: '',
            },
            text: '',
            asset: {
              id: getID(),
              alt: 'Foo',
              name: '',
              focus: '',
              title: '',
              source: '',
              filename: 'https://a.storyblok.com/f/286708067665657/1930x1382/05079de471/component-spec.png',
              copyright: 'Markus Foo',
              fieldtype: 'asset',
              meta_data: {
                alt: 'Foo',
                title: '',
                source: '',
                copyright: 'Markus Foo',
              },
              is_external_url: false,
            },
            table: {
              tbody: [
                {
                  _uid: randomUUID(),
                  body: [
                    {
                      _uid: randomUUID(),
                      value: '',
                      component: '_table_col',
                    },
                    {
                      _uid: randomUUID(),
                      value: '',
                      component: '_table_col',
                    },
                  ],
                  component: '_table_row',
                },
              ],
              thead: [
                {
                  _uid: randomUUID(),
                  value: '',
                  component: '_table_head',
                },
                {
                  _uid: randomUUID(),
                  value: '',
                  component: '_table_head',
                },
              ],
              fieldtype: 'table',
            },
            bloks: [],
            number: '',
            plugin: {
              _uid: randomUUID(),
              icon: '',
              type: 'fas',
              plugin: 'fontawesome-selector',
            },
            boolean: false,
            markdown: '',
            richtext: {
              type: 'doc',
              content: [
                {
                  type: 'bullet_list',
                  content: [
                    {
                      type: 'list_item',
                      content: [
                        {
                          type: 'paragraph',
                          attrs: {
                            textAlign: null,
                          },
                          content: [
                            {
                              text: 'Link',
                              type: 'text',
                              marks: [
                                {
                                  type: 'link',
                                  attrs: {
                                    href: '/de/everything-page',
                                    uuid: randomUUID(),
                                    anchor: null,
                                    target: '_self',
                                    linktype: 'story',
                                  },
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            textarea: '',
            component: 'page_with_everything',
            references: [],
            multi_assets: [],
            multi_options: [],
            single_option: '',
            richtext__i18n__de: {
              type: 'doc',
              content: [
                {
                  type: 'bullet_list',
                  content: [
                    {
                      type: 'list_item',
                      content: [
                        {
                          type: 'paragraph',
                          attrs: {
                            textAlign: null,
                          },
                          content: [
                            {
                              text: 'Verlinkung',
                              type: 'text',
                              marks: [
                                {
                                  type: 'link',
                                  attrs: {
                                    href: '/de/everything-page',
                                    uuid: randomUUID(),
                                    anchor: null,
                                    target: '_self',
                                    linktype: 'story',
                                  },
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
        number: '',
        plugin: {
          _uid: randomUUID(),
          icon: '',
          type: 'fas',
          plugin: 'fontawesome-selector',
        },
        boolean: false,
        markdown: '',
        richtext: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: null,
              },
              content: [
                {
                  text: 'Link',
                  type: 'text',
                  marks: [
                    {
                      type: 'link',
                      attrs: {
                        href: '/de/everything-page',
                        uuid: randomUUID(),
                        anchor: null,
                        target: '_self',
                        linktype: 'story',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        textarea: '',
        component: 'page_with_everything',
        references: [],
        multi_assets: [],
        multi_options: [],
        single_option: '',
      },
    ],
    number: '1',
    plugin: {
      _uid: randomUUID(),
      icon: 'fa-adjust',
      type: 'fas',
      plugin: 'fontawesome-selector',
    },
    boolean: true,
    markdown: '[Link](/de/everything-page)',
    richtext: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: {
            textAlign: null,
          },
          content: [
            {
              text: 'Link',
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: '/de/everything-page',
                    uuid: randomUUID(),
                    anchor: null,
                    target: '_self',
                    linktype: 'story',
                  },
                },
              ],
            },
          ],
        },
        {
          type: 'blok',
          attrs: {
            id: randomUUID(),
            body: [
              {
                _uid: randomUUID(),
                date: '',
                link: {
                  id: randomUUID(),
                  url: '',
                  linktype: 'story',
                  fieldtype: 'multilink',
                  cached_url: 'everything-page',
                },
                text: '',
                asset: {
                  id: null,
                  alt: null,
                  name: '',
                  focus: null,
                  title: null,
                  source: null,
                  filename: '',
                  copyright: null,
                  fieldtype: 'asset',
                  meta_data: {},
                },
                table: {
                  tbody: [
                    {
                      _uid: randomUUID(),
                      body: [
                        {
                          _uid: randomUUID(),
                          value: '',
                          component: '_table_col',
                        },
                        {
                          _uid: randomUUID(),
                          value: '',
                          component: '_table_col',
                        },
                      ],
                      component: '_table_row',
                    },
                  ],
                  thead: [
                    {
                      _uid: randomUUID(),
                      value: '',
                      component: '_table_head',
                    },
                    {
                      _uid: randomUUID(),
                      value: '',
                      component: '_table_head',
                    },
                  ],
                  fieldtype: 'table',
                },
                bloks: [],
                number: '',
                plugin: {
                  _uid: randomUUID(),
                  icon: '',
                  type: 'fas',
                  plugin: 'fontawesome-selector',
                },
                boolean: false,
                markdown: '',
                richtext: {
                  type: 'doc',
                  content: [
                    {
                      type: 'paragraph',
                    },
                  ],
                },
                textarea: '',
                component: 'page_with_everything',
                references: [],
                multi_assets: [],
                multi_options: [],
                single_option: '',
              },
            ],
          },
        },
      ],
    },
    textarea: 'Textarea',
    component: 'page_with_everything',
    references: [
      randomUUID(),
      randomUUID(),
    ],
    multi_assets: [
      {
        id: getID(),
        alt: 'Foo',
        name: '',
        focus: '',
        title: '',
        source: '',
        filename: 'https://a.storyblok.com/f/286708067665657/1930x1382/05079de471/component-spec.png',
        copyright: 'Markus Foo',
        fieldtype: 'asset',
        meta_data: {
          alt: 'Foo',
          title: '',
          source: '',
          copyright: 'Markus Foo',
        },
      },
    ],
    multi_options: [
      'a',
      'b',
    ],
    single_option: 'a',
    richtext__i18n__de: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: {
            textAlign: null,
          },
          content: [
            {
              text: 'Verlinkung',
              type: 'text',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: '/de/everything-page',
                    uuid: randomUUID(),
                    anchor: null,
                    target: '_self',
                    linktype: 'story',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  },
  published: true,
  slug: 'everything-page',
  path: null,
  full_slug: 'everything-page',
  default_root: null,
  disble_fe_editor: false,
  disable_fe_editor: false,
  parent: null,
  is_startpage: false,
  unpublished_changes: false,
  meta_data: null,
  imported_at: null,
  preview_token: {
    token: '24fa0ecf13df4537b53006a8632dd0e239c77360',
    timestamp: '1764765973',
  },
  pinned: false,
  breadcrumbs: [],
  publish_at: null,
  expire_at: null,
  first_published_at: '2025-12-03T12:41:38.662Z',
  last_author: {
    id: authorID,
    userid: 'monoblok@storyblok.com',
    friendly_name: 'Monoblok',
  },
  last_author_id: authorID,
  user_ids: [],
  space_role_ids: [],
  translated_slugs: [],
  localized_paths: [
    {
      path: 'everything-page',
      name: null,
      lang: 'de',
      published: null,
    },
  ],
  position: -30,
  translated_stories: [],
  can_not_view: false,
  is_scheduled: null,
  scheduled_dates: null,
  ideas: [],
  stage: null,
  favourite_for_user_ids: [],
} as const);

export const pageWithEverythingBlok = {
  name: 'page_with_everything',
  display_name: null,
  description: '',
  created_at: '2025-12-03T11:49:26.031Z',
  updated_at: '2025-12-03T12:42:09.575Z',
  id: 119082868868375,
  schema: {
    bloks: {
      type: 'bloks',
      pos: 0,
      id: 'd7GQ9nb-QwCCGaHnrbilBA',
    },
    text: {
      type: 'text',
      pos: 1,
      id: 'GP03GblQScmpsMvcUd29LA',
    },
    textarea: {
      type: 'textarea',
      pos: 2,
      id: 'IMoQMBkHRh6VbuLULygbcg',
    },
    richtext: {
      type: 'richtext',
      pos: 3,
      customize_toolbar: false,
      id: 'GYIPSeY6TvOF1iKKWGreRw',
      translatable: true,
    },
    markdown: {
      type: 'markdown',
      pos: 4,
      id: '_XsBAeyRQ8mw0ytdXONGMA',
    },
    number: {
      type: 'number',
      pos: 5,
      id: 'SU-DOs9kS6ihkHlJdUJwOA',
    },
    date: {
      type: 'datetime',
      pos: 6,
      id: 'xy48QLbcScqd7PG95AlvNA',
    },
    boolean: {
      type: 'boolean',
      pos: 7,
      id: 'gYvod6rIRfqC5Y-uGazS4A',
    },
    single_option: {
      type: 'option',
      pos: 8,
      use_uuid: true,
      id: '77sP-FI6TBqlk4eyVnWSzA',
      options: [
        {
          _uid: '97e9a29a-f2cc-429d-bcac-d8f17f45a73d',
          name: 'a',
          value: 'a',
        },
        {
          _uid: '8987342f-e38b-47fc-8110-ffcbf388d63e',
          value: 'b',
          name: 'b',
        },
      ],
    },
    multi_options: {
      type: 'options',
      pos: 9,
      options: [
        {
          _uid: '51313ec2-cf36-4a07-8e0a-a04bcf2d78b8',
          name: 'a',
          value: 'a',
        },
        {
          _uid: '00686ba5-400f-4ae6-9b5f-417a0cc16d6f',
          value: 'b',
          name: 'b',
        },
      ],
      id: 'cYGyeiEHQbKmzbneASFL_Q',
    },
    references: {
      type: 'options',
      pos: 10,
      is_reference_type: true,
      source: 'internal_stories',
      entry_appearance: 'card',
      allow_advanced_search: true,
      id: 'UaYphCPCTZ2k2N71HqkT8w',
    },
    asset: {
      type: 'asset',
      pos: 11,
      filetypes: [
        'images',
        'videos',
        'audios',
        'texts',
      ],
      id: 'fXtpfktoRl2rk80dW4JuJA',
    },
    multi_assets: {
      type: 'multiasset',
      pos: 12,
      id: '43QXuYTHQ4C_o7KPf8sbfQ',
    },
    link: {
      type: 'multilink',
      pos: 13,
      id: 'Bl7B7bs-QOO3B5M-zxlvtw',
    },
    table: {
      type: 'table',
      pos: 14,
      id: 'ZmUcdPpBQty01hX5O8pJRA',
    },
    group: {
      type: 'section',
      pos: 15,
      keys: [
        'link',
        'table',
      ],
      id: 'HXreVc0ESTOPsRK-D10c5A',
    },
    plugin: {
      type: 'custom',
      pos: 16,
      field_type: 'fontawesome-selector',
      options: [],
      id: 'PUkh2yrKQgyB7V_PxXNzlg',
    },
  },
  image: null,
  preview_field: null,
  is_root: true,
  preview_tmpl: null,
  is_nestable: true,
  all_presets: [],
  preset_id: null,
  real_name: 'page_with_everything',
  component_group_uuid: null,
  color: null,
  icon: null,
  internal_tags_list: [],
  internal_tag_ids: [],
  content_type_asset_preview: null,
  metadata: {},
} as const;
