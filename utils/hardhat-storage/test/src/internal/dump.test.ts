import path from 'node:path';
import { readArtifact } from '../../../src/internal/artifacts';
import { dumpStorage } from '../../../src/internal/dump';

describe('internal/dump.ts', function () {
  it('single contract with state variables, contracts and structs', async function () {
    async function getArtifact(sourceName: string) {
      const projectRoot = path.resolve(__dirname, '..', '..', 'fixtures');
      return readArtifact(projectRoot, sourceName);
    }

    const contracts = ['ExampleContract.sol:ExampleContract'];

    const result = await dumpStorage({ getArtifact, contracts });
    expect(result).toMatchSnapshot();
  });

  it('sample-project contract with storage and interface', async function () {
    async function getArtifact(sourceName: string) {
      const projectRoot = path.resolve(__dirname, '..', '..', '..', '..', 'sample-project');
      return readArtifact(projectRoot, sourceName);
    }

    const contracts = [
      'contracts/storage/GlobalStorage.sol:GlobalStorage',
      'contracts/interfaces/ISomeModule.sol:ISomeModule',
      'contracts/modules/SomeModule.sol:SomeModule',
    ];

    const result = await dumpStorage({ getArtifact, contracts });
    expect(result).toMatchSnapshot();
  });
});
