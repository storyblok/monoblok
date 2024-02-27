# @storyblok/region-helper

## 1.0.0

### Major Changes

- 09c2b66: feat: add logic to switch between http and https. Rename to more explicit variable names.

### Minor Changes

- d9f1892: feat: `getRegionName` and `region code` exported
- 8fdf2f5: feat: export ranges from all the regions
- 734fdb3: feat: export the `isSpaceIdWithinRange` method that validates whether a given spaceId is valid or not

## 0.2.0

### Minor Changes

- 1b6b0cf: feat: export `ALL_REGIONS`

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
