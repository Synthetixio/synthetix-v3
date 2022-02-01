const { parseFullyQualifiedName } = require('hardhat/utils/contract-names');
const { findAll } = require('solidity-ast/utils');

/**
 * Get all the contract definitions on the given node
 * @param {import("solidity-ast").SourceUnit} astNode
 * @returns {import("solidity-ast").ContractDefinition[]}
 */
function findContractDefinitions(astNode) {
  return Array.from(findAll('ContractDefinition', astNode));
}

/**
 * Get the given contract by name on the given AST
 * @param {string} contractName
 * @param {import("solidity-ast").SourceUnit|import("solidity-ast").SourceUnit[]} astNodes
 * @returns {import("solidity-ast").ContractDefinition}
 */
function findContractNodeWithName(contractName, astNodes) {
  if (Array.isArray(astNodes)) {
    for (const astNode of astNodes) {
      const contractDefiniton = findContractNodeWithName(contractName, astNode);
      if (contractDefiniton) return contractDefiniton;
    }
  }

  for (const contractDefiniton of findAll('ContractDefinition', astNodes)) {
    if (contractDefiniton.name === contractName) {
      return contractDefiniton;
    }
  }
}

/**
 * Get all the variable nodes defined on a contract node
 * @param {import("solidity-ast").ContractDefinition} contractNode
 * @returns {import("solidity-ast").VariableDeclaration}
 */
function findContractNodeVariables(contractNode) {
  return Array.from(findAll('VariableDeclaration', contractNode));
}

/**
 * Get all the structs definitions on a contract node
 * @param {import("solidity-ast").ContractDefinition} contractNode
 * @returns {import("solidity-ast").StructDefinition}
 */
function findContractNodeStructs(contractNode) {
  return Array.from(findAll('StructDefinition', contractNode));
}

/**
 * Get the state variables from the given contract name
 * @param {import("solidity-ast").ContractDefinition} contractNode
 * @returns {import("solidity-ast").VariableDeclaration}
 */
function findContractStateVariables(contractNode) {
  return findContractNodeVariables(contractNode).filter((n) => n.stateVariable);
}

/**
 * Find all the slot definitions on the given AST node
 * @param {import("solidity-ast").ContractDefinition} contractNode
 * @returns {string[]}
 */
function findYulStorageSlotAssignments(contractNode) {
  return Array.from(findAll('YulAssignment', contractNode))
    .filter((assignment) => assignment.variableNames[0].name.endsWith('.slot'))
    .map((assignment) => assignment.value.value);
}

/**
 * Get all the case values from the given contract node
 * @param {string} contractName
 * @param {import("solidity-ast").ContractDefinition} contractNode
 * @returns {{ selector: string, value?: string }[]}
 */
function findYulCaseValues(contractNode) {
  const addressVariables = findContractNodeVariables(contractNode);

  const items = [];
  for (const caseSelector of findAll('YulCase', contractNode)) {
    if (caseSelector.value === 'default') continue;
    if (caseSelector.value.value === '0') continue;

    const caseAssignment = findAll('YulAssignment', caseSelector);
    const nextCaseAssignment = caseAssignment.next();

    items.push({
      selector: caseSelector.value.value,
      value: addressVariables.find((v) => v.name === nextCaseAssignment.value.value.name),
    });
  }

  return items;
}

function _findFunctionSelectors(contractNode) {
  const selectors = [];

  for (const functionDefinition of findAll('FunctionDefinition', contractNode)) {
    if (functionDefinition.functionSelector) {
      selectors.push({ selector: '0x' + functionDefinition.functionSelector });
    }
  }

  return selectors;
}

/**
 * Get the complete tree of dependencies from the given contract. This methods
 * takes an objects with the keys from all the contracts and the values are their
 * AST nodes.
 * @param {string} contractFullyQualifiedName
 * @param {import("solidity-ast").SourceUnit[]} astNodes
 * @returns {string[]}
 */
function findContractDependencies(contractFullyQualifiedName, astNodes) {
  const { baseNode, contractNode } = _findContractSourceByFullyQualifiedName(
    contractFullyQualifiedName,
    astNodes
  );

  const inheritedCotractsFullyQualifiedNames = _findInheritedContractsLocalNodeNames(
    contractNode,
    baseNode
  ).map((localContractName) =>
    _findLocalContractFullyQualifiedName(localContractName, baseNode, astNodes)
  );

  return [
    contractFullyQualifiedName,
    ...inheritedCotractsFullyQualifiedNames.flatMap((inheritedContractFullyQualifiedName) =>
      findContractDependencies(inheritedContractFullyQualifiedName, astNodes)
    ),
  ].flat();
}

function _findSourceUnitByAbsolutePath(absolutePath, astNodes) {
  for (const astNode of astNodes) {
    for (const sourceUnitNode of findAll('SourceUnit', astNode)) {
      if (sourceUnitNode.absolutePath === absolutePath) {
        return sourceUnitNode;
      }
    }
  }
}

function _findContractSourceByFullyQualifiedName(contractFullyQualifiedName, astNodes) {
  const { sourceName, contractName } = parseFullyQualifiedName(contractFullyQualifiedName);
  const baseNode = _findSourceUnitByAbsolutePath(sourceName, astNodes);
  const contractNode = findContractNodeWithName(contractName, baseNode);
  return { baseNode, contractNode };
}

function _findInheritedContractsLocalNodeNames(contractNode, sourceUnitNode) {
  return Array.from(findAll('InheritanceSpecifier', contractNode))
    .map((inheritNode) => inheritNode.baseName.referencedDeclaration)
    .map(
      (declarationId) =>
        Object.entries(sourceUnitNode.exportedSymbols).find(([, ids]) =>
          ids.includes(declarationId)
        )[0]
    );
}

function _findLocalContractFullyQualifiedName(localContractName, localSourceUnitNode, astNodes) {
  // First, check if the contract was created locally
  const localContractNode = findContractNodeWithName(localContractName, localSourceUnitNode);
  if (localContractNode) {
    return `${localSourceUnitNode.absolutePath}:${localContractName}`;
  }

  // If not, look it on the imports
  return findImportedContractFullyQualifiedName(localContractName, localSourceUnitNode, astNodes);
}

/**
 * Get the complete tree of dependencies from the given contract. This methods
 * takes an objects with the keys from all the contracts and the values are their
 * AST nodes.
 * @param {string} contractFullyQualifiedName
 * @param {import("solidity-ast").SourceUnit[]} astNodes
 * @returns {string[]}
 */
function findContractNode(contractFullyQualifiedName, astNodes) {
  const { contractNode } = _findContractSourceByFullyQualifiedName(
    contractFullyQualifiedName,
    astNodes
  );

  return contractNode;
}

/**
 * Get the fully qualified name of a local contract on a given AST node. Takes
 * into account any possible aliases given to it during import.
 * @param {string} localContractName The name given locally to the contract on baseAstNode
 * @param {import("solidity-ast").SourceUnit} baseAstNode The AST node of the solidity file.
 * @param {import("solidity-ast").SourceUnit[]} astNodes
 * @returns {string}
 */
function findImportedContractFullyQualifiedName(localContractName, baseAstNode, astNodes) {
  for (const importNode of findAll('ImportDirective', baseAstNode)) {
    const contractSource = importNode.absolutePath;

    if (importNode.symbolAliases.length > 0) {
      const alias = importNode.symbolAliases.find((alias) => alias.local === localContractName);

      if (alias) {
        return `${contractSource}:${alias.foreign.name}`;
      }
    }

    const importedSourceNode = _findSourceUnitByAbsolutePath(importNode.absolutePath, astNodes);
    const importedContractNodes = Array.from(findAll('ContractDefinition', importedSourceNode));
    const importedContract = importedContractNodes.find(({ name }) => name === localContractName);

    if (importedContract) {
      return `${contractSource}:${importedContract.name}`;
    }
  }
}

/**
 * Get all the function selectors definitions from the complete tree of contract
 * nodes starting from the given root contract definition
 * @param {string} contractName
 * @param {import("solidity-ast").SourceUnit[]} astNodes
 * @returns {import("solidity-ast").ContractDefinition[]}
 */
function findFunctionSelectors(contractName, astNodes) {
  const selectors = [];

  for (const contractNode of findContractDependencies(contractName, astNodes)) {
    const currentSelectors = _findFunctionSelectors(contractNode);
    if (currentSelectors.length > 0) {
      selectors.push(...currentSelectors);
    }
  }

  return selectors;
}

/**
 * Get all the function definitions from the complete tree of contract
 * nodes starting from the given root contract definition
 * @param {string} contractFullyQualifiedName
 * @param {import("solidity-ast").SourceUnit[]} astNodes
 * @returns {import("solidity-ast").FunctionDefinition[]}
 */
function findFunctionNodes(contractFullyQualifiedName, astNodes) {
  return findContractDependencies(contractFullyQualifiedName, astNodes).flatMap(
    (contractFullyQualifiedName) => {
      const { contractNode } = _findContractSourceByFullyQualifiedName(
        contractFullyQualifiedName,
        astNodes
      );

      return Array.from(findAll('FunctionDefinition', contractNode));
    }
  );
}

module.exports = {
  findContractDefinitions,
  findYulCaseValues,
  findYulStorageSlotAssignments,
  findContractNodeWithName,
  findContractNodeVariables,
  findContractNodeStructs,
  findContractStateVariables,
  findContractDependencies,
  findContractNode,
  findImportedContractFullyQualifiedName,
  findFunctionSelectors,
  findFunctionNodes,
};
