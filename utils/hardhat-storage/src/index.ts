import path from 'node:path';
import { extendConfig } from 'hardhat/config';
import { HardhatConfig, HardhatUserConfig } from 'hardhat/types';
import './type-extensions';
import './subtasks/generate-testable-storage';
import './subtasks/get-source-units';
import './subtasks/parse-contents';
import './subtasks/parse-dump';
import './tasks/generate-testable';
import './tasks/verify';
import './tasks/generate';

extendConfig((config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
  config.storage = {
    artifacts: userConfig.storage?.artifacts || [path.join(config.paths.sources, '**')],
  };
});
