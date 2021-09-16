const { findAll } = require('solidity-ast/utils');

function getSlotAddresses(contractName, ast) {
  const contractNode = findContractNode(ast, contractName);
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

function findContractNode(nodeOrAst, contractName) {
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
module.exports = {
  getSlotAddresses,
  findDuplicateSlots,
};
