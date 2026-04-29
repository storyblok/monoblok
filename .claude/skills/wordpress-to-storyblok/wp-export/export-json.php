<?php
/**
 * Exports a WordPress install as JSON in the canonical shape the
 * `wordpress-to-storyblok` Claude skill expects.
 *
 * Usage (against a Docker WP):
 *   docker compose run --rm -e SBP_DUMP_DIR=/host-data/json wp-cli wp eval-file /scripts/export-json.php
 *
 * Usage (against any WP via wp-cli on the host):
 *   SBP_DUMP_DIR=/path/to/dump/json wp eval-file /path/to/export-json.php
 *
 * Writes one file per content type into $SBP_DUMP_DIR:
 *   posts.json, pages.json, <custom-post-type>.json, attachments.json, terms.json, users.json
 *
 * Also copies WordPress upload binaries into the sibling uploads directory by
 * default. Example: SBP_DUMP_DIR=/host-data/json writes binaries to
 * /host-data/uploads. Override with SBP_UPLOADS_DIR when needed.
 */

$dump_dir = getenv('SBP_DUMP_DIR') ?: '/host-data/json';
if (!is_dir($dump_dir)) {
    if (!mkdir($dump_dir, 0755, true) && !is_dir($dump_dir)) {
        fwrite(STDERR, "Cannot create $dump_dir\n");
        exit(1);
    }
}

function sbp_json_encode($data) {
    return json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

function sbp_flatten_meta($raw) {
    $flat = [];
    foreach ($raw as $k => $v) {
        if (strpos($k, '_') === 0) {
            continue;
        }
        if (is_array($v) && count($v) === 1) {
            $flat[$k] = maybe_unserialize($v[0]);
        } else {
            $flat[$k] = array_map('maybe_unserialize', $v);
        }
    }
    return $flat;
}

function sbp_copy_uploads($source_dir, $dest_dir) {
    if (!is_dir($source_dir)) {
        fwrite(STDERR, "Uploads source does not exist: $source_dir\n");
        return [0, 0];
    }
    if (!is_dir($dest_dir) && !mkdir($dest_dir, 0755, true) && !is_dir($dest_dir)) {
        fwrite(STDERR, "Cannot create uploads destination: $dest_dir\n");
        return [0, 0];
    }

    $source_real = realpath($source_dir);
    $dest_real = realpath($dest_dir);
    if ($source_real !== false && $dest_real !== false && strpos($dest_real, $source_real . DIRECTORY_SEPARATOR) === 0) {
        fwrite(STDERR, "Refusing to copy uploads into a child of the source directory: $dest_dir\n");
        return [0, 0];
    }

    $files = 0;
    $bytes = 0;
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($source_dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($iterator as $item) {
        $relative = substr($item->getPathname(), strlen(rtrim($source_dir, DIRECTORY_SEPARATOR)) + 1);
        $target = $dest_dir . DIRECTORY_SEPARATOR . $relative;
        if ($item->isDir()) {
            if (!is_dir($target)) {
                mkdir($target, 0755, true);
            }
            continue;
        }
        $target_dir = dirname($target);
        if (!is_dir($target_dir)) {
            mkdir($target_dir, 0755, true);
        }
        if (@copy($item->getPathname(), $target)) {
            $files++;
            $bytes += $item->getSize();
        } else {
            fwrite(STDERR, "Failed to copy upload binary: " . $item->getPathname() . "\n");
        }
    }

    return [$files, $bytes];
}

function sbp_export_post_type($type, $dump_dir) {
    $posts = get_posts([
        'post_type'   => $type,
        'post_status' => 'any',
        'numberposts' => -1,
        'orderby'     => 'ID',
        'order'       => 'ASC',
    ]);
    $out = [];
    foreach ($posts as $p) {
        $terms_by_tax = [];
        foreach (get_object_taxonomies($type) as $tax) {
            $term_ids = wp_get_post_terms($p->ID, $tax, ['fields' => 'ids']);
            if (!is_wp_error($term_ids) && !empty($term_ids)) {
                $terms_by_tax[$tax] = array_map('intval', $term_ids);
            }
        }
        $out[] = [
            'ID'           => (int) $p->ID,
            'post_title'   => $p->post_title,
            'post_name'    => $p->post_name,
            'post_type'    => $p->post_type,
            'post_status'  => $p->post_status,
            'post_date'    => $p->post_date,
            'post_parent'  => (int) $p->post_parent,
            'post_author'  => (int) $p->post_author,
            'post_content' => $p->post_content,
            'featured_image_id' => ($thumb = (int) get_post_thumbnail_id($p->ID)) ? $thumb : null,
            'meta'         => (object) sbp_flatten_meta(get_post_meta($p->ID)),
            'terms'        => (object) $terms_by_tax,
        ];
    }
    $name = ($type === 'post') ? 'posts.json' : (($type === 'page') ? 'pages.json' : "{$type}.json");
    file_put_contents("$dump_dir/$name", sbp_json_encode($out));
    echo "Wrote $name (" . count($out) . " items)\n";
}

// Post types (public + queryable; covers builtin + custom).
$post_types = get_post_types(['public' => true], 'names');
foreach ($post_types as $type) {
    if ($type === 'attachment') {
        continue;
    }
    sbp_export_post_type($type, $dump_dir);
}

// Attachments.
$attachments_raw = get_posts([
    'post_type'   => 'attachment',
    'post_status' => 'inherit',
    'numberposts' => -1,
    'orderby'     => 'ID',
    'order'       => 'ASC',
]);
$attachments = [];
foreach ($attachments_raw as $a) {
    $file_path = get_post_meta($a->ID, '_wp_attached_file', true);
    $alt       = get_post_meta($a->ID, '_wp_attachment_image_alt', true);
    $focal_x   = get_post_meta($a->ID, '_wp_attachment_image_focal_x', true);
    $focal_y   = get_post_meta($a->ID, '_wp_attachment_image_focal_y', true);
    $attachments[] = [
        'ID'        => (int) $a->ID,
        'guid'      => $a->guid,
        'mime'      => $a->post_mime_type,
        'alt'       => $alt ?: '',
        'focal_x'   => ($focal_x !== '' && $focal_x !== false) ? (float) $focal_x : null,
        'focal_y'   => ($focal_y !== '' && $focal_y !== false) ? (float) $focal_y : null,
        'file_path' => $file_path ?: null,
    ];
}
file_put_contents("$dump_dir/attachments.json", sbp_json_encode($attachments));
echo "Wrote attachments.json (" . count($attachments) . " items)\n";

$upload_info = wp_upload_dir();
$uploads_source = $upload_info['basedir'] ?? null;
$uploads_dest = getenv('SBP_UPLOADS_DIR');
if (!$uploads_dest) {
    $uploads_dest = (basename($dump_dir) === 'json') ? dirname($dump_dir) . '/uploads' : $dump_dir . '/uploads';
}
if ($uploads_source) {
    [$copied_files, $copied_bytes] = sbp_copy_uploads($uploads_source, $uploads_dest);
    echo "Copied uploads ($copied_files files, $copied_bytes bytes) to $uploads_dest\n";
}
else {
    fwrite(STDERR, "Cannot resolve WordPress uploads directory via wp_upload_dir().\n");
}

// Taxonomies + terms.
$terms = [];
foreach (get_taxonomies(['public' => true], 'names') as $tax) {
    $terms_in_tax = get_terms(['taxonomy' => $tax, 'hide_empty' => false]);
    if (is_wp_error($terms_in_tax) || empty($terms_in_tax)) {
        continue;
    }
    $terms[$tax] = array_map(function ($t) {
        return [
            'term_id'     => (int) $t->term_id,
            'name'        => $t->name,
            'slug'        => $t->slug,
            'parent_id'   => (int) $t->parent,
            'description' => $t->description,
        ];
    }, $terms_in_tax);
}
file_put_contents("$dump_dir/terms.json", sbp_json_encode($terms));
echo "Wrote terms.json (" . count($terms) . " taxonomies)\n";

// Users.
$users = [];
foreach (get_users() as $u) {
    $users[] = [
        'ID'           => (int) $u->ID,
        'login'        => $u->user_login,
        'display_name' => $u->display_name,
        'email'        => $u->user_email,
    ];
}
file_put_contents("$dump_dir/users.json", sbp_json_encode($users));
echo "Wrote users.json (" . count($users) . " items)\n";

echo "\nExport complete: $dump_dir\n";
