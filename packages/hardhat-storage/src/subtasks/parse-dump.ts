import fs from 'node:fs';
import path from 'node:path';
import { compileSolidityFolder } from '@synthetixio/core-utils/utils/solidity/compiler';
import { subtask } from 'hardhat/config';
import { SUBTASK_STORAGE_PARSE_DUMP } from '../task-names';

subtask(SUBTASK_STORAGE_PARSE_DUMP).setAction(async ({ output }, hre) => {
  const version = hre.config.solidity.compilers[0].version;
  const rootDir = hre.config.paths.root;

  if (!fs.existsSync(path.resolve(rootDir, output))) {
    return [];
  }

  return await compileSolidityFolder({ rootDir, version, sources: output });
});
