const { deepStrictEqual } = require('assert/strict');
const fs = require('fs/promises');
const path = require('path');
const RouterSourceValidator = require('../../../src/internal/router-source-validator');

const loadRouter = async (name) => {
  return await fs
    .readFile(path.resolve(__dirname, '..', '..', 'fixtures', 'contracts', name))
    .then((res) => res.toString());
};

describe('internal/router-source-validator.js', function () {
  describe('validations without errors (happy path)', () => {
    it('should not find errors in a correctly written Router', async () => {
      const errorsFound = [];

      const validator = new RouterSourceValidator({
        getModulesSelectors: async () => [
          {
            name: 'getASettingValue',
            selector: '0x1098c085',
            contractName: 'SettingsModule',
          },
          {
            name: 'nominateNewOwner',
            selector: '0x1627540c',
            contractName: 'SampleOwnerModule',
          },
        ],
        getRouterSource: async () => loadRouter('ValidRouter.sol'),
      });

      errorsFound.push(...(await validator.findMissingModuleSelectors()));
      errorsFound.push(...(await validator.findRepeatedModuleSelectors()));

      deepStrictEqual(errorsFound, []);
    });
  });

  describe('validations with errors', function () {
    it('should return an error on missing selector', async function () {
      const errorsFound = [];
      const selector = {
        name: 'unexistantMethod',
        selector: '0x11111111',
        contractName: 'SomeUnexistantModule',
      };

      const validator = new RouterSourceValidator({
        getModulesSelectors: async () => [selector],
        getRouterSource: async () => loadRouter('ValidRouter.sol'),
      });

      errorsFound.push(...(await validator.findMissingModuleSelectors()));
      errorsFound.push(...(await validator.findRepeatedModuleSelectors()));

      deepStrictEqual(errorsFound, [
        {
          missingInRouter: true,
          moduleSelector: selector,
          msg: 'Selector for SomeUnexistantModule.unexistantMethod not found in router',
        },
      ]);
    });

    it('should return an error on repeated selector', async function () {
      const errorsFound = [];
      const selector = {
        name: 'setSomeValue',
        selector: '0xe53831ed',
        contractName: 'SomeModule',
      };

      const validator = new RouterSourceValidator({
        getModulesSelectors: async () => [selector],
        getRouterSource: async () => loadRouter('RepeatedSelectorRouter.sol'),
      });

      errorsFound.push(...(await validator.findMissingModuleSelectors()));
      errorsFound.push(...(await validator.findRepeatedModuleSelectors()));

      deepStrictEqual(errorsFound, [
        {
          repeatedInRouter: true,
          selector: '0xe53831ed',
          msg: 'Selector case 0xe53831ed found 2 times instead of the expected single time. Matches:  case 0xe53831ed {, case 0xe53831ed {',
        },
      ]);
    });
  });
});
