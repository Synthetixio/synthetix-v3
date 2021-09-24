const { findAll } = require('solidity-ast/utils');

function findContractNodeWithId(contractId, asts) {
  return Array.from(findAll('ContractDefinition', asts)).find(
    (contractDefiniton) => contractDefiniton.id === contractId
  );
}

function findContractNodeWithName(contractName, asts) {
  return Array.from(findAll('ContractDefinition', asts)).find(
    (contractDefiniton) => contractDefiniton.name === contractName
  );
}

function getContractNode(ast) {
  return Array.from(findAll('ContractDefinition', ast))[0];
}

function findContractNodeVariables(contractNode) {
  return Array.from(findAll('VariableDeclaration', contractNode));
}

function findContractStateVariables(contractName, ast) {
  return findContractNodeVariables(getContractNode(ast)).filter((n) => n.stateVariable);
}

function findContractDependencies(contractName, asts) {
  const contractNode = getContractNode(asts[contractName]);

  let dependencyContractNodes = [];

  contractNode.linearizedBaseContracts.forEach((baseContractId) => {
    const dependency = findContractNodeWithId(baseContractId, asts);
    if (dependency) {
      dependencyContractNodes.push(dependency);
    }
  });

  return dependencyContractNodes;
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

function findFunctionSelectors(contractName, asts) {
  const selectors = [];
  const contractNode = asts[contractName];
  if (!contractNode) {
    return selectors;
  }

  for (const functionDefinition of findAll('FunctionDefinition', contractNode)) {
    selectors.push({ selector: '0x' + functionDefinition.functionSelector });
  }

  return selectors;
}

module.exports = {
  findYulCaseValues,
  findYulStorageSlotAssignments,
  findContractNodeWithName,
  findContractNodeWithId,
  findContractStateVariables,
  findContractDependencies,
  findFunctionSelectors,
};
