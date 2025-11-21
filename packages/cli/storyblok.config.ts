// THIS FILE IS FOR TESTING ONLY

export default {
  // Global options
  verbose: true,
  space: 288585436127774,

  // Command-specific options
  modules: {
    components: {
      region: 'eu',
      pull: {
        localFlag: 'config',
        region: 'eu',
      },
    },
    migrations: {
      // space: 1111, # will override space for migrations commands
    },
  },
};
