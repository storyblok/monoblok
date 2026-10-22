A client-rendered React app (Vite, React Router) that renders Storyblok stories with
`@storyblok/react` (https://www.storyblok.com/docs/packages/storyblok-react). `src/App.jsx` fetches
the story for the path, `home` for `/`. Register every new block in `src/main.jsx`.

- React: https://react.dev/llms.txt
- Vite: https://vite.dev/llms.txt
- React Router: https://reactrouter.com/home

`npm run dev` serves https://localhost:5173. The Visual Editor needs HTTPS. `vite.config.js` exposes
the `STORYBLOK_*` variables to the browser.
