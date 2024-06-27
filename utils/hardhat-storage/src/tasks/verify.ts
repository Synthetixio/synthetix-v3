import path from 'node:path';
import { task } from 'hardhat/config';
import { readJsonFile } from '../internal/file-helpers';
import { TASK_STORAGE_VERIFY } from '../task-names';
import { StorageDump, StorageLayout } from '../types';

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
    'storage.prev.dump.json'
  )
  .addOptionalPositionalParam(
    'current',
    'More recent storage dump to compare to',
    'storage.dump.json'
  )
  .setAction(async ({ previous, current }: Required<Params>, hre) => {
    const curr = await readJsonFile<StorageDump>(path.resolve(hre.config.paths.root, current));
    const prev = await readJsonFile<StorageDump>(path.resolve(hre.config.paths.root, previous));

    // 1. Do not change 'slot' or 'offset' on any storage slot
    // 2. Show a warning when renaming a slot
    // 2. Show a warning when changing type
    // 3. Do not allow to remove variables

    const contractNames = _getUniqKeys(curr, prev);

    for (const fqName of contractNames) {
      const currStorageDump = curr[fqName] as StorageLayout | undefined;
      const prevStorageDump = prev[fqName] as StorageLayout | undefined;

      const structNames = _getUniqKeys(currStorageDump?.structs, prevStorageDump?.structs);
      for (const structName of structNames) {
        const currStruct = currStorageDump?.structs[structName];
        const prevStruct = prevStorageDump?.structs[structName];

        const slots = [...(prevStruct || []), ...(currStruct || [])].sort((a, b) => {
          return Number.parseInt(a.slot!) - Number.parseInt(b.slot!);
        });

        for (const slot of slots) {
          // validate
          slot;
        }
      }
    }
  });

function _getUniqKeys(...objs: ({ [k: string]: unknown } | undefined)[]) {
  const set = new Set<string>();
  for (const obj of objs) for (const k of Object.keys(obj || {})) set.add(k);
  return Array.from(set).sort();
}
