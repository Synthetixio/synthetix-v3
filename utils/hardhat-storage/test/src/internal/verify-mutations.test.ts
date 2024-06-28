import { hidrateSlotsLayout } from '../../../src/internal/layout';
import { verifyMutations } from '../../../src/internal/verify-mutations';
import { StorageDump, StorageLayoutStructs } from '../../../src/types';

function fixtureSingleContractDump(contractName: string, structsDefs: StorageLayoutStructs) {
  const structs: StorageLayoutStructs = {};
  for (const structName of Object.keys(structsDefs)) {
    structs[structName] = hidrateSlotsLayout(structsDefs[structName]!);
  }
  return {
    [`contracts/${contractName}.sol:${contractName}`]: {
      name: contractName,
      kind: 'contract',
      structs,
    },
  } satisfies StorageDump;
}

describe('internal/verify-mutations.ts', function () {
  describe('#verifyMutations', function () {
    it('should notify about a contract addition', async function () {
      const curr = fixtureSingleContractDump('AddedContract', {
        Data: [{ type: 'uint128', name: 'someValue' }],
      });

      expect(verifyMutations(curr, {})).toMatchObject([
        {
          kind: 'add',
          type: 'log',
          message: 'Added contract AddedContract at contracts/AddedContract.sol',
        },
      ]);
    });

    it('should notify about a contract deletion', async function () {
      const prev = fixtureSingleContractDump('DeletedContract', {
        Data: [{ type: 'uint128', name: 'someValue' }],
      });

      expect(verifyMutations({}, prev)).toMatchObject([
        {
          kind: 'del',
          type: 'log',
          message: 'Deleted contract DeletedContract at contracts/DeletedContract.sol',
        },
      ]);
    });

    it('should notify about a struct addition', async function () {
      const curr = fixtureSingleContractDump('Contract', {
        Data: [{ type: 'uint128', name: 'someValue' }],
        NewStruct: [{ type: 'uint256', name: 'newValue' }],
      });
      const prev = fixtureSingleContractDump('Contract', {
        Data: [{ type: 'uint128', name: 'someValue' }],
      });

      expect(verifyMutations(curr, prev)).toMatchObject([
        {
          kind: 'add',
          type: 'log',
          message: 'Added struct Contract.NewStruct at contracts/Contract.sol',
        },
      ]);
    });

    it('should notify about a struct deletion', async function () {
      const curr = fixtureSingleContractDump('Contract', {
        Data: [{ type: 'uint128', name: 'someValue' }],
      });
      const prev = fixtureSingleContractDump('Contract', {
        Data: [{ type: 'uint128', name: 'someValue' }],
        DeletedStruct: [{ type: 'uint256', name: 'value' }],
      });

      expect(verifyMutations(curr, prev)).toMatchObject([
        {
          kind: 'del',
          type: 'log',
          message: 'Deleted struct Contract.DeletedStruct at contracts/Contract.sol',
        },
      ]);
    });
  });
});
