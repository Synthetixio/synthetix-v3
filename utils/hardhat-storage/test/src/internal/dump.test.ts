import path from 'node:path';
import { compileSolidityFolder } from '@synthetixio/core-utils/utils/solidity/compiler';
import { dumpStorage } from '../../../src/internal/dump';

const version = '0.8.17';

describe('internal/dump.ts', function () {
  jest.setTimeout(120000);

  it('single contract with state variables, contracts and structs', async function () {
    const astNodes = await compileSolidityFolder({
      version,
      rootDir: path.resolve(__dirname, '..', '..', 'fixtures'),
      sources: 'ExampleContract.sol',
    });

    const result = await dumpStorage(astNodes, version);
    expect(result).toMatchSnapshot();
  });

  it('sample-project contract with storage and interface', async function () {
    const astNodes = await compileSolidityFolder({
      version,
      rootDir: path.resolve(__dirname, '..', '..', '..', '..', 'sample-project'),
      sources: [
        'contracts/storage/GlobalStorage.sol',
        'contracts/interfaces/ISomeModule.sol',
        'contracts/modules/SomeModule.sol',
      ],
    });

    const result = await dumpStorage(astNodes, version);
    expect(result).toMatchSnapshot();
  });
});
