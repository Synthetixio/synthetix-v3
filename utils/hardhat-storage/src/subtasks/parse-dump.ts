import fs from 'node:fs/promises';
import path from 'node:path';
import { compileSolidityContents } from '@synthetixio/core-utils/utils/solidity/compiler';
import { subtask } from 'hardhat/config';
import { parseStorageDump } from '../internal/dump';
import { SUBTASK_STORAGE_LOAD_DUMP } from '../task-names';

interface Params {
  filepath: string;
}

subtask(SUBTASK_STORAGE_LOAD_DUMP).setAction(async ({ filepath }: Params, hre) => {
  const version = hre.config.solidity.compilers[0].version;
  const sourcepath = path.resolve(hre.config.paths.root, filepath);
  const source = await fs.readFile(sourcepath, { encoding: 'utf8' });

  const contents = parseStorageDump(source);

  return await compileSolidityContents(contents, version);
});
