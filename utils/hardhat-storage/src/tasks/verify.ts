import path from 'node:path';
import { task } from 'hardhat/config';
import { readJsonFile } from '../internal/file-helpers';
import { SUBTASK_VERIFY_CONTRACTS, TASK_STORAGE_VERIFY } from '../task-names';
import { StorageDump } from '../types';

interface Params {
  previous: string;
  current: string;
  quiet: boolean;
}

task(
  TASK_STORAGE_VERIFY,
  'Using the two given storage dumps, verify that there are not invalid storage mutations'
)
  .addOptionalPositionalParam(
    'previous',
    'Older storage dump to compare to',
    'storage.prev.dump.json'
  )
  .addOptionalPositionalParam(
    'current',
    'More recent storage dump to compare to',
    'storage.dump.json'
  )
  .addFlag('quiet', 'only emit errors to the console')
  .setAction(async ({ previous, current, quiet }: Required<Params>, hre) => {
    const curr = await readJsonFile<StorageDump>(path.resolve(hre.config.paths.root, current));
    const prev = await readJsonFile<StorageDump>(path.resolve(hre.config.paths.root, previous));

    const mutations = await hre.run(SUBTASK_VERIFY_CONTRACTS, { curr, prev, quiet });

    return mutations;
  });
