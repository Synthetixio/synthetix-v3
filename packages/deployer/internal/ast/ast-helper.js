const { findAll } = require('solidity-ast/utils');

function findContractNode(contractName, nodeOrAst) {
  const contractDefs = findAll('ContractDefinition', nodeOrAst);
  if (contractDefs) {
    for (const contract of contractDefs) {
      if (contract.name === contractName) {
        return contract;
      }
    }
  }
  return null;
}

function findInheritorsOf(contractName, contracts) {
  const inheritors = [];

  Object.entries(contracts).map(([name, contract]) => {
    const contractNode = findContractNode(name, contract);
    if (contractNode) {
      contractNode.baseContracts.map((b) => {
        if (b.baseName.name === contractName) {
          inheritors.push(name);
        }
      });
    }
  });

  return inheritors;
}

function findStateVariables(contractName, ast) {
  const contractNode = findContractNode(contractName, ast);
  if (!contractNode) {
    return null;
  }

  // console.log(contractNode.baseContracts);

  const variables = [];
  for (const node of findAll('VariableDeclaration', contractNode)) {
    if (node.stateVariable) {
      variables.push(node);
    }
  }

  return variables.length > 0 ? variables : null;
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

  const items = [];
  for (const assignment of findAll('YulCase', contractNode)) {
    if (assignment.value === 'default') continue;
    if (assignment.value.value === '0') continue;
    items.push(assignment.value.value);
  }

  return items ? items : null;
}

module.exports = {
  findContractNode,
  findDuplicateSlots,
  getCaseSelectors,
  getSlotAddresses,
  findStateVariables,
  findInheritorsOf,
};
