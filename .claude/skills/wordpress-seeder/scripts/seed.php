<?php
/**
 * seed.php — single-process seeder for the WordPress migration playground.
 *
 * Run via: wp eval-file /scripts/seed.php
 *
 * Tunable via env vars (passed through by seed.sh):
 *   SBP_FORCE=1        — re-seed bulk content even if targets are already met
 *   SBP_SCALE=0.05     — multiplier on bulk counts (default 1.0)
 *
 * Phase 1 (always runs, idempotent):
 *   - Media ingestion (skips already-ingested)
 *   - Nav pages + home page (landing-page content)
 *   - Template part overrides (header + footer)
 *
 * Phase 2 (bounded by SBP_FORCE / count targets):
 *   - Users, taxonomy, posts, bulk pages, landing_page CPT
 *
 * Validated against PHP 8.3 / WordPress 6.9 / MariaDB 11.8.
 * mt_rand() sequence is deterministic on the above; may differ under other PHP versions.
 */

if (!defined('WP_CLI') || !WP_CLI) {
    die("must run via wp eval-file\n");
}

$force = (bool) getenv('SBP_FORCE');
$scale_env = getenv('SBP_SCALE');
$scale = ($scale_env !== false && $scale_env !== '') ? (float) $scale_env : 1.0;

$counts = [
    'users' => (int) round(20 * $scale),
    'categories' => (int) round(15 * $scale),
    'tags' => (int) round(60 * $scale),
    'media' => (int) round(30 * $scale),
    'posts' => (int) round(2000 * $scale),
    'pages' => (int) round(500 * $scale),
    'landing_pages' => (int) round(500 * $scale),
];

// Top-level nav pages. Header + footer template parts reference these;
// bulk seeded pages are their children so they stay out of the primary nav.
$nav_defs = [
    'blog'     => 'Blog',
    'about'    => 'About',
    'faqs'     => 'FAQs',
    'authors'  => 'Authors',
    'events'   => 'Events',
    'shop'     => 'Shop',
    'patterns' => 'Patterns',
    'themes'   => 'Themes',
];

mt_srand(42);

WP_CLI::log('Targets: ' . json_encode($counts));
$t0 = microtime(true);

// =========================================================================
// Text helpers (used everywhere below)
// =========================================================================
// `wp eval-file` wraps the whole script in eval'd scope so `global $foo`
// cannot see top-level locals. `static` inside each function sidesteps
// PHP's global scope entirely.

function sbp_lorem_pool(): array {
    static $pool = [
        'Lorem ipsum dolor sit amet', 'consectetur adipiscing elit', 'sed do eiusmod tempor',
        'incididunt ut labore et dolore', 'magna aliqua', 'ut enim ad minim veniam',
        'quis nostrud exercitation', 'ullamco laboris nisi', 'ut aliquip ex ea commodo',
        'duis aute irure dolor', 'in reprehenderit in voluptate', 'velit esse cillum dolore',
        'eu fugiat nulla pariatur', 'excepteur sint occaecat cupidatat', 'non proident',
        'sunt in culpa qui officia', 'deserunt mollit anim id est laborum',
        'praesent commodo cursus magna', 'scelerisque nisl consectetur et',
        'vivamus sagittis lacus vel augue', 'laoreet rutrum faucibus dolor auctor',
    ];
    return $pool;
}

function fake_phrase(int $min = 3, int $max = 7): string {
    $pool = sbp_lorem_pool();
    $n = mt_rand($min, $max);
    $words = [];
    for ($i = 0; $i < $n; $i++) {
        $parts = explode(' ', $pool[mt_rand(0, count($pool) - 1)]);
        $words[] = $parts[mt_rand(0, count($parts) - 1)];
    }
    return ucfirst(implode(' ', $words));
}

function fake_headline(): string {
    return fake_phrase(4, 8);
}

function fake_name(): string {
    $first = ['Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Casey', 'Robin', 'Jamie', 'Riley', 'Quinn'];
    $last  = ['Chen', 'Patel', 'Garcia', 'Müller', 'Smith', "O'Connor", 'Nakamura', 'Kowalski', 'Dupont', 'Rossi'];
    return $first[mt_rand(0, count($first) - 1)] . ' ' . $last[mt_rand(0, count($last) - 1)];
}

function fake_paragraph_text(): string {
    $pool = sbp_lorem_pool();
    $sentences = mt_rand(2, 5);
    $out = [];
    for ($i = 0; $i < $sentences; $i++) {
        $parts = [];
        $chunks = mt_rand(1, 3);
        for ($j = 0; $j < $chunks; $j++) {
            $parts[] = $pool[mt_rand(0, count($pool) - 1)];
        }
        $out[] = ucfirst(implode(', ', $parts)) . '.';
    }
    return implode(' ', $out);
}

/**
 * Paragraph with inline HTML markers on distinct word positions. Non-cascading
 * (no preg_replace over already-transformed text).
 */
function fake_inline_paragraph_html(): string {
    $text = fake_paragraph_text();
    $words = preg_split('/\s+/', $text);
    $n = count($words);
    if ($n < 5) {
        return esc_html($text);
    }
    $marker_count = mt_rand(1, 3);
    $markers = [
        fn(string $w) => '<strong>' . $w . '</strong>',
        fn(string $w) => '<em>' . $w . '</em>',
        fn(string $w) => '<a href="https://example.test/' . mt_rand(1, 999) . '">' . $w . '</a>',
        fn(string $w) => '<code>' . $w . '</code>',
    ];
    shuffle_array_stable($markers);

    $used = [];
    for ($i = 0; $i < $marker_count; $i++) {
        $attempts = 0;
        do {
            $idx = mt_rand(0, $n - 1);
            $attempts++;
        } while (in_array($idx, $used, true) && $attempts < 10);
        if (in_array($idx, $used, true)) {
            continue;
        }
        $used[] = $idx;
        if (preg_match('/^(\W*)(\w+)(\W*)$/u', $words[$idx], $parts)) {
            $safe = esc_html($parts[2]);
            $marker = $markers[$i % count($markers)];
            $words[$idx] = esc_html($parts[1]) . $marker($safe) . esc_html($parts[3]);
        }
    }
    foreach ($words as $idx => $w) {
        if (!in_array($idx, $used, true)) {
            $words[$idx] = esc_html($w);
        }
    }
    return implode(' ', $words);
}

function shuffle_array_stable(array &$arr): void {
    for ($i = count($arr) - 1; $i > 0; $i--) {
        $j = mt_rand(0, $i);
        [$arr[$i], $arr[$j]] = [$arr[$j], $arr[$i]];
    }
}

function fake_code_snippet(): string {
    $snippets = [
        'function hello(name) {' . "\n" . '  return `Hello, ${name}!`;' . "\n" . '}',
        'const sum = (a, b) => a + b;',
        'SELECT id, title FROM posts WHERE published = 1;',
        'if (user.isAdmin) { grantAccess(); }',
    ];
    return $snippets[mt_rand(0, count($snippets) - 1)];
}

// =========================================================================
// Gutenberg block builders
// =========================================================================

function block(string $type, array $attrs, ?string $inner = null): string {
    $attr_json = empty($attrs) ? '' : ' ' . json_encode($attrs, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($inner === null) {
        return "<!-- wp:$type$attr_json /-->";
    }
    return "<!-- wp:$type$attr_json -->\n$inner\n<!-- /wp:$type -->";
}

function block_paragraph_html(string $html): string {
    return block('paragraph', [], '<p>' . $html . '</p>');
}

function block_heading(string $text, int $level = 2, ?string $align = null): string {
    $attrs = [];
    if ($level !== 2) {
        $attrs['level'] = $level;
    }
    if ($align) {
        $attrs['textAlign'] = $align;
    }
    $class = 'wp-block-heading' . ($align ? ' has-text-align-' . $align : '');
    return block('heading', $attrs, '<h' . $level . ' class="' . $class . '">' . esc_html($text) . '</h' . $level . '>');
}

function block_list(bool $ordered = false): string {
    $items = [];
    $n = mt_rand(3, 6);
    for ($i = 0; $i < $n; $i++) {
        $items[] = block('list-item', [], '<li>' . esc_html(fake_phrase(3, 8)) . '</li>');
    }
    $tag = $ordered ? 'ol' : 'ul';
    $attrs = $ordered ? ['ordered' => true] : [];
    return block('list', $attrs, '<' . $tag . ' class="wp-block-list">' . "\n" . implode("\n", $items) . "\n" . '</' . $tag . '>');
}

function block_quote_seed(): string {
    return block('quote', [],
        '<blockquote class="wp-block-quote"><p>' . esc_html(fake_paragraph_text()) . '</p><cite>' . esc_html(fake_name()) . '</cite></blockquote>'
    );
}

function block_code_seed(): string {
    return block('code', [],
        '<pre class="wp-block-code"><code>' . esc_html(fake_code_snippet()) . '</code></pre>'
    );
}

function block_image(int $attachment_id, string $size_slug = 'large', ?string $caption = null): string {
    $src = wp_get_attachment_image_url($attachment_id, $size_slug);
    if (!$src) {
        $src = wp_get_attachment_url($attachment_id);
    }
    $meta = wp_get_attachment_metadata($attachment_id);
    $sizes = $meta['sizes'] ?? [];
    $width = isset($sizes[$size_slug]['width']) ? (int) $sizes[$size_slug]['width'] : ($meta['width'] ?? 0);
    $height = isset($sizes[$size_slug]['height']) ? (int) $sizes[$size_slug]['height'] : ($meta['height'] ?? 0);
    $wh_attr = ($width && $height) ? ' width="' . $width . '" height="' . $height . '"' : '';
    $alt = esc_attr(fake_phrase(3, 6));
    $cap = $caption !== null ? esc_html($caption) : esc_html(fake_phrase(4, 8));
    $figcap = $cap === '' ? '' : '<figcaption class="wp-element-caption">' . $cap . '</figcaption>';
    $inner = '<figure class="wp-block-image size-' . $size_slug . '"><img src="' . esc_url($src) . '" alt="' . $alt . '" class="wp-image-' . $attachment_id . '"' . $wh_attr . '/>' . $figcap . '</figure>';
    return block('image', ['id' => $attachment_id, 'sizeSlug' => $size_slug, 'linkDestination' => 'none'], $inner);
}

function block_table(): string {
    $rows = [];
    $nrows = mt_rand(3, 6);
    for ($i = 0; $i < $nrows; $i++) {
        $rows[] = '<tr><td>' . esc_html(fake_phrase(2, 4)) . '</td><td>' . mt_rand(1, 9999) . '</td></tr>';
    }
    $inner = '<figure class="wp-block-table"><table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>' . implode('', $rows) . '</tbody></table></figure>';
    return block('table', [], $inner);
}

function block_cover(string $title, string $subtitle, ?int $image_id): string {
    $attrs = ['dimRatio' => 50, 'minHeight' => 500, 'minHeightUnit' => 'px', 'isDark' => true];
    $bg_html = '';
    if ($image_id) {
        $url = wp_get_attachment_image_url($image_id, 'large') ?: wp_get_attachment_url($image_id);
        $attrs['url'] = $url;
        $attrs['id'] = $image_id;
        $bg_html = '<img class="wp-block-cover__image-background wp-image-' . $image_id . '" alt="" src="' . esc_url($url) . '" data-object-fit="cover"/>';
    }
    $inner_heading = block_heading($title, 1);
    $inner_para = block_paragraph_html(esc_html($subtitle));
    $inner_wrapper = '<div class="wp-block-cover__inner-container">' . "\n$inner_heading\n\n$inner_para\n" . '</div>';
    $wrapper = '<div class="wp-block-cover" style="min-height:500px">' . "\n"
        . '<span aria-hidden="true" class="wp-block-cover__background has-background-dim-50 has-background-dim"></span>'
        . ($bg_html ? "\n" . $bg_html : '')
        . "\n$inner_wrapper\n"
        . '</div>';
    return block('cover', $attrs, $wrapper);
}

function block_columns_text(array $column_contents): string {
    $columns_inner = [];
    foreach ($column_contents as $content) {
        $columns_inner[] = block('column', [], '<div class="wp-block-column">' . "\n$content\n" . '</div>');
    }
    $inner = '<div class="wp-block-columns">' . "\n" . implode("\n\n", $columns_inner) . "\n" . '</div>';
    return block('columns', [], $inner);
}

function block_gallery(array $image_ids): string {
    if (empty($image_ids)) {
        return '';
    }
    $image_blocks = [];
    foreach ($image_ids as $iid) {
        $image_blocks[] = block_image($iid, 'medium', '');
    }
    $inner = '<figure class="wp-block-gallery has-nested-images columns-default is-cropped">' . "\n" . implode("\n\n", $image_blocks) . "\n" . '</figure>';
    return block('gallery', ['linkTo' => 'none'], $inner);
}

function block_cta(string $heading, string $button_text, string $href): string {
    $h = block_heading($heading, 3);
    $button = block('button', [],
        '<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="' . esc_url($href) . '">' . esc_html($button_text) . '</a></div>'
    );
    $buttons = block('buttons', [], '<div class="wp-block-buttons">' . "\n$button\n" . '</div>');
    $inner = '<div class="wp-block-group">' . "\n$h\n\n$buttons\n" . '</div>';
    return block('group', [], $inner);
}

function block_embed_youtube(string $url): string {
    return block('embed', ['url' => $url, 'type' => 'video', 'providerNameSlug' => 'youtube', 'responsive' => true],
        '<figure class="wp-block-embed is-type-video is-provider-youtube"><div class="wp-block-embed__wrapper">' . esc_url($url) . '</div></figure>'
    );
}

// --- Landing-page sections ----------------------------------------------

function block_hero(string $title, string $subtitle, string $cta_label, string $cta_url, ?int $image_id): string {
    $attrs = ['className' => 'sbp-hero', 'dimRatio' => 60, 'minHeight' => 620, 'minHeightUnit' => 'px', 'isDark' => true, 'align' => 'full'];
    $bg_html = '';
    if ($image_id) {
        $url = wp_get_attachment_image_url($image_id, 'large') ?: wp_get_attachment_url($image_id);
        $attrs['url'] = $url;
        $attrs['id'] = $image_id;
        $bg_html = '<img class="wp-block-cover__image-background wp-image-' . $image_id . '" alt="" src="' . esc_url($url) . '" data-object-fit="cover"/>';
    }
    $heading = block_heading($title, 1, 'center');
    $para = block('paragraph', ['align' => 'center'],
        '<p class="has-text-align-center has-large-font-size">' . esc_html($subtitle) . '</p>'
    );
    $button = block('button', ['className' => 'is-style-fill'],
        '<div class="wp-block-button is-style-fill"><a class="wp-block-button__link wp-element-button" href="' . esc_url($cta_url) . '">' . esc_html($cta_label) . '</a></div>'
    );
    $buttons = block('buttons', ['layout' => ['type' => 'flex', 'justifyContent' => 'center']],
        '<div class="wp-block-buttons">' . "\n$button\n" . '</div>'
    );
    $inner_wrapper = '<div class="wp-block-cover__inner-container">' . "\n$heading\n\n$para\n\n$buttons\n" . '</div>';
    $wrapper = '<div class="wp-block-cover alignfull" style="min-height:620px">' . "\n"
        . '<span aria-hidden="true" class="wp-block-cover__background has-background-dim-60 has-background-dim"></span>'
        . ($bg_html ? "\n" . $bg_html : '')
        . "\n$inner_wrapper\n"
        . '</div>';
    return block('cover', $attrs, $wrapper);
}

function block_feature_grid(array $features): string {
    $cols = [];
    foreach ($features as [$h, $p]) {
        $cols[] = block_heading($h, 3) . "\n\n" . block_paragraph_html(esc_html($p));
    }
    $group = block_columns_text($cols);
    return block('group', ['className' => 'sbp-feature-grid', 'align' => 'wide', 'style' => ['spacing' => ['padding' => ['top' => 'var:preset|spacing|50', 'bottom' => 'var:preset|spacing|50']]], 'layout' => ['type' => 'constrained']],
        '<div class="wp-block-group alignwide" style="padding-top:var(--wp--preset--spacing--50);padding-bottom:var(--wp--preset--spacing--50)">' . "\n$group\n" . '</div>'
    );
}

function block_media_text(string $heading, string $text, ?int $image_id, bool $media_right = false): string {
    if (!$image_id) {
        return block('group', ['layout' => ['type' => 'constrained']],
            '<div class="wp-block-group">' . "\n"
            . block_heading($heading, 2) . "\n\n"
            . block_paragraph_html(esc_html($text)) . "\n"
            . '</div>'
        );
    }
    $src = wp_get_attachment_image_url($image_id, 'large') ?: wp_get_attachment_url($image_id);
    $attrs = ['align' => 'wide', 'mediaId' => $image_id, 'mediaType' => 'image', 'mediaSizeSlug' => 'large'];
    if ($media_right) {
        $attrs['mediaPosition'] = 'right';
    }
    $classes = 'wp-block-media-text alignwide is-stacked-on-mobile' . ($media_right ? ' has-media-on-the-right' : '');
    $media = '<figure class="wp-block-media-text__media"><img src="' . esc_url($src) . '" alt="" class="wp-image-' . $image_id . ' size-large"/></figure>';
    $content = '<div class="wp-block-media-text__content">' . "\n"
        . block_heading($heading, 2) . "\n\n"
        . block_paragraph_html(esc_html($text)) . "\n"
        . '</div>';
    $inner = $media_right
        ? $content . $media
        : $media . $content;
    return block('media-text', $attrs, '<div class="' . $classes . '">' . $inner . '</div>');
}

function block_stats_row(array $stats): string {
    $cols = [];
    foreach ($stats as [$num, $label]) {
        $cols[] = block('heading', ['level' => 2, 'textAlign' => 'center', 'style' => ['typography' => ['fontSize' => '3rem']]],
                '<h2 class="wp-block-heading has-text-align-center" style="font-size:3rem">' . esc_html($num) . '</h2>')
            . "\n\n" . block('paragraph', ['align' => 'center'],
                '<p class="has-text-align-center">' . esc_html($label) . '</p>');
    }
    $group = block_columns_text($cols);
    return block('group', ['className' => 'sbp-stats-row', 'align' => 'wide', 'style' => ['spacing' => ['padding' => ['top' => 'var:preset|spacing|60', 'bottom' => 'var:preset|spacing|60']]], 'layout' => ['type' => 'constrained']],
        '<div class="wp-block-group alignwide" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)">' . "\n$group\n" . '</div>'
    );
}

function block_testimonial(string $text, string $author): string {
    $quote = block('quote', ['align' => 'center', 'className' => 'is-style-large'],
        '<blockquote class="wp-block-quote has-text-align-center is-style-large"><p>&ldquo;' . esc_html($text) . '&rdquo;</p><cite>— ' . esc_html($author) . '</cite></blockquote>'
    );
    return block('group', ['className' => 'sbp-testimonial', 'align' => 'wide', 'style' => ['spacing' => ['padding' => ['top' => 'var:preset|spacing|60', 'bottom' => 'var:preset|spacing|60']]], 'layout' => ['type' => 'constrained']],
        '<div class="wp-block-group alignwide" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)">' . "\n$quote\n" . '</div>'
    );
}

function block_final_cta(string $heading, string $subtitle, string $cta_label, string $cta_url): string {
    $h = block_heading($heading, 2, 'center');
    $p = block('paragraph', ['align' => 'center'],
        '<p class="has-text-align-center">' . esc_html($subtitle) . '</p>'
    );
    $button = block('button', [],
        '<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="' . esc_url($cta_url) . '">' . esc_html($cta_label) . '</a></div>'
    );
    $buttons = block('buttons', ['layout' => ['type' => 'flex', 'justifyContent' => 'center']],
        '<div class="wp-block-buttons">' . "\n$button\n" . '</div>'
    );
    return block('group', ['className' => 'sbp-final-cta', 'align' => 'full', 'style' => ['spacing' => ['padding' => ['top' => 'var:preset|spacing|70', 'bottom' => 'var:preset|spacing|70']], 'color' => ['background' => '#111111']], 'textColor' => 'base', 'layout' => ['type' => 'constrained']],
        '<div class="wp-block-group alignfull has-base-color has-text-color has-background" style="background-color:#111111;padding-top:var(--wp--preset--spacing--70);padding-bottom:var(--wp--preset--spacing--70)">' . "\n$h\n\n$p\n\n$buttons\n" . '</div>'
    );
}

function block_separator(): string {
    return block('separator', ['className' => 'is-style-wide'],
        '<hr class="wp-block-separator has-alpha-channel-opacity is-style-wide"/>'
    );
}

// =========================================================================
// Landing-page copy catalog
// =========================================================================

function sbp_landing_catalog(): array {
    return [
        'home' => [
            'hero_title' => 'Migrate WordPress to Storyblok, the headless way',
            'hero_subtitle' => 'A realistic sandbox for testing content migrations end-to-end — seeded, reproducible, yours to break.',
            'hero_cta_label' => 'Start here',
            'hero_cta_url' => '/about/',
            'features' => [
                ['Real fixtures', 'Thousands of posts, pages, and block-composed landing pages to migrate against.'],
                ['Pure helpers', 'HTML-to-richtext conversion, asset ingestion, and reference remapping — no framework required.'],
                ['Reproducible dumps', 'Snapshot seeded state and replay against any Storyblok space.'],
            ],
            'media_heading' => 'Purpose-built for migration engineers',
            'media_text' => 'Compose realistic content in WordPress, exercise the migration helpers, and land clean data in Storyblok. No guesswork about edge cases.',
            'media_heading_2' => 'Design once, migrate everywhere',
            'media_text_2' => 'Block-based landing pages on the WordPress side map cleanly to Storyblok component structures — so your target schema stays in the driver\'s seat.',
            'stats' => [['3k+', 'fixture entries'], ['9', 'page templates'], ['100%', 'reproducible'], ['0', 'manual steps']],
            'quote_text' => 'The migration playground finally lets us iterate on our schema without manual copy-paste cycles.',
            'quote_author' => 'Migration engineer, Acme Inc.',
            'final_cta_heading' => 'Ready to migrate?',
            'final_cta_subtitle' => 'Spin up the playground, seed realistic content, and dry-run your migration in minutes.',
            'final_cta_label' => 'Read the playbook',
            'final_cta_url' => '/about/',
        ],
        'blog' => [
            'hero_title' => 'Writing about content migrations',
            'hero_subtitle' => 'Patterns, case studies, and tooling notes from the migration trenches.',
            'hero_cta_label' => 'Latest posts',
            'hero_cta_url' => '/?latest',
            'features' => [
                ['Pattern deep-dives', 'How teams shape schema, transform legacy HTML, and reconcile IDs at scale.'],
                ['Tooling notes', 'Release notes for the migration helpers, including the rough edges.'],
                ['Community stories', 'Engineers share how they survived their migration — and what they\'d change.'],
            ],
            'media_heading' => 'A weekly post, always concrete',
            'media_text' => 'No thought-leadership posturing. Every post walks through real code with real data, and links the repo.',
            'media_heading_2' => 'Field notes, not framework fan-fiction',
            'media_text_2' => 'We write what we wish we\'d read before our first migration: edge cases, trade-offs, and the decisions that actually mattered.',
            'stats' => [['52', 'posts / year'], ['12', 'authors'], ['3k', 'words / post'], ['0', 'clickbait']],
            'quote_text' => 'The one blog I read cover-to-cover each week.',
            'quote_author' => 'A subscriber',
            'final_cta_heading' => 'Subscribe to the weekly',
            'final_cta_subtitle' => 'One email, every Friday. Unsubscribe whenever.',
            'final_cta_label' => 'Sign me up',
            'final_cta_url' => '/about/',
        ],
        'about' => [
            'hero_title' => 'Built for engineers who migrate content',
            'hero_subtitle' => 'The Migration Playground exists so teams can practice, measure, and de-risk real-world content moves before they touch production.',
            'hero_cta_label' => 'See the docs',
            'hero_cta_url' => '/faqs/',
            'features' => [
                ['Our mission', 'Make content migrations boring — predictable, reversible, and observable.'],
                ['Our tools', 'Open-source helpers, a seeded WordPress stack, and reproducible dumps.'],
                ['Our principle', 'Don\'t ship a migration you haven\'t run twice on realistic data.'],
            ],
            'media_heading' => 'Designed around real migrations',
            'media_text' => 'Every block, every helper, every example comes from a migration we actually shipped — or watched fail.',
            'media_heading_2' => 'Open by default',
            'media_text_2' => 'Source is MIT-licensed. Issues land on GitHub. Roadmap is public. Pull requests are welcome.',
            'stats' => [['2021', 'project started'], ['48', 'contributors'], ['2.1k', 'GitHub stars'], ['MIT', 'license']],
            'quote_text' => 'I wish I\'d had this before our last three migrations.',
            'quote_author' => 'Staff engineer, a headless shop',
            'final_cta_heading' => 'Join the contributors',
            'final_cta_subtitle' => 'Issues, docs, and PRs welcome — no prior migration experience required.',
            'final_cta_label' => 'Contribute',
            'final_cta_url' => '/authors/',
        ],
        'faqs' => [
            'hero_title' => 'Questions we hear a lot',
            'hero_subtitle' => 'Short answers to the questions new Migration Playground users usually ask in the first hour.',
            'hero_cta_label' => 'Ask on GitHub',
            'hero_cta_url' => '/about/',
            'features' => [
                ['Is this production-ready?', 'The helpers are; the playground is for development only. Don\'t point it at a live database.'],
                ['Does it work offline?', 'Mostly — media ingestion needs picsum.photos. Swap to bundled fixtures to go fully offline.'],
                ['Can I migrate back?', 'Yes. Dumps are plain SQL + tarballs, so restores are vanilla WP workflow.'],
            ],
            'media_heading' => 'What about very large sites?',
            'media_text' => 'The helpers have been used on sites with 50k+ entries. Batching is manual for now; streaming is on the roadmap.',
            'media_heading_2' => 'Which Storyblok plan do I need?',
            'media_text_2' => 'Any plan with Management API access. The helpers use the standard CRUD endpoints — no premium features required.',
            'stats' => [['12', 'common pitfalls'], ['4', 'supported field types'], ['1', 'Slack channel'], ['~5min', 'setup time']],
            'quote_text' => 'The FAQ saved us a day of Slack back-and-forth.',
            'quote_author' => 'Tech lead, a news publisher',
            'final_cta_heading' => 'Still stuck?',
            'final_cta_subtitle' => 'Open a GitHub discussion — answers within 48h during weekdays.',
            'final_cta_label' => 'Open a discussion',
            'final_cta_url' => '/about/',
        ],
        'authors' => [
            'hero_title' => 'People behind the playground',
            'hero_subtitle' => 'Engineers, writers, and designers shipping code and documentation to make migrations easier.',
            'hero_cta_label' => 'Meet the team',
            'hero_cta_url' => '/about/',
            'features' => [
                ['Core maintainers', 'Three full-time engineers driving the helpers and CLI.'],
                ['Technical writers', 'Keeping the docs accurate and the examples real.'],
                ['Community contributors', 'Over 40 folks have shipped PRs since the project started.'],
            ],
            'media_heading' => 'How we work',
            'media_text' => 'Async by default, public issues, biweekly roadmap review. Decisions are documented in ADRs.',
            'media_heading_2' => 'Join the crew',
            'media_text_2' => 'We always have issues labelled "good first issue" — start there, or propose something new.',
            'stats' => [['3', 'maintainers'], ['48', 'contributors'], ['12', 'countries'], ['MIT', 'license']],
            'quote_text' => 'The maintainers actually review PRs.',
            'quote_author' => 'A repeat contributor',
            'final_cta_heading' => 'Contribute to the project',
            'final_cta_subtitle' => 'See the contributing guide on GitHub — takes about ten minutes to land your first PR.',
            'final_cta_label' => 'Start contributing',
            'final_cta_url' => '/about/',
        ],
        'events' => [
            'hero_title' => 'Migration talks and meetups',
            'hero_subtitle' => 'Conferences, community calls, and workshops where we talk about migrations, schema design, and tooling.',
            'hero_cta_label' => 'Upcoming events',
            'hero_cta_url' => '/shop/',
            'features' => [
                ['Conference talks', 'Submitted to content engineering, JAMstack, and open-source tracks.'],
                ['Community calls', 'First Thursday of every month, public Zoom, 45 minutes.'],
                ['Hands-on workshops', 'Quarterly, limited seats, bring a real migration problem.'],
            ],
            'media_heading' => 'What to expect from a workshop',
            'media_text' => 'Three hours, small groups, paired with a maintainer. Bring your schema or a dump of your source — we\'ll help you plan the migration.',
            'media_heading_2' => 'Recordings are free',
            'media_text_2' => 'Every talk and community call is published on YouTube afterwards, with slides and code links in the description.',
            'stats' => [['8', 'events / year'], ['120', 'workshop alumni'], ['24', 'recordings'], ['0', 'paywall']],
            'quote_text' => 'The workshop paid for itself in saved engineering hours.',
            'quote_author' => 'Engineering manager, a SaaS company',
            'final_cta_heading' => 'RSVP to the next community call',
            'final_cta_subtitle' => 'Next call: first Thursday of next month. Agenda posted a week in advance.',
            'final_cta_label' => 'Get the invite',
            'final_cta_url' => '/about/',
        ],
        'shop' => [
            'hero_title' => 'Support the project',
            'hero_subtitle' => 'Branded merchandise and a few licensed integrations — revenue keeps the open-source work going.',
            'hero_cta_label' => 'Browse the shop',
            'hero_cta_url' => '/patterns/',
            'features' => [
                ['T-shirts and stickers', 'Screen-printed, fair wages, ships worldwide from two warehouses.'],
                ['Commercial licenses', 'For teams that want to redistribute or rebrand the helpers.'],
                ['Sponsorship tiers', 'Logo on the homepage, plus priority triage on your issues.'],
            ],
            'media_heading' => 'Designed with care',
            'media_text' => 'Every item is something a maintainer actually uses. No AliExpress dropshipping, no "crypto-engineer-vibes" slogans.',
            'media_heading_2' => 'Ethical supply chain',
            'media_text_2' => 'Fair-wage manufacturing, recycled packaging, no single-use plastics. Carbon-neutral shipping by default.',
            'stats' => [['14', 'SKUs'], ['2', 'warehouses'], ['100%', 'cotton'], ['0', 'single-use plastics']],
            'quote_text' => 'Actually comfortable hoodie, rare for tech merch.',
            'quote_author' => 'A happy customer',
            'final_cta_heading' => 'Check out the new collection',
            'final_cta_subtitle' => 'Spring drop available now — limited run, as always.',
            'final_cta_label' => 'Shop the drop',
            'final_cta_url' => '/patterns/',
        ],
        'patterns' => [
            'hero_title' => 'Reusable migration patterns',
            'hero_subtitle' => 'Battle-tested recipes for common content migration problems — copy, adapt, adapt again.',
            'hero_cta_label' => 'Browse patterns',
            'hero_cta_url' => '/themes/',
            'features' => [
                ['Richtext conversion', 'HTML → Storyblok richtext with mark preservation and clean line breaks.'],
                ['Asset remapping', 'Point legacy URLs at new Storyblok asset IDs without breaking captions or alt text.'],
                ['Reference resolution', 'Translate internal links once the target story IDs exist.'],
            ],
            'media_heading' => 'Patterns, not frameworks',
            'media_text' => 'Each pattern is a short markdown doc plus a working example. No DSL to learn, no plugin to install.',
            'media_heading_2' => 'Copy into your repo',
            'media_text_2' => 'Patterns are designed to be forked. Own the code, tweak the edge cases for your data, ship.',
            'stats' => [['22', 'documented patterns'], ['6', 'languages'], ['~1hr', 'average adoption time'], ['MIT', 'license']],
            'quote_text' => 'I\'ve copied the richtext pattern into three projects.',
            'quote_author' => 'A freelance migration consultant',
            'final_cta_heading' => 'Contribute a pattern',
            'final_cta_subtitle' => 'See an edge case we haven\'t documented? Open a PR.',
            'final_cta_label' => 'Open a PR',
            'final_cta_url' => '/authors/',
        ],
        'themes' => [
            'hero_title' => 'Curated theme collection',
            'hero_subtitle' => 'Front-end starters that play nicely with the migrated content — Astro, Next.js, Nuxt, and SvelteKit.',
            'hero_cta_label' => 'Browse themes',
            'hero_cta_url' => '/patterns/',
            'features' => [
                ['Framework-agnostic', 'Each theme ships with the same content model, so migrating between stacks is trivial.'],
                ['Accessible by default', 'Keyboard-navigable, semantic HTML, ARIA labels, automated Axe checks in CI.'],
                ['SEO best practices', 'Structured data, canonical URLs, Open Graph, sitemap, RSS — all wired up.'],
            ],
            'media_heading' => 'Astro starter',
            'media_text' => 'Static by default, islands where you need interactivity. Pairs naturally with the WordPress-to-Storyblok flow.',
            'media_heading_2' => 'Not just Astro',
            'media_text_2' => 'Next.js, Nuxt, and SvelteKit starters share the same content schema, so you can switch stacks without re-doing the migration.',
            'stats' => [['4', 'frameworks'], ['100', 'Lighthouse score'], ['AA', 'WCAG level'], ['MIT', 'license']],
            'quote_text' => 'The Astro starter shaved a week off our rebuild.',
            'quote_author' => 'A front-end lead',
            'final_cta_heading' => 'Try a theme',
            'final_cta_subtitle' => 'Clone, run `pnpm dev`, point it at your Storyblok space. You\'re live in ten minutes.',
            'final_cta_label' => 'Get the starter',
            'final_cta_url' => '/patterns/',
        ],
    ];
}

/**
 * Compose a landing-page body from a copy record. Uses 2–3 images from the
 * provided pool, cycling with the page key so each page looks distinct.
 */
function build_landing_body(array $copy, array $image_ids, int $page_offset = 0): string {
    $n = count($image_ids);
    $hero_img = $n ? $image_ids[$page_offset % $n] : null;
    $media_img_1 = $n ? $image_ids[($page_offset + 1) % $n] : null;
    $media_img_2 = $n ? $image_ids[($page_offset + 2) % $n] : null;

    $blocks = [];
    $blocks[] = block_hero($copy['hero_title'], $copy['hero_subtitle'], $copy['hero_cta_label'], $copy['hero_cta_url'], $hero_img);
    $blocks[] = block_feature_grid($copy['features']);
    $blocks[] = block_separator();
    $blocks[] = block_media_text($copy['media_heading'], $copy['media_text'], $media_img_1, false);
    $blocks[] = block_media_text($copy['media_heading_2'], $copy['media_text_2'], $media_img_2, true);
    $blocks[] = block_stats_row($copy['stats']);
    $blocks[] = block_testimonial($copy['quote_text'], $copy['quote_author']);
    $blocks[] = block_final_cta($copy['final_cta_heading'], $copy['final_cta_subtitle'], $copy['final_cta_label'], $copy['final_cta_url']);
    return implode("\n\n", array_filter($blocks));
}

// =========================================================================
// Post content builders (posts / bulk pages / landing_page CPT)
// =========================================================================

function build_post_content_blocks(int $min_sections, int $max_sections, array $image_ids): string {
    $blocks = [];
    $blocks[] = block_heading(fake_headline(), 2);
    $blocks[] = block_paragraph_html(fake_inline_paragraph_html());

    $choices = ['paragraph', 'heading_para', 'list_ul', 'list_ol', 'quote', 'code', 'image', 'table', 'subheading_list'];
    $n = mt_rand($min_sections, $max_sections);
    for ($i = 0; $i < $n; $i++) {
        $choice = $choices[mt_rand(0, count($choices) - 1)];
        switch ($choice) {
            case 'paragraph':
                $blocks[] = block_paragraph_html(fake_inline_paragraph_html());
                break;
            case 'heading_para':
                $blocks[] = block_heading(fake_headline(), mt_rand(2, 3));
                $blocks[] = block_paragraph_html(fake_inline_paragraph_html());
                break;
            case 'list_ul':
                $blocks[] = block_list(false);
                break;
            case 'list_ol':
                $blocks[] = block_list(true);
                break;
            case 'quote':
                $blocks[] = block_quote_seed();
                break;
            case 'code':
                $blocks[] = block_code_seed();
                break;
            case 'image':
                if (!empty($image_ids)) {
                    $blocks[] = block_image($image_ids[array_rand($image_ids)]);
                }
                break;
            case 'table':
                $blocks[] = block_table();
                break;
            case 'subheading_list':
                $blocks[] = block_heading(fake_phrase(3, 6), 3);
                $blocks[] = block_list(false);
                break;
        }
    }
    return implode("\n\n", $blocks);
}

function build_landing_page_content(array $image_ids, int $seed_index): string {
    $blocks = [];
    $hero_image = !empty($image_ids) ? $image_ids[$seed_index % count($image_ids)] : null;
    $blocks[] = block_cover(fake_headline(), fake_phrase(6, 12), $hero_image);

    $available = ['columns', 'gallery', 'cta', 'quote', 'paragraph', 'embed', 'heading_para'];
    $pattern_count = mt_rand(3, 7);
    for ($i = 0; $i < $pattern_count; $i++) {
        $choice = $available[mt_rand(0, count($available) - 1)];
        switch ($choice) {
            case 'columns':
                $cols = [];
                $cn = mt_rand(2, 3);
                for ($c = 0; $c < $cn; $c++) {
                    $cols[] = block_heading(fake_phrase(2, 4), 3) . "\n\n" . block_paragraph_html(fake_inline_paragraph_html());
                }
                $blocks[] = block_columns_text($cols);
                break;
            case 'gallery':
                if (count($image_ids) >= 3) {
                    $sample_start = ($seed_index * 3) % max(1, count($image_ids) - 2);
                    $sample = array_slice($image_ids, $sample_start, 3);
                    $g = block_gallery($sample);
                    if ($g) {
                        $blocks[] = $g;
                    }
                }
                break;
            case 'cta':
                $blocks[] = block_cta(fake_headline(), 'Learn more', 'https://example.test/cta/' . mt_rand(1, 999));
                break;
            case 'quote':
                $blocks[] = block_quote_seed();
                break;
            case 'paragraph':
                $blocks[] = block_heading(fake_headline(), 2);
                $blocks[] = block_paragraph_html(fake_inline_paragraph_html());
                $blocks[] = block_paragraph_html(fake_inline_paragraph_html());
                break;
            case 'embed':
                $videos = ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=9bZkp7q19f0'];
                $blocks[] = block_embed_youtube($videos[mt_rand(0, count($videos) - 1)]);
                break;
            case 'heading_para':
                $blocks[] = block_heading(fake_headline(), 2);
                $blocks[] = block_paragraph_html(fake_inline_paragraph_html());
                break;
        }
    }
    $blocks[] = block_cta(fake_headline(), 'Get started', 'https://example.test/signup');
    return implode("\n\n", array_filter($blocks));
}

function insert_post_with_retry(array $data, ?string $meta_key = null, $meta_value = null): ?int {
    $id = wp_insert_post($data, true);
    if (is_wp_error($id)) {
        WP_CLI::warning('insert failed: ' . $id->get_error_message());
        return null;
    }
    if ($meta_key !== null) {
        update_post_meta((int) $id, $meta_key, $meta_value);
    }
    return (int) $id;
}

// =========================================================================
// Phase 1 — always runs (idempotent)
// =========================================================================

// --- Media ingestion (first, so landing pages can reference hero images) ---
WP_CLI::log('Ingesting media (picsum.photos)...');
require_once ABSPATH . 'wp-admin/includes/media.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/image.php';

$attachment_ids = [];
$existing_attachments = get_posts([
    'post_type' => 'attachment',
    'posts_per_page' => -1,
    'post_status' => 'inherit',
    'fields' => 'ids',
    'meta_key' => '_sbp_seed_index',
]);
foreach ($existing_attachments as $aid) {
    $attachment_ids[] = (int) $aid;
}
for ($i = count($attachment_ids) + 1; $i <= $counts['media']; $i++) {
    $url = "https://picsum.photos/seed/sbp-$i/1200/800.jpg";
    $id = media_sideload_image($url, 0, "Seed image $i", 'id');
    if (is_wp_error($id)) {
        WP_CLI::warning("media $i: " . $id->get_error_message());
        continue;
    }
    update_post_meta((int) $id, '_sbp_seed_index', $i);
    $attachment_ids[] = (int) $id;
    if ($i % 10 === 0) {
        WP_CLI::log("  media $i/{$counts['media']}");
    }
}
WP_CLI::log('Attachments: ' . count($attachment_ids));

// --- Nav pages + home page --------------------------------------------------
$catalog = sbp_landing_catalog();

$upsert_page = function (string $slug, string $title, string $content, int $menu_order = 0): int {
    $existing = get_page_by_path($slug);
    if ($existing && $existing->post_type === 'page') {
        wp_update_post([
            'ID' => $existing->ID,
            'post_title' => $title,
            'post_content' => $content,
            'menu_order' => $menu_order,
        ]);
        return (int) $existing->ID;
    }
    $id = wp_insert_post([
        'post_title' => $title,
        'post_name' => $slug,
        'post_content' => $content,
        'post_status' => 'publish',
        'post_type' => 'page',
        'menu_order' => $menu_order,
    ]);
    return is_wp_error($id) ? 0 : (int) $id;
};

WP_CLI::log('Seeding nav pages with landing content...');
$nav_page_ids = [];
$order = 1;
foreach ($nav_defs as $slug => $title) {
    $copy = $catalog[$slug] ?? null;
    if (!$copy) {
        $order++;
        continue;
    }
    $content = build_landing_body($copy, $attachment_ids, $order);
    $nav_page_ids[$slug] = $upsert_page($slug, $title, $content, $order);
    $order++;
}
$nav_page_id_list = array_values($nav_page_ids);
$nav_slug_list = array_keys($nav_page_ids);

WP_CLI::log('Seeding home page...');
$home_copy = $catalog['home'];
$home_content = build_landing_body($home_copy, $attachment_ids, 0);
$home_id = $upsert_page('home', 'Home', $home_content, 0);

// Delete WP defaults so nav / search results stay focused.
foreach (['sample-page', 'privacy-policy'] as $default_slug) {
    $page = get_page_by_path($default_slug);
    if ($page && $page->post_type === 'page'
        && !in_array($page->ID, $nav_page_id_list, true)
        && $page->ID !== $home_id) {
        wp_delete_post($page->ID, true);
    }
}

// Front-page wiring: `/` → Home landing, `/blog/` → posts archive.
if ($home_id) {
    update_option('show_on_front', 'page');
    update_option('page_on_front', $home_id);
    if (!empty($nav_page_ids['blog'])) {
        update_option('page_for_posts', $nav_page_ids['blog']);
    }
}

// --- Template part overrides (header + footer with real nav links) ---
WP_CLI::log('Writing header/footer template part overrides...');

$header_nav_links = [];
foreach ($nav_slug_list as $slug) {
    $header_nav_links[] = '<!-- wp:navigation-link {"label":"' . esc_html($nav_defs[$slug]) . '","url":"/' . $slug . '/","kind":"custom","isTopLevelLink":true} /-->';
}
$header_nav_block = '<!-- wp:navigation {"overlayBackgroundColor":"base","overlayTextColor":"contrast","layout":{"type":"flex","justifyContent":"right","flexWrap":"wrap"}} -->' . "\n" . implode("\n\n", $header_nav_links) . "\n" . '<!-- /wp:navigation -->';

$header_content = <<<BLOCKS
<!-- wp:group {"align":"full","layout":{"type":"default"}} -->
<div class="wp-block-group alignfull">
<!-- wp:group {"layout":{"type":"constrained"}} -->
<div class="wp-block-group">
<!-- wp:group {"align":"wide","style":{"spacing":{"padding":{"top":"var:preset|spacing|30","bottom":"var:preset|spacing|30"}}},"layout":{"type":"flex","flexWrap":"nowrap","justifyContent":"space-between"}} -->
<div class="wp-block-group alignwide" style="padding-top:var(--wp--preset--spacing--30);padding-bottom:var(--wp--preset--spacing--30)">
<!-- wp:site-title {"level":0} /-->
<!-- wp:group {"style":{"spacing":{"blockGap":"var:preset|spacing|10"}},"layout":{"type":"flex","flexWrap":"nowrap","justifyContent":"right"}} -->
<div class="wp-block-group">
{$header_nav_block}
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->
BLOCKS;

$footer_nav_columns = [
    ['blog', 'about', 'faqs', 'authors'],
    ['events', 'shop', 'patterns', 'themes'],
];
$footer_nav_blocks = [];
foreach ($footer_nav_columns as $col) {
    $links = [];
    foreach ($col as $slug) {
        if (!isset($nav_page_ids[$slug])) {
            continue;
        }
        $links[] = '<!-- wp:navigation-link {"label":"' . esc_html($nav_defs[$slug]) . '","url":"/' . $slug . '/","kind":"custom","isTopLevelLink":true} /-->';
    }
    $footer_nav_blocks[] = '<!-- wp:navigation {"overlayMenu":"never","layout":{"type":"flex","orientation":"vertical"}} -->' . "\n" . implode("\n\n", $links) . "\n" . '<!-- /wp:navigation -->';
}

$footer_content = <<<BLOCKS
<!-- wp:group {"style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|50"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--50)">
<!-- wp:group {"align":"wide","layout":{"type":"default"}} -->
<div class="wp-block-group alignwide">
<!-- wp:site-logo /-->

<!-- wp:group {"align":"full","layout":{"type":"flex","flexWrap":"wrap","justifyContent":"space-between","verticalAlignment":"top"}} -->
<div class="wp-block-group alignfull">
<!-- wp:columns -->
<div class="wp-block-columns"><!-- wp:column {"width":"100%"} -->
<div class="wp-block-column" style="flex-basis:100%"><!-- wp:site-title {"level":2} /-->

<!-- wp:site-tagline /--></div>
<!-- /wp:column -->

<!-- wp:column {"width":""} -->
<div class="wp-block-column"><!-- wp:spacer {"height":"var:preset|spacing|40","width":"0px"} -->
<div style="height:var(--wp--preset--spacing--40);width:0px" aria-hidden="true" class="wp-block-spacer"></div>
<!-- /wp:spacer --></div>
<!-- /wp:column --></div>
<!-- /wp:columns -->

<!-- wp:group {"style":{"spacing":{"blockGap":"var:preset|spacing|80"}},"layout":{"type":"flex","flexWrap":"wrap","verticalAlignment":"top","justifyContent":"space-between"}} -->
<div class="wp-block-group">
{$footer_nav_blocks[0]}

{$footer_nav_blocks[1]}
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->

<!-- wp:spacer {"height":"var:preset|spacing|70"} -->
<div style="height:var(--wp--preset--spacing--70)" aria-hidden="true" class="wp-block-spacer"></div>
<!-- /wp:spacer -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:group -->
BLOCKS;

$upsert_template_part = function (string $slug, string $area, string $title, string $content): int {
    $theme = get_stylesheet();
    $q = new WP_Query([
        'post_type' => 'wp_template_part',
        'name' => $slug,
        'tax_query' => [
            [
                'taxonomy' => 'wp_theme',
                'field' => 'name',
                'terms' => $theme,
            ],
        ],
        'posts_per_page' => 1,
        'no_found_rows' => true,
    ]);
    if ($q->have_posts()) {
        $existing_id = (int) $q->posts[0]->ID;
        wp_update_post([
            'ID' => $existing_id,
            'post_content' => $content,
        ]);
        return $existing_id;
    }
    $id = wp_insert_post([
        'post_type' => 'wp_template_part',
        'post_name' => $slug,
        'post_title' => $title,
        'post_status' => 'publish',
        'post_content' => $content,
    ]);
    if (is_wp_error($id)) {
        WP_CLI::warning('template_part ' . $slug . ': ' . $id->get_error_message());
        return 0;
    }
    wp_set_object_terms((int) $id, $theme, 'wp_theme');
    wp_set_object_terms((int) $id, $area, 'wp_template_part_area');
    return (int) $id;
};

$upsert_template_part('header', 'header', 'Header', $header_content);
$upsert_template_part('footer', 'footer', 'Footer', $footer_content);

// --- wp_template overrides: render landing pages without the page title ---
// The default `page.html` template stamps `<!-- wp:post-title -->` above the
// content, which duplicates the hero heading on our landing pages. Providing
// per-slug templates (front-page for home + page-{slug} for each nav page)
// skips the title and hands rendering straight to the block content.
$upsert_template = function (string $slug, string $title, string $content): int {
    $theme = get_stylesheet();
    $q = new WP_Query([
        'post_type' => 'wp_template',
        'name' => $slug,
        'tax_query' => [
            [
                'taxonomy' => 'wp_theme',
                'field' => 'name',
                'terms' => $theme,
            ],
        ],
        'posts_per_page' => 1,
        'no_found_rows' => true,
    ]);
    if ($q->have_posts()) {
        $existing_id = (int) $q->posts[0]->ID;
        wp_update_post([
            'ID' => $existing_id,
            'post_content' => $content,
        ]);
        return $existing_id;
    }
    $id = wp_insert_post([
        'post_type' => 'wp_template',
        'post_name' => $slug,
        'post_title' => $title,
        'post_status' => 'publish',
        'post_content' => $content,
    ]);
    if (is_wp_error($id)) {
        WP_CLI::warning('template ' . $slug . ': ' . $id->get_error_message());
        return 0;
    }
    wp_set_object_terms((int) $id, $theme, 'wp_theme');
    return (int) $id;
};

$theme_slug = get_stylesheet();
$landing_template_content = <<<BLOCKS
<!-- wp:template-part {"slug":"header","theme":"{$theme_slug}","tagName":"header"} /-->

<!-- wp:post-content {"layout":{"type":"constrained"}} /-->

<!-- wp:template-part {"slug":"footer","theme":"{$theme_slug}","tagName":"footer"} /-->
BLOCKS;

$upsert_template('front-page', 'Front Page', $landing_template_content);
foreach ($nav_slug_list as $slug) {
    $upsert_template('page-' . $slug, 'Landing: ' . ucfirst($slug), $landing_template_content);
}

// =========================================================================
// Phase 2 — bulk seeding (expensive; bounded by idempotency guard)
// =========================================================================

$existing = [
    'posts' => (int) (wp_count_posts('post')->publish ?? 0),
    'pages' => (int) (wp_count_posts('page')->publish ?? 0),
    'landing_pages' => (int) (wp_count_posts('landing_page')->publish ?? 0),
];

// Baseline pages to subtract from count (nav pages + home, not bulk).
$baseline_pages = count($nav_page_ids) + ($home_id ? 1 : 0);
$bulk_pages_existing = max(0, $existing['pages'] - $baseline_pages);

$need_bulk = $force
    || $existing['posts'] < $counts['posts']
    || $bulk_pages_existing < $counts['pages']
    || $existing['landing_pages'] < $counts['landing_pages'];

if (!$need_bulk) {
    WP_CLI::success("Phase 1 done; bulk content already seeded (posts={$existing['posts']}, bulk_pages={$bulk_pages_existing}, landing_pages={$existing['landing_pages']}). Set SBP_FORCE=1 to re-seed.");
    return;
}

wp_defer_term_counting(true);
wp_defer_comment_counting(true);
wp_suspend_cache_invalidation(true);

// --- Users --------------------------------------------------------------
WP_CLI::log('Seeding users...');
$author_ids = [];
for ($i = 1; $i <= $counts['users']; $i++) {
    $login = sprintf('author%02d', $i);
    $existing_user = get_user_by('login', $login);
    if ($existing_user) {
        $author_ids[] = (int) $existing_user->ID;
        continue;
    }
    $id = wp_insert_user([
        'user_login' => $login,
        'user_pass' => wp_generate_password(16, false),
        'user_email' => "$login@example.test",
        'display_name' => "Author $i",
        'role' => 'author',
    ]);
    if (is_wp_error($id)) {
        WP_CLI::warning("user $login: " . $id->get_error_message());
        continue;
    }
    $author_ids[] = (int) $id;
}
WP_CLI::log('Users: ' . count($author_ids));

// --- Taxonomy -----------------------------------------------------------
WP_CLI::log('Seeding taxonomy...');
$category_ids = [];
for ($i = 1; $i <= $counts['categories']; $i++) {
    $name = "Category $i";
    $term = term_exists($name, 'category');
    if (!$term) {
        $term = wp_insert_term($name, 'category', ['slug' => sanitize_title($name)]);
    }
    if (is_array($term) && !empty($term['term_id'])) {
        $category_ids[] = (int) $term['term_id'];
    }
}
$tag_ids = [];
for ($i = 1; $i <= $counts['tags']; $i++) {
    $name = "tag-$i";
    $term = term_exists($name, 'post_tag');
    if (!$term) {
        $term = wp_insert_term($name, 'post_tag', ['slug' => sanitize_title($name)]);
    }
    if (is_array($term) && !empty($term['term_id'])) {
        $tag_ids[] = (int) $term['term_id'];
    }
}
WP_CLI::log('Categories: ' . count($category_ids) . ', Tags: ' . count($tag_ids));

// --- Posts --------------------------------------------------------------
WP_CLI::log("Seeding {$counts['posts']} posts...");
$posts_to_create = max(0, $counts['posts'] - $existing['posts']);
for ($i = 1; $i <= $posts_to_create; $i++) {
    $title = ucfirst(fake_phrase(3, 7));
    $author_id = $author_ids[$i % max(1, count($author_ids))] ?? 1;
    $cat = !empty($category_ids) ? [$category_ids[$i % count($category_ids)]] : [];
    $tags_pick = [];
    if (!empty($tag_ids)) {
        $picks = mt_rand(1, 4);
        for ($t = 0; $t < $picks; $t++) {
            $tags_pick[] = $tag_ids[mt_rand(0, count($tag_ids) - 1)];
        }
    }
    $id = insert_post_with_retry([
        'post_title' => $title,
        'post_name' => sanitize_title($title . '-' . $i),
        'post_content' => build_post_content_blocks(4, 9, $attachment_ids),
        'post_excerpt' => fake_paragraph_text(),
        'post_status' => 'publish',
        'post_type' => 'post',
        'post_author' => $author_id,
        'post_category' => $cat,
        'tags_input' => $tags_pick,
    ], '_sbp_seed_kind', 'post');
    if ($id && !empty($attachment_ids)) {
        set_post_thumbnail($id, $attachment_ids[$i % count($attachment_ids)]);
    }
    if ($i % 250 === 0) {
        wp_cache_flush();
        WP_CLI::log("  post $i/$posts_to_create");
    }
}

// --- Bulk pages (children of nav pages) --------------------------------
WP_CLI::log("Seeding {$counts['pages']} bulk pages (children of nav pages)...");
$pages_to_create = max(0, $counts['pages'] - $bulk_pages_existing);
for ($i = 1; $i <= $pages_to_create; $i++) {
    $title = ucfirst(fake_phrase(2, 5));
    $author_id = $author_ids[$i % max(1, count($author_ids))] ?? 1;
    $parent_slug = $nav_slug_list[$i % max(1, count($nav_slug_list))] ?? null;
    $parent_id = $parent_slug ? ($nav_page_ids[$parent_slug] ?? 0) : 0;
    insert_post_with_retry([
        'post_title' => $title,
        'post_name' => sanitize_title($title . '-bulk-' . $i),
        'post_content' => build_post_content_blocks(5, 10, $attachment_ids),
        'post_status' => 'publish',
        'post_type' => 'page',
        'post_author' => $author_id,
        'post_parent' => $parent_id,
    ], '_sbp_seed_kind', 'page');
    if ($i % 250 === 0) {
        wp_cache_flush();
        WP_CLI::log("  page $i/$pages_to_create");
    }
}

// --- Landing pages (CPT) -----------------------------------------------
WP_CLI::log("Seeding {$counts['landing_pages']} landing_page CPT entries...");
$lps_to_create = max(0, $counts['landing_pages'] - $existing['landing_pages']);
for ($i = 1; $i <= $lps_to_create; $i++) {
    $title = 'Landing: ' . ucfirst(fake_phrase(2, 4));
    $author_id = $author_ids[$i % max(1, count($author_ids))] ?? 1;
    $content = build_landing_page_content($attachment_ids, $i);
    insert_post_with_retry([
        'post_title' => $title,
        'post_name' => sanitize_title($title . '-' . $i),
        'post_content' => $content,
        'post_status' => 'publish',
        'post_type' => 'landing_page',
        'post_author' => $author_id,
    ], '_sbp_seed_kind', 'landing_page');
    if ($i % 100 === 0) {
        wp_cache_flush();
        WP_CLI::log("  landing_page $i/$lps_to_create");
    }
}

wp_suspend_cache_invalidation(false);
wp_defer_term_counting(false);
wp_defer_comment_counting(false);
wp_cache_flush();

$elapsed = round(microtime(true) - $t0, 1);
$final = [
    'posts' => (int) (wp_count_posts('post')->publish ?? 0),
    'pages' => (int) (wp_count_posts('page')->publish ?? 0),
    'landing_pages' => (int) (wp_count_posts('landing_page')->publish ?? 0),
    'attachments' => (int) (wp_count_posts('attachment')->inherit ?? 0),
    'users' => (int) count_users()['total_users'],
    'nav_pages' => count($nav_page_ids),
    'home_page_id' => $home_id,
];

WP_CLI::success("Seed done in {$elapsed}s. Totals: " . json_encode($final));
