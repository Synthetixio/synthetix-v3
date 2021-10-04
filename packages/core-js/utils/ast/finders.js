const { findAll } = require('solidity-ast/utils');

function findContractNodeWithId(contractId, ast) {
  return Array.from(findAll('ContractDefinition', ast)).find(
    (contractDefiniton) => contractDefiniton.id === contractId
  );
}

function findContractNodeWithName(contractName, ast) {
  return Array.from(findAll('ContractDefinition', ast)).find(
    (contractDefiniton) => contractDefiniton.name === contractName
  );
}

function getContractNode(ast) {
  return Array.from(findAll('ContractDefinition', ast))[0];
}

function findContractNodeVariables(contractNode) {
  return Array.from(findAll('VariableDeclaration', contractNode));
}

function findContractNodeStructs(contractNode) {
  return Array.from(findAll('StructDefinition', contractNode));
}

function findContractStateVariables(contractName, ast) {
  return findContractNodeVariables(getContractNode(ast)).filter((n) => n.stateVariable);
}

function findContractDependencies(contractName, asts) {
  const contractNode = getContractNode(asts[contractName]);

  let dependencyContractNodes = [];

  contractNode.linearizedBaseContracts.forEach((baseContractId) => {
    for (var [, ast] of Object.entries(asts)) {
      const dependency = findContractNodeWithId(baseContractId, ast);
      if (dependency) {
        dependencyContractNodes.push(dependency);
      }
    }
  });

  return dependencyContractNodes;
}

function findInheritedContractNames(ast) {
  return Array.from(findAll('InheritanceSpecifier', ast)).map(({ baseName }) => baseName.name);
}

function findYulStorageSlotAssignments(contractName, ast) {
  const contractNode = getContractNode(ast);

  const slots = [];
  for (const assignment of findAll('YulAssignment', contractNode)) {
    if (assignment.variableNames[0].name === 'store.slot') {
      slots.push(assignment.value.value);
    }
  }

  return slots;
}

function findYulCaseValues(contractName, ast) {
  const contractNode = getContractNode(ast);
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

function findFunctionSelectors(contractName, asts) {
  const selectors = [];
  for (const contractNode of findContractDependencies(contractName, asts)) {
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
