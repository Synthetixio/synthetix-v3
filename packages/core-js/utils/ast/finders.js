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
 * Get the given contract by id on the given AST
 * @param {number} contractId
 * @param {import("solidity-ast").SourceUnit} astNode
 * @returns {import("solidity-ast").ContractDefinition}
 */
function findContractNodeWithId(contractId, astNode) {
  for (const contractDefiniton of findAll('ContractDefinition', astNode)) {
    if (contractDefiniton.id === contractId) {
      return contractDefiniton;
    }
  }
}

/**
 * Get the given contract by name on the given AST
 * @param {string} contractName
 * @param {import("solidity-ast").SourceUnit} astNode
 * @returns {import("solidity-ast").ContractDefinition}
 */
function findContractNodeWithName(contractName, astNode) {
  for (const contractDefiniton of findAll('ContractDefinition', astNode)) {
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
 * @param {string} contractName
 * @param {import("solidity-ast").ContractDefinition} contractNode
 * @returns {import("solidity-ast").VariableDeclaration}
 */
function findContractStateVariables(contractNode) {
  return findContractNodeVariables(contractNode).filter((n) => n.stateVariable);
}

/**
 * Find all the slot definitions on the given AST node
 * @param {string} contractName
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
    const assignmentValue = caseAssignment ? caseAssignment.next() : null;

    items.push({
      selector: caseSelector.value.value,
      value: assignmentValue
        ? addressVariables.find((v) => v.name === assignmentValue.value.value.name)
        : null,
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
 * @param {string} contractName
 * @param {import("solidity-ast").SourceUnit[]} astNodes
 * @returns {import("solidity-ast").ContractDefinition[]}
 */
function findContractDependencies(contractName, astNodes) {
  let contractNode;

  for (const astNode of astNodes) {
    const node = findContractNodeWithName(contractName, astNode);
    if (node) {
      contractNode = node;
      break;
    }
  }

  if (!contractNode) {
    return [];
  }

  const dependencyContractNodes = [];

  for (const baseContractId of contractNode.linearizedBaseContracts) {
    for (const astNode of astNodes) {
      const dependencyNode = findContractNodeWithId(baseContractId, astNode);
      if (dependencyNode) {
        dependencyContractNodes.push(dependencyNode);
      }
    }
  }

  return dependencyContractNodes;
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

module.exports = {
  findContractDefinitions,
  findYulCaseValues,
  findYulStorageSlotAssignments,
  findContractNodeWithName,
  findContractNodeWithId,
  findContractNodeVariables,
  findContractNodeStructs,
  findContractStateVariables,
  findContractDependencies,
  findFunctionSelectors,
};
