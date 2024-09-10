import { subtask } from 'hardhat/config';
import { HardhatPluginError } from 'hardhat/plugins';
import { verifyMutations } from '../internal/verify-mutations';
import { SUBTASK_VERIFY_CONTRACTS } from '../task-names';
import { StorageDump, StorageMutation } from '../types';

type Params = {
  curr?: StorageDump;
  prev?: StorageDump;
  quiet?: boolean;
};

subtask(SUBTASK_VERIFY_CONTRACTS).setAction(async ({ curr, prev, quiet }: Params) => {
  const mutations = verifyMutations(curr, prev);

  if (mutations.some((m) => m.type === 'error')) {
    const errors = mutations.filter((m) => m.type === 'error');
    console.log();
    for (const m of errors) _printMutation(m);
    console.log();
    throw new HardhatPluginError(
      'hardhat-storage',
      'Invalid storage mutations found, please fix them before continuing'
    );
  }

  if (!quiet) {
    console.log();
    if (mutations.length) {
      for (const m of mutations) _printMutation(m);
    } else {
      console.log('No storage mutations detected');
    }
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
