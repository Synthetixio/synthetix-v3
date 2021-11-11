const { equal, notEqual } = require('assert/strict');
const {
  findContractDependencies,
  findFunctionSelectors,
  findContractNodeWithName,
  findContractNodeWithId,
  findContractNodeStructs,
  findContractNodeVariables,
  findContractStateVariables,
  findInheritedContractNames,
  findYulCaseValues,
  findYulStorageSlotAssignments,
} = require('../../../utils/ast/finders');
const asts = require('../../fixtures/asts.json');

describe('utils/ast/finders.js find AST artifacts', function () {
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
    it('finds contract dependencies of a complex contract', async () => {
      const dependencies = await findContractDependencies('SettingsModule', asts);
      equal(dependencies.length, 5, 'SettingsModule should have 5 dependencies');

      equal(
        dependencies.some((v) => v.name === 'OwnableMixin'),
        true,
        'OwnableMixin should be present in the list of dependencies (inherited from core-contracts)'
      );
    });
  });

  describe('find function selectors', function () {
    it('finds selectors from a contract', async () => {
      const selectors = await findFunctionSelectors('AnotherModule', asts);
      equal(selectors.length, 1, 'AnotherModule should have 1 selector');

      equal(selectors[0].selector, '0x45aa2181', 'AnotherModule selector should be 0x45aa2181');
    });
    it('doesnt find selectors from a contract that doesnt expose any', async () => {
      const selectors = await findFunctionSelectors('Router', asts);
      equal(selectors.length, 0, 'Router should not have any selector');
    });
  });

  describe('find contract node by name', function () {
    it('finds a contract with a valid name', async () => {
      const node = await findContractNodeWithName('AnotherModule', asts['AnotherModule']);
      notEqual(node, undefined);
      equal(node.nodeType, 'ContractDefinition');
      equal(node.name, 'AnotherModule');
    });
    it('doesnt find a contract with an invalid name', async () => {
      const node = await findContractNodeWithName('NotAValidModuleName', asts['AnotherModule']);
      equal(node, undefined, 'NotAValidModuleName should not be found');
    });
  });

  describe('find contract node by id', function () {
    it('finds a contract with a valid id', async () => {
      const node = await findContractNodeWithId(620, asts['AnotherModule']);
      notEqual(node, undefined);
      equal(node.nodeType, 'ContractDefinition');
      equal(node.name, 'AnotherModule');
      equal(node.id, 620);
    });
    it('doesnt find a contract with an invalid name', async () => {
      const node = await findContractNodeWithName(549, asts['AnotherModule']);
      equal(node, undefined);
    });
  });

  describe('find contract node structs', function () {
    it('finds a contract struct', async () => {
      const node = await findContractNodeStructs(asts['SettingsNamespace']);
      notEqual(node, undefined);
      equal(node.length, 1);
      equal(node[0].nodeType, 'StructDefinition');
      equal(node[0].name, 'SettingsStorage');
    });
    it('doesnt find a struct from a contract without one', async () => {
      const node = await findContractNodeStructs(asts['AnotherModule']);
      equal(node.length, 0);
    });
  });

  describe('find contract node variables', function () {
    it('finds a variable node with a valid name', async () => {
      const node = await findContractNodeVariables(
        findContractNodeStructs(asts['SettingsNamespace'])[0]
      );
      notEqual(node, undefined);
      equal(node.length, 1);
      equal(node[0].nodeType, 'VariableDeclaration');
      equal(node[0].name, 'aSettingValue');
    });
  });

  describe('find contract node state variables', function () {
    it('doesnt find a state variable', async () => {
      const node = await findContractStateVariables('SettingsNamespace', asts['SettingsNamespace']);
      notEqual(node, undefined);
      equal(node.length, 0);
    });
  });

  describe('find inherited contract names', function () {
    it('finds contract names', async () => {
      const node = await findInheritedContractNames(
        await findContractNodeWithName('SettingsModule', asts['SettingsModule'])
      );
      notEqual(node, undefined);
      equal(node.length, 2);
      equal(
        node.some((v) => v === 'SettingsNamespace'),
        true
      );
      equal(
        node.some((v) => v === 'OwnerMixin'),
        true
      );
    });
  });

  describe('find case vaules (YUL)', function () {
    it('finds case values from Router contract', async () => {
      const routerSelectors = findYulCaseValues('Router', asts['Router']);
      notEqual(routerSelectors, undefined);
      equal(routerSelectors.length > 2, true);
      equal(
        routerSelectors.some(
          (v) => v.selector === '0x45aa2181' && v.value.name === '_ANOTHER_MODULE'
        ),
        true
      );
    });
    it('doesnt find case values on not-case contract', async () => {
      const routerSelectors = findYulCaseValues('AnotherModule', asts['AnotherModule']);
      notEqual(routerSelectors, undefined);
      equal(routerSelectors.length == 0, true);
    });
  });

  describe('find storage slot assignments (YUL)', function () {
    it('finds storage slot assignemnts', async () => {
      const slots = findYulStorageSlotAssignments('SettingsNamespace', asts['SettingsNamespace']);
      notEqual(slots, undefined);
      equal(slots.length == 1, true);
      equal(slots[0], '0x64b748fbda347b7e22c5029a23b4e647df311daee8f2a42947ab7ccf61af2e87');
    });
    it('doesnt find storage slot assignemnts', async () => {
      const slots = findYulStorageSlotAssignments('AnotherModule', asts['AnotherModule']);
      notEqual(slots, undefined);
      equal(slots.length == 0, true);
    });
    // ,
  });
});
