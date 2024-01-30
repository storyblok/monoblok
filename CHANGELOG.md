# @storyblok/region-helper

## 0.1.0

### Minor Changes

- 84a757f: Add full URL and add new validation function

## 0.0.1

### Patch Changes

- b7a8132: Since each Storyblok `space` belongs to a `region` and each region has its own API address,
  we need an easy way of giving an spaceId, obtaining its `region` and also its respective API address
  and this is what this packages does.

  It provides two core methods, the `getRegion(spaceId: number)` and the `getRegionUrl(region: Region)`
  where the first, based on a `spaceId` returns a region (that can be `eu`, `us`, `ca`, and `pa`) and the last
  which receives a given `region` and returns its correspondent API address.

  Here is the list of the supported `regions`:

  | Alpha-2 code | Description   |
  | ------------ | ------------- |
  | EU           | Europe        |
  | US           | United States |
  | CA           | Canada        |
  | PA           | Australia     |
