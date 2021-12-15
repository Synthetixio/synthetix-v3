const { findAll } = require('solidity-ast/utils');

function findContractNodeWithId(contractId, astNode) {
  return Array.from(findAll('ContractDefinition', astNode)).find(
    (contractDefiniton) => contractDefiniton.id === contractId
  );
}

function findContractNodeWithName(contractName, astNode) {
  return Array.from(findAll('ContractDefinition', astNode)).find(
    (contractDefiniton) => contractDefiniton.name === contractName
  );
}

function getContractNode(astNode) {
  if (!astNode) {
    return undefined;
  }

  return Array.from(findAll('ContractDefinition', astNode))[0];
}

function findContractNodeVariables(contractNode) {
  return Array.from(findAll('VariableDeclaration', contractNode));
}

function findContractNodeStructs(contractNode) {
  return Array.from(findAll('StructDefinition', contractNode));
}

function findContractStateVariables(contractName, astNode) {
  return findContractNodeVariables(getContractNode(astNode)).filter((n) => n.stateVariable);
}

function findContractDependencies(contractName, astNodes) {
  const contractNode = getContractNode(astNodes[contractName]);

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
  const contractNode = getContractNode(astNode);

  const slots = [];
  for (const assignment of findAll('YulAssignment', contractNode)) {
    if (assignment.variableNames[0].name.endsWith('.slot')) {
      slots.push(assignment.value.value);
    }
  }

  return slots;
}

function findYulCaseValues(contractName, astNode) {
  const contractNode = getContractNode(astNode);
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
