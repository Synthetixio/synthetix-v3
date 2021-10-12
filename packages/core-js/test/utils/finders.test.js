const { equal } = require('assert/strict');
const { findContractDependencies, findFunctionSelectors } = require('../../utils/ast/finders');
const asts = require('../fixtures/asts.json');

describe('utils/ast/comparator.js compareStorageStructs', function () {
  describe('find contract dependencies', () => {
    it('finds contract dependencies of a simple contract', async () => {
      const dependencies = await findContractDependencies('AnotherModule', asts);
      equal(dependencies.length, 3, 'AnotherModule should have 3 dependencies');

      equal(
        dependencies.some((v) => v.name === 'AnotherModule'),
        true,
        'AnotherModule should be present in the list of dependencies'
      );
    });
    it('doesnt find a contract for an invalid name', async () => {
      const dependencies = await findContractDependencies('NotAValidModuleName', asts);
      equal(dependencies.length, 0);
    });
  });
  describe('find function selectors', function () {
    it('finds selectors from a simple contract', async () => {
      const selectors = await findFunctionSelectors('AnotherModule', asts);
      equal(selectors.length, 1, 'AnotherModule should have 1 selector');

      equal(selectors[0].selector, '0x45aa2181', 'AnotherModule selector should be 0x45aa2181');
    });
  });
});
