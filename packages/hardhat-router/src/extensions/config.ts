import path from 'node:path';
import { extendConfig } from 'hardhat/config';
import { HardhatConfig, HardhatUserConfig } from 'hardhat/types';
import { configDefaults } from '../internal/config-defaults';

extendConfig((config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
  const { root, sources } = config.paths;
  const { router: givenConfig = {} } = userConfig;

  config.router = {
    ...configDefaults,
    ...givenConfig,
    paths: {
      ...configDefaults.paths,
      ...(givenConfig?.paths || {}),
    },
  };

  // Resolve the absolute path from the root of the configurable path
  config.router.paths.deployments = path.resolve(root, config.router.paths.deployments);
  config.router.paths.modules = path.resolve(sources, config.router.paths.modules);
});
