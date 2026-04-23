<?php
/**
 * Plugin Name: Storyblok Migration Playground
 * Description: Registers the landing_page custom post type used by the migration playground seeder.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('init', function () {
    register_post_type('landing_page', [
        'label' => 'Landing Pages',
        'labels' => [
            'name' => 'Landing Pages',
            'singular_name' => 'Landing Page',
            'menu_name' => 'Landing Pages',
            'add_new_item' => 'Add New Landing Page',
            'edit_item' => 'Edit Landing Page',
        ],
        'public' => true,
        'has_archive' => true,
        'show_in_rest' => true,
        'menu_position' => 20,
        'menu_icon' => 'dashicons-layout',
        'supports' => ['title', 'editor', 'thumbnail', 'custom-fields', 'revisions'],
        'rewrite' => ['slug' => 'landing'],
    ]);
});
