# @storyblok/region-helper

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![Codecov][codecov-src]][codecov-href]

A helper package to handle Storyblok APIs in different regions.

## Usage

Install package:

```sh
# npm
npm install @storyblok/region-helper

# yarn
yarn add @storyblok/region-helper

# pnpm
pnpm install @storyblok/region-helper

# bun
bun install @storyblok/region-helper
```

Import:

```js
// ESM
import {} from '@storyblok/region-helper'

// CommonJS
const {} = require('@storyblok/region-helper')
```

## Development

- Clone this repository
- Install latest LTS version of [Node.js](https://nodejs.org/en/)
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable`
- Install dependencies using `pnpm install`
- Run interactive tests using `pnpm dev`

## Release

1. In the root of the repository, run `npx changeset`
2. Stage the new created Changeset file and push it
3. Open a PR from `feat/branch` to `main`
4. Review and merge the PR
5. A `bump pull request` is going to be created automatically created by the `versioning.yml` action.
6. Open the automatically generated PR (`chore: release`) review it and merge.
7. After it gets merged, another `action` is going to run, the `publishing.yml` action, which is responsible for publishing the new version to the NPM, to create a new `tag`, and also to create a Github release.

> Note: If the Github checks don’t run for the second PR (step 6), you may close and reopen it. For the video version check the [internal docs](https://www.notion.so/storyblok/Recordings-d8838dc8a76f49e6b393db654a580bfa?pvs=4#6b34969027a24ddf86c85780c123efd5).

## License

Made with 💛

Published under [MIT License](./LICENSE).

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/@storyblok/region-helper?style=flat&colorA=18181B&colorB=F0DB4F
[npm-version-href]: https://npmjs.com/package/@storyblok/region-helper
[npm-downloads-src]: https://img.shields.io/npm/dm/@storyblok/region-helper?style=flat&colorA=18181B&colorB=F0DB4F
[npm-downloads-href]: https://npmjs.com/package/@storyblok/region-helper
[codecov-src]: https://img.shields.io/codecov/c/gh/unjs/@storyblok/region-helper/main?style=flat&colorA=18181B&colorB=F0DB4F
[codecov-href]: https://codecov.io/gh/unjs/@storyblok/region-helper
[bundle-src]: https://img.shields.io/bundlephobia/minzip/@storyblok/region-helper?style=flat&colorA=18181B&colorB=F0DB4F
[bundle-href]: https://bundlephobia.com/result?p=@storyblok/region-helper
