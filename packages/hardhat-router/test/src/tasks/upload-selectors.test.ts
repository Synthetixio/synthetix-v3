import { ok, equal } from 'assert/strict';
import { JsonFragment } from '@ethersproject/abi';
import * as fourbytes from '../../../src/internal/fourbytes';
import { TASK_UPLOAD_SELECTORS } from '../../../src/task-names';
import { loadEnvironment } from '../../helpers/use-environment';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

describe('tasks/upload-selectors.ts', function () {
  let hre: HardhatRuntimeEnvironment;
  let importedAbis: JsonFragment[][] = [];

  before('mock 4bytes api', function () {
    fourbytes._mockImportAbi(function mockedImportAbi(abi: JsonFragment[]) {
      importedAbis.push(abi);

      return {
        num_processed: abi.length,
        num_imported: abi.length,
        num_duplicates: 0,
        num_ignored: 0,
      };
    });
  });

  beforeEach('clear 4bytes api mock', function () {
    importedAbis = [];
  });

  before('prepare environment', async function () {
    hre = loadEnvironment(this);
  });

  describe('uploading all the local abis', function () {
    it('made the appropiate import-abi calls', async function () {
      await hre.run(TASK_UPLOAD_SELECTORS, { quiet: true });

      // Check that imported a single ABI with all the items
      ok(importedAbis.length === 1);
      ok(importedAbis[0].length > 0);

      // Only imported function and event items
      equal(
        importedAbis[0].find((item) => item.type !== 'function' && item.type !== 'event'),
        undefined
      );
    });
  });
});
