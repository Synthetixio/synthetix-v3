import path from 'node:path';
import { task } from 'hardhat/config';
import { readJsonFile } from '../internal/file-helpers';
import { verifyMutations } from '../internal/verify-mutations';
import { TASK_STORAGE_VERIFY } from '../task-names';
import { StorageDump, StorageMutation } from '../types';

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

    const mutations = verifyMutations(curr, prev);

    if (mutations.some((m) => m.type === 'error')) {
      const errors = mutations.filter((m) => m.type === 'error');
      for (const m of errors) _printMutation(m);
      throw new Error('Found invalid storage mutations, please fix them before continuing');
    }

    if (!quiet) {
      for (const m of mutations) _printMutation(m);
      console.log();
    }

    return mutations;
  });

const prefixes = {
  add: '+ ',
  update: '+-',
  del: '- ',
} satisfies Record<StorageMutation['kind'], string>;

function _printMutation(mutation: StorageMutation) {
  console[mutation.type](`${prefixes[mutation.kind]} ${mutation.message}`);
}
