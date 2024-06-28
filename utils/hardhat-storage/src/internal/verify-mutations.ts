import { parseFullyQualifiedName } from 'hardhat/utils/contract-names';
import { StorageDump, StorageMutation, StorageSlot } from '../types';
import { areDeepEqual } from './are-deep-equal';

export function verifyMutations(curr?: StorageDump, prev?: StorageDump) {
  // 1. Do not change 'slot' or 'offset' on any storage slot
  // 2. Show a warning when renaming a slot
  // 2. Show a warning when changing type
  // 3. Do not allow to remove variables

  const contractNames = _getUniqKeys(curr, prev);
  const mutations: StorageMutation[] = [];

  for (const fqName of contractNames) {
    const { contractName, sourceName } = parseFullyQualifiedName(fqName);

    const currStorageDump = curr?.[fqName];
    const prevStorageDump = prev?.[fqName];

    // Check if the contract was added or deleted
    if (currStorageDump && !prevStorageDump) {
      mutations.push({
        type: 'log',
        kind: 'add',
        message: `Added ${currStorageDump.kind} ${contractName} at ${sourceName}`,
      });
      continue;
    } else if (!currStorageDump && prevStorageDump) {
      mutations.push({
        type: 'log',
        kind: 'del',
        message: `Deleted ${prevStorageDump.kind} ${contractName} at ${sourceName}`,
      });
      continue;
    }

    const structNames = _getUniqKeys(currStorageDump?.structs, prevStorageDump?.structs);

    for (const structName of structNames) {
      const currStruct = currStorageDump?.structs[structName];
      const prevStruct = prevStorageDump?.structs[structName];

      // Check if the struct was added or deleted
      if (currStruct && !prevStruct) {
        mutations.push({
          type: 'log',
          kind: 'add',
          message: `Added struct ${contractName}.${structName} at ${sourceName}`,
        });
        continue;
      } else if (!currStruct && prevStruct) {
        mutations.push({
          type: 'log',
          kind: 'del',
          message: `Deleted struct ${contractName}.${structName} at ${sourceName}`,
        });
        continue;
      }

      // Just needed for better types
      if (!currStruct || !prevStruct) throw new Error('Invalid state');

      // There are no changes on this struct
      if (areDeepEqual(currStruct, prevStruct)) continue;

      // Check that the same variable in the struct was not modified
      const commonVariableNames = _intersection(
        currStruct.map((s) => s.name!),
        prevStruct.map((s) => s.name!)
      );
      for (const name of commonVariableNames) {
        const currSlot = currStruct.find((s) => s.name === name)!;
        const prevSlot = prevStruct.find((s) => s.name === name)!;

        if (
          currSlot.slot !== prevSlot.slot ||
          currSlot.offset !== prevSlot.offset ||
          currSlot.size !== prevSlot.size
        ) {
          mutations.push({
            type: 'error',
            kind: 'update',
            message: `Invalid modification of value "${currSlot.type} ${name}" in ${contractName}.${structName} at ${sourceName}`,
          });
          continue;
        }
      }

      // Do not allow to remove variables (they should be renamed to unused)
      for (const prevSlot of prevStruct) {
        const currSlot = currStruct.find((s) => s.name === prevSlot.name);

        // Variable is still there, nothing to check
        if (currSlot) continue;

        const renamedSlot = currStruct.find((slot) => _haveSameSlot(slot, prevSlot));

        if (renamedSlot) {
          mutations.push({
            type: 'log',
            kind: 'update',
            message: `Renamed variable "${prevSlot.type} ${prevSlot.name}" in ${contractName}.${structName} at ${sourceName}`,
          });
        } else {
          mutations.push({
            type: 'error',
            kind: 'del',
            message: `Deleted variable "${prevSlot.type} ${prevSlot.name}" in ${contractName}.${structName} at ${sourceName}`,
          });
        }
      }
    }
  }

  return mutations;
}

function _getUniqKeys(...objs: ({ [k: string]: unknown } | undefined)[]) {
  const set = new Set<string>();
  for (const obj of objs) for (const k of Object.keys(obj || {})) set.add(k);
  return Array.from(set).sort();
}

function _intersection<T>(a: T[], b: T[]) {
  return a.filter((v) => b.includes(v));
}

function _haveSameSlot(a: StorageSlot, b: StorageSlot) {
  return a.slot === b.slot && a.offset === b.offset && a.size === b.size && a.type === b.type;
}
