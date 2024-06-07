import { task } from 'hardhat/config';
import { TASK_STORAGE_VERIFY } from '../task-names';

interface Params {
  previous: string;
  current: string;
}

task(
  TASK_STORAGE_VERIFY,
  'Using the two given storage dumps, verify that there are not invalid storage mutations'
)
  .addOptionalPositionalParam(
    'previous',
    'Older storage dump to compare to',
    'storage.dump.prev.sol'
  )
  .addOptionalPositionalParam(
    'current',
    'More recent storage dump to compare to',
    'storage.dump.sol'
  )
  .setAction(async (params: Required<Params>, hre) => {
    // TODO: implement storage mutations check
  });
