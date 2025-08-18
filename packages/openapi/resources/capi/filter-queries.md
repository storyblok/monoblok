# Filter Queries

Filter by (a) specific field(s) of your story type using advanced JSON query syntax.

## Overview

Filter queries allow you to perform complex filtering operations on your Storyblok content using JSON syntax. This is more powerful than basic query parameters and allows for precise content filtering.

## Operations

### Comparison Operations

#### `$is` - Exact Match
Match exact values:
```json
{"content.category": {"$is": "news"}}
{"content.published": {"$is": true}}
{"content.rating": {"$is": 5}}
```

#### `$in` - Match Any Value in Array
Match if the field value is in the specified array:
```json
{"content.category": {"$in": ["news", "blog", "article"]}}
{"content.status": {"$in": ["published", "featured"]}}
```

#### `$not_in` - Exclude Values in Array
Exclude stories where the field value is in the specified array:
```json
{"content.category": {"$not_in": ["draft", "archived"]}}
{"content.status": {"$not_in": ["private"]}}
```

#### `$like` - Pattern Matching
Match patterns using wildcards:
```json
{"content.title": {"$like": "*story*"}}
{"content.description": {"$like": "important*"}}
{"content.slug": {"$like": "*2023*"}}
```

#### `$not_like` - Exclude Pattern Matches
Exclude stories matching the pattern:
```json
{"content.title": {"$not_like": "*draft*"}}
{"content.description": {"$not_like": "*test*"}}
```

### Array Operations

#### `$any_in_array` - Match Any Array Element
Match if any element in the field array matches:
```json
{"content.tags": {"$any_in_array": ["featured"]}}
{"content.categories": {"$any_in_array": ["news", "breaking"]}}
```

#### `$all_in_array` - Match All Array Elements
Match if all specified elements are in the field array:
```json
{"content.tags": {"$all_in_array": ["featured", "published"]}}
{"content.categories": {"$all_in_array": ["news", "technology"]}}
```

### Date Operations

#### `$gt_date` - Greater Than Date
Match dates greater than the specified date:
```json
{"content.publish_date": {"$gt_date": "2023-01-01"}}
{"content.created_at": {"$gt_date": "2023-06-01"}}
```

#### `$lt_date` - Less Than Date
Match dates less than the specified date:
```json
{"content.publish_date": {"$lt_date": "2023-12-31"}}
{"content.expiry_date": {"$lt_date": "2024-01-01"}}
```

### Numeric Operations

#### `$gt_int` - Greater Than Integer
Match integers greater than the specified value:
```json
{"content.rating": {"$gt_int": 5}}
{"content.view_count": {"$gt_int": 1000}}
```

#### `$lt_int` - Less Than Integer
Match integers less than the specified value:
```json
{"content.rating": {"$lt_int": 10}}
{"content.price": {"$lt_int": 100}}
```

#### `$gt_float` - Greater Than Float
Match floats greater than the specified value:
```json
{"content.price": {"$gt_float": 9.99}}
{"content.score": {"$gt_float": 4.5}}
```

#### `$lt_float` - Less Than Float
Match floats less than the specified value:
```json
{"content.price": {"$lt_float": 99.99}}
{"content.score": {"$lt_float": 5.0}}
```

## Logical Operations

### `$and` - Logical AND
Combine multiple conditions with AND logic:
```json
{"$and": [
  {"content.category": {"$is": "news"}},
  {"content.published": {"$is": true}},
  {"content.rating": {"$gt_int": 4}}
]}
```

### `$or` - Logical OR
Combine multiple conditions with OR logic:
```json
{"$or": [
  {"content.tags": {"$any_in_array": ["featured"]}},
  {"content.rating": {"$gt_int": 4}},
  {"content.category": {"$is": "breaking"}}
]}
```

### `$not` - Logical NOT
Negate a condition:
```json
{"$not": {"content.category": {"$is": "draft"}}}
```

## Field-level Translation

For multilingual content, use language suffixes to filter by specific languages:

```json
{"content.title_en": {"$like": "*story*"}}
{"content.description_de": {"$is": "Wichtige Nachricht"}}
{"content.body_fr": {"$not_like": "*brouillon*"}}
```

## Nestable Blocks and Fields

Access nested fields using dot notation:

```json
{"content.body.0.text": {"$like": "*important*"}}
{"content.gallery.0.image.alt": {"$is": "Featured Image"}}
{"content.blocks.1.headline": {"$like": "*breaking*"}}
```

## Complex Examples

### Date Range with Category Filter
```json
{"$and": [
  {"content.category": {"$is": "news"}},
  {"content.publish_date": {"$gt_date": "2023-01-01"}},
  {"content.publish_date": {"$lt_date": "2023-12-31"}}
]}
```

### Featured or High-Rated Content
```json
{"$or": [
  {"content.tags": {"$any_in_array": ["featured"]}},
  {"content.rating": {"$gt_int": 4}},
  {"content.view_count": {"$gt_int": 1000}}
]}
```

### Exclude Drafts with Specific Category
```json
{"$and": [
  {"content.status": {"$not_in": ["draft", "archived"]}},
  {"content.category": {"$in": ["news", "blog"]}},
  {"content.published": {"$is": true}}
]}
```

### Multilingual Content Filter
```json
{"$or": [
  {"content.title_en": {"$like": "*breaking*"}},
  {"content.title_de": {"$like": "*wichtig*"}},
  {"content.title_fr": {"$like": "*urgent*"}}
]}
```

## Usage in API Calls

When using filter queries in API calls, remember to URL-encode the JSON:

```bash
# cURL example
curl "https://api.storyblok.com/v2/cdn/stories?filter_query=%7B%22content.category%22%3A%7B%22%24is%22%3A%22news%22%7D%7D&token=YOUR_TOKEN"
```

```javascript
// JavaScript example
const filterQuery = JSON.stringify({
  "content.category": {"$is": "news"}
});

const url = `https://api.storyblok.com/v2/cdn/stories?filter_query=${encodeURIComponent(filterQuery)}&token=YOUR_TOKEN`;
```

## Best Practices

1. **Use specific field names**: Always use the exact field names from your content type
2. **URL encode**: Always URL-encode the filter_query parameter
3. **Test queries**: Test complex queries in smaller parts first
4. **Performance**: Keep queries as simple as possible for better performance
5. **Language handling**: Use language suffixes for multilingual content
6. **Nested fields**: Use dot notation for accessing nested content blocks

## Limitations

- Filter queries are only available for the `/stories` endpoint
- Complex queries may impact performance
- Some operations may not work with all field types
- Maximum query complexity may be limited by API constraints
