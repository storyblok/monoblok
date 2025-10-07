// THIS FILE IS FOR TESTING ONLY

export default {
  // Global options
  verbose: true,
  /*  globalFlag: 'config', */

  // Command-specific options
  modules: {
    test: {
      localFlag: 'config',
      region: 'eu',
    },
    deep: {
      localFlag: 'config',
      region: 'eu',
      pull: {
        localFlag: 'config',
        region: 'eu',
      },
    },
  },
};
