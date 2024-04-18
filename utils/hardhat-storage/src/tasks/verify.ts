import { task } from 'hardhat/config';
import { TASK_STORAGE_VERIFY } from '../task-names';

interface Params {
  from: string;
  to: boolean;
}

task(
  TASK_STORAGE_VERIFY,
  'Using the two given storage dumps, verify that there are not invalid storage mutations'
)
  .addOptionalPositionalParam('from', 'Older storage dump to compare to', 'storage.dump.prev.sol')
  .addOptionalPositionalParam('to', 'More recent storage dump to compare to', 'storage.dump.sol')
  .setAction(async (params: Required<Params>) => {
    console.log(params);
  });
