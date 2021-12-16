const { findAll } = require('solidity-ast/utils');

/**
 * Get the given contract by id on the given AST
 * @param {number} contractId
 * @param {import("solidity-ast").SourceUnit} astNode
 * @returns {import("solidity-ast").ContractDefinition} contractDefinitionNode
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
 * @returns {import("solidity-ast").ContractDefinition} contractDefinitionNode
 */
function findContractNodeWithName(contractName, astNode) {
  for (const contractDefiniton of findAll('ContractDefinition', astNode)) {
    if (contractDefiniton.name === contractName) {
      return contractDefiniton;
    }
  }
}

/**
 * Get the first contract defined on the given AST
 * @param {import("solidity-ast").SourceUnit} astNode
 * @returns {import("solidity-ast").ContractDefinition} contractDefinitionNode
 */
function getFirstContractNode(astNode) {
  if (!astNode) return undefined;

  for (const contractDefinitionNode of findAll('ContractDefinition', astNode)) {
    return contractDefinitionNode;
  }
}

function findContractNodeVariables(contractNode) {
  return Array.from(findAll('VariableDeclaration', contractNode));
}

function findContractNodeStructs(contractNode) {
  return Array.from(findAll('StructDefinition', contractNode));
}

function findContractStateVariables(contractName, astNode) {
  return findContractNodeVariables(getFirstContractNode(astNode)).filter((n) => n.stateVariable);
}

function findContractDependencies(contractName, astNodes) {
  const contractNode = getFirstContractNode(astNodes[contractName]);

  let dependencyContractNodes = [];
  if (!contractNode) {
    return dependencyContractNodes;
  }

  contractNode.linearizedBaseContracts.forEach((baseContractId) => {
    for (const [, astNode] of Object.entries(astNodes)) {
      const dependency = findContractNodeWithId(baseContractId, astNode);
      if (dependency) {
        dependencyContractNodes.push(dependency);
      }
    }
  });

  return dependencyContractNodes;
}

function findInheritedContractNames(astNodes) {
  return Array.from(findAll('InheritanceSpecifier', astNodes)).map(({ baseName }) => baseName.name);
}

function findYulStorageSlotAssignments(contractName, astNode) {
  const contractNode = getFirstContractNode(astNode);

  const slots = [];
  for (const assignment of findAll('YulAssignment', contractNode)) {
    if (assignment.variableNames[0].name.endsWith('.slot')) {
      slots.push(assignment.value.value);
    }
  }

  return slots;
}

function findYulCaseValues(contractName, astNode) {
  const contractNode = getFirstContractNode(astNode);
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
  findYulCaseValues,
  findYulStorageSlotAssignments,
  findContractNodeWithName,
  findContractNodeWithId,
  findContractNodeVariables,
  findContractNodeStructs,
  findContractStateVariables,
  findContractDependencies,
  findFunctionSelectors,
  findInheritedContractNames,
};
