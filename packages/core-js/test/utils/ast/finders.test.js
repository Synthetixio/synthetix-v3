const path = require('path');
const { equal, notEqual } = require('assert/strict');
const {
  findContractDependencies,
  findFunctionSelectors,
  findFunctions,
  findContractNodeWithName,
  findContractNodeWithId,
  findContractNodeStructs,
  findContractNodeVariables,
  findContractStateVariables,
  findYulCaseValues,
  findYulStorageSlotAssignments,
  findContractDefinitions,
  contractHasDependency,
  findImportedContractFullyQualifiedName,
} = require('../../../utils/ast/finders');
const asts = require('../../fixtures/asts.json');
const noContractAst = require('../../fixtures/no-contract-ast.json');
const parseContracts = require('../../helpers/parse-contracts');

const astNodes = Object.values(asts);

describe('utils/ast/finders.js find AST artifacts', function () {
  let sampleProject;
  let sampleProjectAstNodes;

  before('load sample-project artifacts', async function () {
    const envPath = path.join(__dirname, '..', '..', 'fixtures', 'sample-project');
    sampleProject = await parseContracts(envPath);
    sampleProjectAstNodes = Object.values(sampleProject.asts);
  });

  describe('find contract dependencies', function () {
    it('finds contract dependencies of a simple contract', async () => {
      const dependencies = await findContractDependencies('AnotherModule', astNodes);
      equal(dependencies.length, 3, 'AnotherModule should have 3 dependencies');

      equal(
        dependencies.some((v) => v.name === 'AnotherModule'),
        true,
        'AnotherModule should be present in the list of dependencies'
      );
    });

    it('doesnt find a contract for an invalid name', async () => {
      const dependencies = await findContractDependencies('NotAValidModuleName', astNodes);
      equal(dependencies.length, 0);
    });

    it('doesnt find a contract for a missing ast', async () => {
      const dependencies = await findContractDependencies('MissingModule', []);
      equal(dependencies.length, 0);
    });

    it('finds contract dependencies of a complex contract', async () => {
      const dependencies = await findContractDependencies('SettingsModule', astNodes);
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
      const selectors = await findFunctionSelectors('AnotherModule', astNodes);
      equal(selectors.length, 1, 'AnotherModule should have 1 selector');
      equal(selectors[0].selector, '0x45aa2181', 'AnotherModule selector should be 0x45aa2181');
    });

    it('doesnt find selectors from a contract that doesnt expose any', async () => {
      const selectors = await findFunctionSelectors('Router', astNodes);
      equal(selectors.length, 0, 'Router should not have any selector');
    });
  });

  describe('find function', function () {
    it('finds selectors from a contract', async () => {
      const functions = await findFunctions('AnotherModule', astNodes);

      equal(functions.length, 3, 'AnotherModule should have 1 function');
      equal(
        functions[0].functionSelector,
        '45aa2181',
        'AnotherModule first function selector should be 45aa2181'
      );
      equal(
        functions[0].name,
        'setSomeValueOnSomeModule',
        'AnotherModule first function name should be setSomeValueOnSomeModule'
      );
    });

    it('doesnt find selectors from a contract that doesnt expose any', async () => {
      const selectors = await findFunctionSelectors('Router', astNodes);
      equal(selectors.length, 0, 'Router should not have any selector');
    });
  });

  describe('find all the contract definitions on the given node', function () {
    it('finds the expected contract definition on the node', async () => {
      const nodes = await findContractDefinitions(asts['AnotherModule']);
      equal(nodes.length, 1);
      equal(nodes[0].nodeType, 'ContractDefinition');
      equal(nodes[0].name, 'AnotherModule');
    });

    it('doesnt find a contract with an invalid name', async () => {
      const nodes = await findContractDefinitions(noContractAst);
      equal(nodes.length, 0);
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

  describe('find case vaules (YUL)', function () {
    it('finds case values from Router contract', async () => {
      const routerSelectors = findYulCaseValues(asts['Router']);
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
      const routerSelectors = findYulCaseValues(asts['AnotherModule']);
      notEqual(routerSelectors, undefined);
      equal(routerSelectors.length == 0, true);
    });
  });

  describe('find storage slot assignments (YUL)', function () {
    it('finds storage slot assignemnts', async () => {
      const slots = findYulStorageSlotAssignments(asts['SettingsNamespace']);
      notEqual(slots, undefined);
      equal(slots.length == 1, true);
      equal(slots[0], '0x64b748fbda347b7e22c5029a23b4e647df311daee8f2a42947ab7ccf61af2e87');
    });

    it('doesnt find storage slot assignemnts', async () => {
      const slots = findYulStorageSlotAssignments(asts['AnotherModule']);
      notEqual(slots, undefined);
      equal(slots.length == 0, true);
    });
  });

  describe('check if a contract has a dependency', function () {
    it('returns true when a contract has the given dependency by contractName', function () {
      const result = contractHasDependency('Token', 'ERC20', sampleProjectAstNodes);
      equal(result, true);
    });

    it('returns false when a contract does not have the given dependency by contractName', function () {
      const result = contractHasDependency('Token', 'Unexistant', sampleProjectAstNodes);
      equal(result, false);
    });

    it('returns true when a contract has the given dependency by contractNode', function () {
      const contractNode = findContractNodeWithName(
        'Token',
        sampleProject.asts['contracts/Token.sol']
      );

      const result = contractHasDependency(contractNode, 'ERC20', sampleProjectAstNodes);
      equal(result, true);
    });

    it('returns false when a contract does not have the given dependency by contractNode', function () {
      const contractNode = findContractNodeWithName(
        'Token',
        sampleProject.asts['contracts/Token.sol']
      );

      const result = contractHasDependency(contractNode, 'Unexistant', sampleProjectAstNodes);
      equal(result, false);
    });
  });

  describe('find the fully qualified name of a imported contract', function () {
    it('finds a globally imported contract', function () {
      const result = findImportedContractFullyQualifiedName(
        'ERC20',
        sampleProject.asts['contracts/Token.sol'],
        sampleProjectAstNodes
      );

      equal(result, '@synthetixio/core-contracts/contracts/token/ERC20.sol:ERC20');
    });

    it('finds a aliased imported contract', function () {
      const result = findImportedContractFullyQualifiedName(
        'ERC721Base',
        sampleProject.asts['contracts/Token.sol'],
        sampleProjectAstNodes
      );

      equal(result, '@synthetixio/core-contracts/contracts/token/ERC721.sol:ERC721');
    });

    it('returns undefined when not finding it', function () {
      const result = findImportedContractFullyQualifiedName(
        'UnexistantContract',
        sampleProject.asts['contracts/Token.sol'],
        sampleProjectAstNodes
      );

      equal(result, undefined);
    });
  });
});
