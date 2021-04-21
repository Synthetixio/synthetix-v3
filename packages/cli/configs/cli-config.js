/*global extendConfig*/
/*eslint no-undef: "error"*/

extendConfig(function (config, userConfig) {
  config.cli = Object.assign(
    {
      artifacts: './deployments',
    },
    userConfig.cli
  );
});
