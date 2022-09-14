const path = require('path');
const { ok, equal, deepEqual, rejects } = require('assert/strict');
const fourbytes = require('../../internal/fourbytes');
const { TASK_UPLOAD_SELECTORS } = require('../../task-names');
const { loadEnvironment, deployOnEnvironment } = require('../helpers/use-environment');

describe('deploy:upload-selectors', function () {
  let hre;
  let importedAbis = [];

  before('mock 4bytes api', function () {
    fourbytes.importAbi = function (abi) {
      importedAbis.push(abi);

      return {
        num_processed: abi.length,
        num_imported: abi.length,
        num_duplicates: 0,
        num_ignored: 0,
      };
    };
  });

  beforeEach('clear 4bytes api mock', function () {
    importedAbis = [];
  });

  before('prepare environment', async function () {
    this.timeout(60000);

    hre = loadEnvironment(
      path.dirname(require.resolve('@synthetixio/sample-project/package.json'))
    );

    await deployOnEnvironment(hre, {
      alias: 'first',
      clear: true,
    });
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

  describe('when calling with an include statement', function () {
    it('correctly filters a single contract', async function () {
      const contractName = 'contracts/modules/SomeModule.sol:SomeModule';
      const contractAbi = filterBy(
        hre.router.deployment.abis[contractName],
        'type',
        'function',
        'event'
      );

      await hre.run(TASK_UPLOAD_SELECTORS, {
        quiet: true,
        include: contractName,
      });

      deepEqual(importedAbis, [contractAbi]);
    });

    it('correctly filters a multiple contracts', async function () {
      const contractName1 = 'contracts/modules/SomeModule.sol:SomeModule';
      const contractAbi1 = hre.router.deployment.abis[contractName1];
      const contractName2 = 'contracts/modules/UpgradeModule.sol:UpgradeModule';
      const contractAbi2 = hre.router.deployment.abis[contractName2];

      const expectedAbi = filterBy([...contractAbi1, ...contractAbi2], 'type', 'function', 'event');

      await hre.run(TASK_UPLOAD_SELECTORS, {
        quiet: true,
        include: `${contractName1},${contractName2}`,
      });

      equal(importedAbis.length, 1);
      unorderedDeepEqual(expectedAbi, importedAbis[0]);
    });

    it('throws an error on invalid contracts', async function () {
      await rejects(
        () =>
          hre.run(TASK_UPLOAD_SELECTORS, {
            quiet: true,
            include: 'contracts/modules/MissingModule.sol:MissingModule',
          }),
        {
          message: 'No contracts found',
        }
      );
    });
  });
});

function filterBy(arrOfObjects, key, ...values) {
  return arrOfObjects.filter((obj) => values.includes(obj[key]));
}

function findItem(arr, item) {
  return arr.find((j) => {
    try {
      deepEqual(item, j);
      return true;
    } catch (_) {
      return false;
    }
  });
}

/**
 * Check that both arrays are the same, without taking into account the order of
 * its children.
 * @param {unknown[]} actual
 * @param {unknown[]} expected
 */
function unorderedDeepEqual(actual, expected) {
  ok(Array.isArray(actual), 'actual should be an array');
  ok(Array.isArray(expected), 'expected should be an array');
  equal(actual.length, expected.length, 'arrays should have the same amout of items');

  for (const expectedItem of expected) {
    const actualItem = findItem(actual, expectedItem);
    deepEqual(expectedItem, actualItem);
  }
}
