import path from 'node:path';
import { extendConfig } from 'hardhat/config';
import { HardhatConfig, HardhatUserConfig } from 'hardhat/types';
import './type-extensions';
import './subtasks/generate-testable-storage';
import './subtasks/get-artifacts';
import './subtasks/validate-contracts';
import './tasks/dump';
import './tasks/generate-testable';
import './tasks/validate';
import './tasks/verify';

extendConfig((config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
  config.storage = {
    artifacts: userConfig.storage?.artifacts || [path.join(config.paths.sources, '**')],
  };
});
