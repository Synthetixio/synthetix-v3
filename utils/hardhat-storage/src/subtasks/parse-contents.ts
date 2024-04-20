import { compileSolidityContents } from '@synthetixio/core-utils/utils/solidity/compiler';
import { subtask } from 'hardhat/config';
import { SUBTASK_STORAGE_PARSE_CONTENTS } from '../task-names';

interface Params {
  contents: { [sourceName: string]: string };
}

subtask(SUBTASK_STORAGE_PARSE_CONTENTS).setAction(async ({ contents }: Params, hre) => {
  const version = hre.config.solidity.compilers[0].version;
  return await compileSolidityContents(contents, version);
});
