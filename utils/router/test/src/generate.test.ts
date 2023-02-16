import fs from 'node:fs/promises';
import path from 'node:path';
import { deepEqual, throws } from 'assert/strict';
import { generateRouter } from '../../src/generate';
import { ContractValidationError } from '../../src/internal/errors';
import abi from '../fixtures/SampleABI.json';

const loadFile = (filepath: string) =>
  fs.readFile(path.join(__dirname, filepath)).then((d) => d.toString());

describe('src/generate.ts', function () {
  it('throw an error when generating a router with repeated selectors', async function () {
    throws(() => {
      generateRouter({
        contracts: [
          {
            abi,
            deployedAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            deployTxnHash: '0x849b033c0ee690c8b9a53057495d9b3e16588a26d51a7cad4dfc6cd3d310ce0e',
            contractName: 'SampleModule',
            sourceName: 'contracts/modules/SampleModule.sol',
            contractFullyQualifiedName: 'contracts/modules/SampleModule.sol:SampleModule',
          },
          {
            abi,
            deployedAddress: '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F',
            deployTxnHash: '0x9f8838e6683ef2ff84a0daaef5f85a86545acb934045140054daaf9a858c48a8',
            contractName: 'RepeatedModule',
            sourceName: 'contracts/modules/RepeatedModule.sol',
            contractFullyQualifiedName: 'contracts/modules/RepeatedModule.sol:RepeatedModule',
          },
        ],
      });
    }, ContractValidationError);
  });

  it('correctly compiles SampleRouter.sol', async function () {
    const expected = await loadFile('../fixtures/SampleRouter.sol');
    const result = generateRouter({
      contracts: [
        {
          abi,
          deployedAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          deployTxnHash: '0x849b033c0ee690c8b9a53057495d9b3e16588a26d51a7cad4dfc6cd3d310ce0e',
          contractName: 'SampleModule',
          sourceName: 'contracts/modules/SampleModule.sol',
          contractFullyQualifiedName: 'contracts/modules/SampleModule.sol:SampleModule',
        },
      ],
    });

    deepEqual(result, expected);
  });
});
