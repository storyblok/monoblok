# Storyblok Core Space Blueprint: Angular

Integrate [Angular](https://angular.dev) with [Storyblok](http://www.storyblok.com) as a headless CMS.

This blueprint is ideal for kickstarting new Storyblok and Angular projects. What's inside:

- Pre-configured default blocks: `page`, `teaser`, `grid`, and `feature`.
- Support for the Visual Editor's live preview.
- Dynamic routing to fetch and render new stories automatically.
- Minimal styling.

> [!TIP]
> Follow our [Angular guide](https://www.storyblok.com/docs/guides/angular/) for a step-by-step walkthrough and learn more about Storyblok's range of features, including rich text rendering, custom content modeling, and internationalization. See the [@storyblok/angular package reference](https://storyblok.com/docs/libraries/js/angular-sdk) for further information.

---

[![Try Storyblok free](https://img.shields.io/badge/Try%20Storyblok-dad4ff.svg?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgZmlsbD0ibm9uZSI+PHBhdGggZD0iTTQuNzA3IDIuNTM4aDIyLjUyOXYyMy41ODdINC43MDd6IiBzdHlsZT0iZmlsbDojZmZmIi8+PHBhdGggZmlsbD0iIzFmMWYxZiIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMS43NDMgMi42MDFBMi41OTcgMi41OTcgMCAwIDEgNC4zMzUgMGgyMy4zM2EyLjU5NyAyLjU5NyAwIDAgMSAyLjU5MiAyLjYwMXYyMy40MTFhMi41OTcgMi41OTcgMCAwIDEtMi41OTIgMi42MDJIMTIuNTQ4bC0zLjg3MiAzLjIwOGEuNzcuNzcgMCAwIDEtMS4yNjEtLjU5N3YtMi42MTFoLTMuMDhhMi41OTcgMi41OTcgMCAwIDEtMi41OTItMi42MDJabTUuNjcgMi4xMjdoMTIuNDYyYzIuNjkxIDAgNC44NzMgMi4xOSA0Ljg3MyA0Ljg5IDAgMi4xNjQtMS40IDQtMy4zNDIgNC42NDRhNC44ODcgNC44ODcgMCAwIDEgMy45OSA0LjgxYzAgMi43MDEtMi4xODEgNC44OS00Ljg3MyA0Ljg5SDcuNDEzdi05LjQ1NFptMTAuMzY0IDQuNEgxMS45NXYyLjkzNGg1LjgyOGMuODA4IDAgMS40NjItLjY1NiAxLjQ2Mi0xLjQ2NyAwLS44MS0uNjU0LTEuNDY3LTEuNDYyLTEuNDY3em0tNS44MjggNi41Mmg2LjMxNGMuODk3IDAgMS42MjQuNzMgMS42MjQgMS42MyAwIC45MDEtLjcyNyAxLjYzLTEuNjI0IDEuNjNoLTYuMzE0eiIgY2xpcC1ydWxlPSJldmVub2RkIiBzdHlsZT0ic3Ryb2tlLXdpZHRoOjEuNTE3NzUiLz48L3N2Zz4K&labelColor=ffffff)](https://app.storyblok.com/#/signup)
[![Join the Storyblok Discord community](https://img.shields.io/discord/700316478792138842?style=for-the-badge&logo=discord&label=Join%20our%20community&labelColor=ffffff&color=dad4ff)](https:/storyblok.com/join-discord)

## Get Started

**No Storyblok account yet? [Sign up now](https://app.storyblok.com/#/signup?utm_source=docs) to experience a 14-day free trial of all features and enjoy our completely free Starter plan.**

1. Create a new empty Storyblok space
2. Create a new repository based on this template
3. Open the project on your device
4. Install dependencies

```sh
npm install
```

### Authentication

Open `src/environments/environment.ts` and set the access token of your space:

```ts
export const environment = {
  production: true,
  accessToken: '<REPLACE_WITH_YOUR_TOKEN>',
  region: 'eu' as const
};
```

Do the same in `src/environments/environment.development.ts`, which Angular swaps in automatically during development builds:

```ts
export const environment = {
  production: false,
  accessToken: '<REPLACE_WITH_YOUR_TOKEN>',
  region: 'eu' as const
};
```

> [!TIP]
> Copy your space's preview access token from **Settings > Access Tokens**.
> Learn more about Storyblok [access tokens](https://www.storyblok.com/docs/concepts/access-tokens).

### Connect the Visual Editor

To render a preview of the local project in the Visual Editor, follow these steps:

1. In your space, navigate to **Settings > Visual Editor**.
2. Set the default environment to `https://localhost:4200/`.
3. Save.
4. Open the `home` story.
5. Click **Config**.
6. Type `/` in the **Real path**.

Run the development server:

```sh
npm start
```

> [!IMPORTANT]
> To connect the Storyblok Visual Editor, the local project must run over HTTPS. The `start` script runs `ng serve --ssl` for this reason. Learn more in the [Visual Editor concept](https://www.storyblok.com/docs/concepts/visual-editor#local-development-via-https). Check the [Visual Preview section of the Angular guide](https://storyblok.com/docs/guides/angular/visual-preview) for detailed instructions.

Back in Storyblok, open the **Home** story to start editing.

Happy building!

## Resources

- To learn more about what you can do with Storyblok, visit [our documentation and learning hub](https://www.storyblok.com/docs).
- To learn more about the integration between Storyblok and Angular, check our [dedicated developer tutorials](https://www.storyblok.com/tutorials?technologies=angular).
- To learn more about Angular, check the [official documentation](https://angular.dev).

### Support

- Have questions, need help, want to chat with other users? [Join our Discord community](https://storyblok.com/join-discord).
- Visit the Storyblok [Help Center](https://support.storyblok.com/).
