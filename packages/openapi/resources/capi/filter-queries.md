# Filter Queries

Filter by (a) specific field(s) of your story type using nested query parameters.

## Overview

Filter queries allow you to perform complex filtering operations on your Storyblok content using nested query parameters. This is more powerful than basic query parameters and allows for precise content filtering.

## Operations

### Comparison Operations

#### `is` - Exact Match
Match exact values:
```
filter_query[content.category][is]=news
filter_query[content.published][is]=true
filter_query[content.rating][is]=5
```

Special values for `is` operation:
- `empty` - Field is empty (also targets fields not in schema)
- `not_empty` - Field is not empty
- `empty_array` - Array field is empty
- `not_empty_array` - Array field is not empty
- `true` - Boolean field is true
- `false` - Boolean field is false
- `null` - Field is null (also targets fields not in schema)
- `not_null` - Field is not null

#### `in` - Match Any Value in Array
Match if the field value is in the specified array:
```
filter_query[content.category][in]=news,blog,article
filter_query[content.status][in]=published,featured
```

#### `not_in` - Exclude Values in Array
Exclude stories where the field value is in the specified array:
```
filter_query[content.category][not_in]=draft,archived
filter_query[content.status][not_in]=private
```

#### `like` - Pattern Matching
Match patterns using wildcards:
```
filter_query[content.title][like]=*story*
filter_query[content.description][like]=important*
filter_query[content.slug][like]=*2023*
```

#### `not_like` - Exclude Pattern Matches
Exclude stories matching the pattern:
```
filter_query[content.title][not_like]=*draft*
filter_query[content.description][not_like]=*test*
```

### Array Operations

#### `any_in_array` - Match Any Array Element
Match if any element in the field array matches:
```
filter_query[content.tags][any_in_array]=featured
filter_query[content.categories][any_in_array]=news,breaking
```

#### `all_in_array` - Match All Array Elements
Match if all specified elements are in the field array:
```
filter_query[content.tags][all_in_array]=featured,published
filter_query[content.categories][all_in_array]=news,technology
```

### Date Operations

#### `gt_date` - Greater Than Date
Match dates greater than the specified date:
```
filter_query[content.publish_date][gt_date]=2023-01-01
filter_query[content.created_at][gt_date]=2023-06-01
```

#### `lt_date` - Less Than Date
Match dates less than the specified date:
```
filter_query[content.publish_date][lt_date]=2023-12-31
filter_query[content.expiry_date][lt_date]=2024-01-01
```

### Numeric Operations

#### `gt_int` - Greater Than Integer
Match integers greater than the specified value:
```
filter_query[content.rating][gt_int]=5
filter_query[content.view_count][gt_int]=1000
```

#### `lt_int` - Less Than Integer
Match integers less than the specified value:
```
filter_query[content.rating][lt_int]=10
filter_query[content.price][lt_int]=100
```

#### `gt_float` - Greater Than Float
Match floats greater than the specified value:
```
filter_query[content.price][gt_float]=9.99
filter_query[content.score][gt_float]=4.5
```

#### `lt_float` - Less Than Float
Match floats less than the specified value:
```
filter_query[content.price][lt_float]=99.99
filter_query[content.score][lt_float]=5.0
```

## Logical Operations

### `__or` - Logical OR
Combine multiple conditions with OR logic:
```
filter_query[__or][0][content.category][is]=news
filter_query[__or][1][content.published][is]=true
filter_query[__or][2][content.rating][gt_int]=4
```

## Field-level Translation

For multilingual content using Storyblok's Field-level Translation, use the `field__i18n__language_code` syntax:

```
filter_query[headline__i18n__de][like]=*wichtig*
filter_query[content__i18n__en][is]=not_empty
filter_query[seo.title__i18n__es_co][like]=*importante*
```

**Requirements for internationalized filters:**
- Space must be configured to publish languages independently
- Space must have `use_filter_query_in_translated_stories` enabled
- Request must include `version=published`
- Request must include `language` parameter matching the filter language

## Nestable Blocks and Fields

Access nested fields using dot notation:

```
filter_query[body.0.name][is]=This is a nested blok
filter_query[seo.description][is]=not_empty
filter_query[body.1.highlighted][is]=true
```

## Complex Examples

### Date Range with Category Filter
```
filter_query[content.category][is]=news
filter_query[content.publish_date][gt_date]=2023-01-01
filter_query[content.publish_date][lt_date]=2023-12-31
```

### Featured or High-Rated Content
```
filter_query[__or][0][content.tags][any_in_array]=featured
filter_query[__or][1][content.rating][gt_int]=4
filter_query[__or][2][content.view_count][gt_int]=1000
```

### Exclude Drafts with Specific Category
```
filter_query[content.status][not_in]=draft,archived
filter_query[content.category][in]=news,blog
filter_query[content.published][is]=true
```

### Multilingual Content Filter
```
filter_query[__or][0][headline__i18n__en][like]=*breaking*
filter_query[__or][1][headline__i18n__de][like]=*wichtig*
filter_query[__or][2][headline__i18n__fr][like]=*urgent*
```

## Usage in API Calls

When using filter queries in API calls, the parameters are automatically URL-encoded:

```bash
# cURL example
curl "https://api.storyblok.com/v2/cdn/stories?filter_query[content.category][is]=news&token=YOUR_TOKEN"
```

```javascript
// JavaScript example with our client
const filter = buildFilterQuery({
  'content.category': { $is: 'news' },
  'content.published': { $is: 'true' }
});

const { data } = await client.stories.list({
  query: { ...filter }
});
```

## Best Practices

1. **Use specific field names**: Always use the exact field names from your content type
2. **Test queries**: Test complex queries in smaller parts first
3. **Performance**: Keep queries as simple as possible for better performance
4. **Language handling**: Use `field__i18n__language_code` syntax for multilingual content
5. **Nested fields**: Use dot notation for accessing nested content blocks
6. **Type safety**: Use the provided TypeScript utilities for type-safe filter building

## Limitations

- Filter queries are only available for the `/stories` endpoint
- Complex queries may impact performance
- Some operations may not work with all field types
- Maximum query complexity may be limited by API constraints
- Only `__or` logical operation is supported (no `__and` or `__not`)
