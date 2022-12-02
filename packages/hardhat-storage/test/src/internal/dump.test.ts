import path from 'node:path';
import { parseAsts } from '@synthetixio/core-utils/utils/ast/parse';
import { dumpStorage } from '../../../src/internal/dump';

const version = '0.8.11';

describe('internal/dump.ts', function () {
  jest.setTimeout(120000);

  it('single contract with state variables, contracts and structs', async function () {
    const astNodes = await parseAsts({
      version,
      rootDir: path.resolve(__dirname, '..', '..', 'fixtures'),
      sources: 'ExampleContract.sol',
    });

    const result = await dumpStorage(astNodes, version);
    expect(result).toMatchSnapshot();
  });

  it('smple-project contract with storage and interface', async function () {
    const astNodes = await parseAsts({
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
