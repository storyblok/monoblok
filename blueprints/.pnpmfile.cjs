// Workspace-only tweaks to blueprint manifests. Not synced: the sync copies one blueprint folder.
// Users get each blueprint's package.json as written.
module.exports = {
  hooks: {
    readPackage(pkg) {
      // `nuxt prepare` loads `@storyblok/nuxt`, a workspace package that is not built while the
      // workspace installs.
      if (pkg.name === "blueprint-core-nuxt" && pkg.scripts) {
        delete pkg.scripts.postinstall;
      }
      return pkg;
    },
  },
};
