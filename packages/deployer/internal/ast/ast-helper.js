const { findAll } = require('solidity-ast/utils');

function findContractNode(contractName, contractsNodes) {
  const contractDefs = findAll('ContractDefinition', contractsNodes);
  if (contractDefs) {
    for (const contract of contractDefs) {
      if (contract.name === contractName) {
        return contract;
      }
    }
  }
  return null;
}

function findContractNodeWithId(contractId, contracts) {
  for (const [contractName, contractAST] of Object.entries(contracts)) {
    const contractNode = findContractNode(contractName, contractAST);

    if (contractNode.id === contractId) {
      return contractNode;
    }
  }

  return null;
}

function findDependenciesOf(contractName, contracts) {
  const contractNode = findContractNode(contractName, contracts[contractName]);
  if (!contractNode) {
    return null;
  }

  let dependencies = [];

  contractNode.linearizedBaseContracts.forEach((baseContractId) => {
    const dependency = findContractNodeWithId(baseContractId, contracts);
    if (dependency) {
      dependencies.push(dependency);
    }
  });

  return dependencies;
}

function findNodeVariables(contractNode, onlyStateVariable) {
  const variables = [];
  for (const node of findAll('VariableDeclaration', contractNode)) {
    if (!onlyStateVariable || node.stateVariable) {
      variables.push(node);
    }
  }

  return variables.length > 0 ? variables : null;
}

function findStateVariables(contractName, ast) {
  const contractNode = findContractNode(contractName, ast);
  if (!contractNode) {
    return null;
  }

  return findNodeVariables(contractNode, true);
}

function getSlotAddresses(contractName, ast) {
  const contractNode = findContractNode(contractName, ast);
  if (!contractNode) {
    return null;
  }

  const slots = [];
  for (const assignment of findAll('YulAssignment', contractNode)) {
    if (assignment.variableNames[0].name === 'store.slot') {
      slots.push(assignment.value.value);
    }
  }

  return slots ? slots : null;
}

function findDuplicateSlots(slots) {
  const duplicates = slots
    .map((s) => s.address)
    .filter((s, index, slots) => slots.indexOf(s) !== index);

  const ocurrences = [];

  if (duplicates.length > 0) {
    duplicates.map((duplicate) => {
      const cases = slots.filter((s) => s.address === duplicate);
      ocurrences.push({
        address: duplicate,
        contracts: cases.map((c) => c.contractName),
      });
    });
  }

  return ocurrences.length > 0 ? ocurrences : null;
}

function getCaseSelectors(contractName, ast) {
  const contractNode = findContractNode(contractName, ast);
  if (!contractNode) {
    return null;
  }

  const addressVariables = findNodeVariables(contractNode, false);

  const items = [];
  for (const caseSelector of findAll('YulCase', contractNode)) {
    if (caseSelector.value === 'default') continue;
    if (caseSelector.value.value === '0') continue;
    const caseAssignment = findAll('YulAssignment', caseSelector);
    const assignmentValue = caseAssignment ? caseAssignment.next() : null;
    // console.log(assignmentValue)
    items.push({
      selector: caseSelector.value.value,
      value: assignmentValue
        ? addressVariables.find((v) => v.name === assignmentValue.value.value.name)
        : null,
    });
  }

  return items ? items : null;
}

function findFunctionSelectors(contractName, contracts) {
  const selectors = [];
  const contractNode = contracts[contractName];
  if (!contractNode) {
    return selectors;
  }

  for (const functionDefinition of findAll('FunctionDefinition', contractNode)) {
    selectors.push({ selector: '0x' + functionDefinition.functionSelector });
  }
  return selectors;
}

module.exports = {
  findDuplicateSlots,
  getCaseSelectors,
  getSlotAddresses,
  findContractNode,
  findContractNodeWithId,
  findStateVariables,
  findDependenciesOf,
  findFunctionSelectors,
};
