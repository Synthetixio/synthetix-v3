import { task } from 'hardhat/config';
import { TASK_STORAGE_VERIFY } from '../task-names';

interface Params {
  current: string;
  previous: string;
}

task(
  TASK_STORAGE_VERIFY,
  'Using the two given storage dumps, verify that there are not invalid storage mutations'
)
  .addOptionalPositionalParam(
    'current',
    'More recent storage dump to compare to',
    'storage.dump.json'
  )
  .addOptionalPositionalParam(
    'previous',
    'Older storage dump to compare to',
    'storage.dump.prev.json'
  )
  .setAction(async (params: Required<Params>, hre) => {
    // TODO: implement storage mutations check
  });
