import { deepEqual, equal, notEqual } from 'assert/strict';
import path from 'path';
import { ContractDefinition, SourceUnit, StructDefinition } from 'solidity-ast';
import {
  findContractDefinitions,
  findContractDependencies,
  findContractNode,
  findContractNodeStructs,
  findContractNodeVariables,
  findContractStateVariables,
  findFunctionNodes,
  findFunctionSelectors,
  findImportedContractFullyQualifiedName,
  findYulStorageSlotAssignments,
} from '../../../src/utils/ast/finders';
import asts from '../../fixtures/asts.json';
import noContractAst from '../../fixtures/no-contract-ast.json';
import parseContracts from '../../helpers/parse-contracts';

const jsonAstNodes = Object.values(asts) as SourceUnit[];

describe('utils/ast/finders.ts find AST artifacts', function () {
  let astNodes: SourceUnit[];
  let sources: { [sourceName: string]: SourceUnit };

  before('load sample-project artifacts', async function () {
    const contracts = await parseContracts(
      path.resolve(__dirname, '..', '..', 'fixtures', 'sample-project')
    );
    astNodes = Object.values(contracts.asts!);
    sources = contracts.asts!;
  });

  describe('find contract node', function () {
    it('finds a contract node by fully qualified name', function () {
      const fqName = 'contracts/TokenModule.sol:TokenModule';
      const contractNode = findContractNode(fqName, astNodes);
      equal(contractNode?.name, 'TokenModule');
    });

    it('returns undefined on invalid contract', function () {
      const fqName = 'contracts/TokenModule.sol:InvalidContract';
      const contractNode = findContractNode(fqName, astNodes);
      equal(contractNode, undefined);
    });

    it('returns undefined on invalid source', function () {
      const fqName = 'contracts/InvalidSource.sol:InvalidContract';
      const contractNode = findContractNode(fqName, astNodes);
      equal(contractNode, undefined);
    });
  });

  describe('find contract dependencies', function () {
    it('finds contract dependencies of a simple contract', function () {
      const fqName = 'contracts/MultipleInheritance.sol:MultipleInheritancce';

      deepEqual(findContractDependencies(fqName, astNodes), [
        'contracts/MultipleInheritance.sol:MultipleInheritancce',
        'contracts/MultipleInheritance.sol:SomeModule',
        'contracts/AnotherModule.sol:AnotherModule',
        'contracts/SampleModule.sol:SampleModule',
      ]);
    });

    it('finds contract dependencies of a complex contract', function () {
      const dependencies = findContractDependencies(
        'contracts/modules/SettingsModule.sol:SettingsModule',
        jsonAstNodes
      );
      equal(dependencies.length, 5, 'SettingsModule should have 5 dependencies');

      equal(
        dependencies.includes(
          '@synthetixio/core-contracts/contracts/ownership/OwnableMixin.sol:OwnableMixin'
        ),
        true,
        'OwnableMixin should be present in the list of dependencies (inherited from core-contracts)'
      );
    });
  });

  describe('find function selectors', function () {
    it('finds selectors from a contract', function () {
      const AnotherModule = 'contracts/modules/AnotherModule.sol:AnotherModule';
      const selectors = findFunctionSelectors(AnotherModule, jsonAstNodes);
      equal(selectors.length, 1, 'AnotherModule should have 1 selector');
      equal(selectors[0].selector, '0x45aa2181', 'AnotherModule selector should be 0x45aa2181');
    });

    it('doesnt find selectors from a contract that doesnt expose any', function () {
      const selectors = findFunctionSelectors('contracts/Router.sol:Router', jsonAstNodes);
      equal(selectors.length, 0, 'Router should not have any selector');
    });
  });

  describe('find function', function () {
    it('finds selectors from a contract', function () {
      const functions = findFunctionNodes(
        'contracts/modules/AnotherModule.sol:AnotherModule',
        jsonAstNodes
      );

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

    it('doesnt find selectors from a contract that doesnt expose any', function () {
      const selectors = findFunctionSelectors('contracts/Router.sol:Router', jsonAstNodes);
      equal(selectors.length, 0, 'Router should not have any selector');
    });
  });

  describe('find all the contract definitions on the given node', function () {
    it('finds the expected contract definition on the node', function () {
      const nodes = findContractDefinitions(asts['AnotherModule'] as SourceUnit);
      equal(nodes.length, 1);
      equal(nodes[0].nodeType, 'ContractDefinition');
      equal(nodes[0].name, 'AnotherModule');
    });

    it('doesnt find a contract with an invalid name', function () {
      const nodes = findContractDefinitions(noContractAst as SourceUnit);
      equal(nodes.length, 0);
    });
  });

  describe('find contract node structs', function () {
    it('finds a contract struct', function () {
      const node = findContractNodeStructs(
        asts['SettingsNamespace'] as unknown as ContractDefinition
      );
      notEqual(node, undefined);
      equal(node.length, 1);
      equal(node[0].nodeType, 'StructDefinition');
      equal(node[0].name, 'SettingsStorage');
    });

    it('doesnt find a struct from a contract without one', function () {
      const node = findContractNodeStructs(asts['AnotherModule'] as unknown as ContractDefinition);
      equal(node.length, 0);
    });
  });

  describe('find contract node variables', function () {
    it('finds a variable node with a valid name', function () {
      const node = findContractNodeVariables(
        findContractNodeStructs(asts['SettingsNamespace'] as unknown as ContractDefinition)[0]
      );

      notEqual(node, undefined);
      equal(node.length, 1);
      equal(node[0].nodeType, 'VariableDeclaration');
      equal(node[0].name, 'aSettingValue');
    });
  });

  describe('find contract node state variables', function () {
    it('doesnt find a state variable', function () {
      const contractNode = findContractNode('contracts/SampleModule.sol:SampleModule', astNodes);
      const node = findContractStateVariables(contractNode as unknown as StructDefinition); // TODO
      equal(node.length, 0);
    });

    it('should find a state variables', function () {
      const contractNode = findContractNode('contracts/TokenModule.sol:TokenModule', astNodes);
      const node = findContractStateVariables(contractNode as unknown as StructDefinition); // TODO
      equal(node.length, 1);
    });
  });

  describe('find storage slot assignments (YUL)', function () {
    it('finds storage slot assignemnts', function () {
      const slots = findYulStorageSlotAssignments(
        asts['SettingsNamespace'] as unknown as ContractDefinition
      );
      notEqual(slots, undefined);
      equal(slots.length, 1);
      equal(slots[0], '0x64b748fbda347b7e22c5029a23b4e647df311daee8f2a42947ab7ccf61af2e87');
    });

    it('doesnt find storage slot assignemnts', function () {
      const slots = findYulStorageSlotAssignments(
        asts['AnotherModule'] as unknown as ContractDefinition
      );
      notEqual(slots, undefined);
      equal(slots.length == 0, true);
    });
  });

  describe('find the fully qualified name of a imported contract', function () {
    it('finds a globally imported contract', function () {
      const result = findImportedContractFullyQualifiedName(
        'ERC20',
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        sources['contracts/Token.sol'],
        astNodes
      );

      equal(result, '@synthetixio/core-contracts/contracts/token/ERC20.sol:ERC20');
    });

    it('finds a aliased imported contract', function () {
      const result = findImportedContractFullyQualifiedName(
        'ERC721Base',
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        sources['contracts/Token.sol'],
        astNodes
      );

      equal(result, '@synthetixio/core-contracts/contracts/token/ERC721.sol:ERC721');
    });

    it('returns undefined when not finding it', function () {
      const result = findImportedContractFullyQualifiedName(
        'UnexistantContract',
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        sources['contracts/Token.sol'],
        astNodes
      );

      equal(result, undefined);
    });
  });
});
