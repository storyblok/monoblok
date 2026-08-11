// Next.js bundles plain CSS side-effect imports (`import "./globals.css"`) but
// only ships a declaration for `*.module.css`. TypeScript 6 rejects a
// side-effect import it cannot resolve to a module or declaration, so declare
// the plain form here.
declare module "*.css";
