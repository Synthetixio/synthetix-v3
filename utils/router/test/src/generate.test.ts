import fs from 'node:fs/promises';
import path from 'node:path';
import { deepEqual } from 'assert/strict';
import { generateRouter } from '../../src/generate';
import abi from '../fixtures/SampleABI.json';

const loadFile = (filepath: string) =>
  fs.readFile(path.join(__dirname, filepath)).then((d) => d.toString());

describe('src/generate.ts', function () {
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
