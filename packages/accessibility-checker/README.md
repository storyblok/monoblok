<div align="center">

![Storyblok ImagoType](https://raw.githubusercontent.com/storyblok/.github/refs/heads/main/profile/public/github-banner.png)

<h1 align="center">@storyblok/accessibility-checker</h1>
 <p>
   Accessibility checks for the Storyblok Visual Editor, powered by axe-core.
 </p>
 <br />
</div>

<p align="center">
  <a href="https://npmjs.com/package/@storyblok/accessibility-checker">
    <img src="https://img.shields.io/npm/v/@storyblok/accessibility-checker/latest.svg?style=flat-square&color=8d60ff" alt="Storyblok Accessibility Checker" />
  </a>
  <a href="https://npmjs.com/package/@storyblok/accessibility-checker" rel="nofollow">
    <img src="https://img.shields.io/npm/dt/@storyblok/accessibility-checker.svg?style=appveyor&color=8d60ff" alt="npm">
  </a>
  <a href="https://storyblok.com/join-discord">
   <img src="https://img.shields.io/discord/700316478792138842?label=Join%20Our%20Discord%20Community&style=appveyor&logo=discord&color=8d60ff">
   </a>
  <a href="https://twitter.com/intent/follow?screen_name=storyblok">
    <img src="https://img.shields.io/badge/Follow-%40storyblok-8d60ff?style=appveyor&logo=twitter" alt="Follow @Storyblok" />
  </a>
</p>

## Features

- Run [axe-core](https://github.com/dequelabs/axe-core) checks when the Visual Editor requests them
- Send the results to the A11y tab in the Visual Editor
- Configure the checked rules with axe rule tags, such as WCAG conformance levels
- Load axe-core only when the Visual Editor requests the first check
- Do nothing outside the Visual Editor, including on the server

## Documentation

For complete documentation, please visit the
[package reference](https://www.storyblok.com/docs/libraries/js/accessibility-checker).

## Contributing

If you'd like to contribute, please refer to the [contributing guidelines](../../CONTRIBUTING.md).

## Community

For help, discussion about best practices, or any other conversation that would benefit from being
searchable:

- [Discuss Storyblok on GitHub Discussions](https://github.com/storyblok/monoblok/discussions)

For community support, chatting with other users, please visit:

- [Discuss Storyblok on Discord](https://storyblok.com/join-discord)

## Support

For bugs or feature requests, please
[submit an issue](https://github.com/storyblok/monoblok/issues/new/choose).

> [!IMPORTANT] Please search existing issues before submitting a new one. Issues without a minimal
> reproducible example will be closed.
> [Why reproductions are Required](https://antfu.me/posts/why-reproductions-are-required).

### I can't share my company project code

We understand that you might not be able to share your company's project code. Please provide a
minimal reproducible example that demonstrates the issue by using tools like
[Stackblitz](https://stackblitz.com) or a link to a GitHub repo. Please make sure you include a
README file with the instructions to build and run the project, important not to include any access
token, password or personal information of any kind.

### Feedback

If you have a question, please ask in the
[Discuss Storyblok on Discord](https://storyblok.com/join-discord) channel.

## License

[MIT](./LICENSE). The package depends on [axe-core](https://github.com/dequelabs/axe-core), which is
licensed under the [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/).
